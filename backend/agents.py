"""
All six Contract Negotiation Agents, plus the Orchestrator.

Agent hierarchy:
  Orchestrator
  ├── DocIngestionAgent    (classify + chunk SOW text)
  ├── ExtractionAgent      (Claude tool-use → structured SOW data + confidence)
  ├── BenchmarkAgent       (pure-Python percentile analysis)
  ├── RiskAgent            (Claude tool-use → risk findings + severity)
  ├── NegotiationAgent     (multi-turn Claude conversation)
  └── ReportAgent          (pure-Python summary generation)
"""

import json
import math
import uuid
from pathlib import Path
from typing import Optional

import anthropic

from schemas import (
    ExtractionResult, ContractMetadata, ExtractedRole, PaymentTerms, KeyClauses,
    BenchmarkComparison, BenchmarkResult,
    RiskFinding, RiskAssessment, RiskSeverity,
    NegotiationMessage, NegotiationPosition,
    NegotiationReport, ReportLineItem,
    SessionState,
)

# ── Anthropic client ──────────────────────────────────────────────────────────
_client: Optional[anthropic.Anthropic] = None

def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()   # reads ANTHROPIC_API_KEY from env
    return _client

MODEL = "claude-sonnet-4-6"

DATA_DIR = Path(__file__).parent / "data"
BENCHMARKS = json.loads((DATA_DIR / "benchmarks.json").read_text())


# ══════════════════════════════════════════════════════════════════════════════
# 1. Doc Ingestion Agent
# ══════════════════════════════════════════════════════════════════════════════

class DocIngestionAgent:
    """
    Reads and pre-processes the SOW text.
    In production this would parse PDF/DOCX; here we read the synthetic .txt file.
    Returns the raw text plus a simple document classification.
    """
    name = "Document Ingestion Agent"

    def run(self, sow_name: str) -> dict:
        sow_path = DATA_DIR / "sows" / f"{sow_name}.txt"
        if not sow_path.exists():
            raise FileNotFoundError(f"SOW not found: {sow_name}")

        text = sow_path.read_text(encoding="utf-8")

        # Simple keyword-based classification
        is_sow = any(kw in text.upper() for kw in ["STATEMENT OF WORK", "SOW", "PROFESSIONAL SERVICES"])
        doc_type = "Professional Services SOW" if is_sow else "Unknown Contract"
        confidence = 0.96 if is_sow else 0.45

        word_count = len(text.split())
        sections = [line.strip() for line in text.splitlines()
                    if line.strip() and line.strip()[0].isdigit() and "." in line[:5]]

        return {
            "agent": self.name,
            "sow_text": text,
            "doc_type": doc_type,
            "confidence": confidence,
            "word_count": word_count,
            "detected_sections": sections[:10],
            "reasoning": (
                f"Document classified as '{doc_type}' based on keyword detection "
                f"(confidence {confidence:.0%}). Found {word_count} words across "
                f"{len(sections)} numbered sections."
            ),
        }


# ══════════════════════════════════════════════════════════════════════════════
# 2. Extraction Agent
# ══════════════════════════════════════════════════════════════════════════════

EXTRACTION_TOOL = {
    "name": "extract_sow_data",
    "description": "Extract all structured data fields from a Statement of Work document.",
    "input_schema": {
        "type": "object",
        "properties": {
            "contract_metadata": {
                "type": "object",
                "properties": {
                    "client":          {"type": "string"},
                    "vendor":          {"type": "string"},
                    "effective_date":  {"type": "string"},
                    "duration_months": {"type": "integer"},
                    "total_value":     {"type": "number"},
                    "contract_ref":    {"type": "string"},
                    "confidence":      {"type": "number", "description": "0.0-1.0 extraction confidence"}
                },
                "required": ["client", "vendor", "confidence"]
            },
            "roles": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title":          {"type": "string"},
                        "level":          {"type": "string"},
                        "fte_count":      {"type": "number"},
                        "hourly_rate":    {"type": "number"},
                        "monthly_cost":   {"type": "number"},
                        "confidence":     {"type": "number"},
                        "source_snippet": {"type": "string", "description": "Exact text fragment the rate was extracted from"}
                    },
                    "required": ["title", "level", "fte_count", "hourly_rate", "confidence", "source_snippet"]
                }
            },
            "payment_terms": {
                "type": "object",
                "properties": {
                    "schedule":              {"type": "string"},
                    "payment_type":          {"type": "string"},
                    "milestone_based":       {"type": "boolean"},
                    "late_payment_penalty":  {"type": "string"},
                    "confidence":            {"type": "number"},
                    "source_snippet":        {"type": "string"}
                },
                "required": ["schedule", "payment_type", "milestone_based", "confidence", "source_snippet"]
            },
            "key_clauses": {
                "type": "object",
                "properties": {
                    "ip_ownership":  {"type": "string"},
                    "termination":   {"type": "string"},
                    "liability":     {"type": "string"},
                    "governing_law": {"type": "string"},
                    "sla":           {"type": "string"}
                }
            },
            "deliverables": {
                "type": "array",
                "items": {"type": "string"}
            },
            "overall_confidence": {"type": "number"},
            "extraction_notes":   {"type": "string"}
        },
        "required": ["contract_metadata", "roles", "payment_terms", "overall_confidence", "extraction_notes"]
    }
}


class ExtractionAgent:
    """
    Uses Claude with strict tool-calling to pull structured data from SOW text.
    Every field carries a confidence score and source citation.
    """
    name = "Extraction Agent"

    def run(self, sow_text: str) -> ExtractionResult:
        response = get_client().messages.create(
            model=MODEL,
            max_tokens=4096,
            tools=[EXTRACTION_TOOL],
            tool_choice={"type": "any"},
            system=(
                "You are an expert contract analyst. Extract ALL structured data from the provided "
                "Statement of Work. Be precise — record exact rates, dates, and clause text. "
                "For each field, assign a confidence score (0.0-1.0) based on how explicitly the "
                "information appears in the document. If a field is missing, note it in extraction_notes. "
                "Always include the exact source_snippet (quoted text) that each rate/term was extracted from."
            ),
            messages=[{"role": "user", "content": f"Extract all structured data from this SOW:\n\n{sow_text}"}],
        )

        # Parse tool use response
        tool_result = None
        for block in response.content:
            if block.type == "tool_use" and block.name == "extract_sow_data":
                tool_result = block.input
                break

        if not tool_result:
            raise ValueError("Extraction Agent: Claude did not invoke the extraction tool")

        meta_data = tool_result.get("contract_metadata", {})
        roles_data = tool_result.get("roles", [])
        pt_data = tool_result.get("payment_terms", {})
        clauses_data = tool_result.get("key_clauses", {})

        return ExtractionResult(
            contract_metadata=ContractMetadata(
                client=meta_data.get("client", "Unknown"),
                vendor=meta_data.get("vendor", "Unknown"),
                effective_date=meta_data.get("effective_date"),
                duration_months=meta_data.get("duration_months"),
                total_value=meta_data.get("total_value"),
                contract_ref=meta_data.get("contract_ref"),
                confidence=meta_data.get("confidence", 0.8),
            ),
            roles=[
                ExtractedRole(
                    title=r.get("title", ""),
                    level=r.get("level", ""),
                    fte_count=r.get("fte_count", 1.0),
                    hourly_rate=r.get("hourly_rate", 0.0),
                    monthly_cost=r.get("monthly_cost"),
                    confidence=r.get("confidence", 0.8),
                    source_snippet=r.get("source_snippet", ""),
                )
                for r in roles_data
            ],
            payment_terms=PaymentTerms(
                schedule=pt_data.get("schedule", "Unknown"),
                payment_type=pt_data.get("payment_type", "Unknown"),
                milestone_based=pt_data.get("milestone_based", False),
                late_payment_penalty=pt_data.get("late_payment_penalty"),
                confidence=pt_data.get("confidence", 0.8),
                source_snippet=pt_data.get("source_snippet", ""),
            ),
            key_clauses=KeyClauses(
                ip_ownership=clauses_data.get("ip_ownership"),
                termination=clauses_data.get("termination"),
                liability=clauses_data.get("liability"),
                governing_law=clauses_data.get("governing_law"),
                sla=clauses_data.get("sla"),
            ),
            deliverables=tool_result.get("deliverables", []),
            overall_confidence=tool_result.get("overall_confidence", 0.85),
            extraction_notes=tool_result.get("extraction_notes", ""),
        )


# ══════════════════════════════════════════════════════════════════════════════
# 3. Benchmark Agent  (pure Python — no LLM call)
# ══════════════════════════════════════════════════════════════════════════════

def _find_benchmark(role_title: str) -> Optional[dict]:
    """Fuzzy-match a role title to the benchmark database."""
    title_lower = role_title.lower()
    benchmarks = BENCHMARKS["roles"]

    # Exact match first
    if role_title in benchmarks:
        return benchmarks[role_title]

    # Partial match
    for key, data in benchmarks.items():
        if key.lower() in title_lower or title_lower in key.lower():
            return data

    # Keyword fallback
    for key, data in benchmarks.items():
        key_words = set(key.lower().split())
        title_words = set(title_lower.split())
        if len(key_words & title_words) >= 1:
            return data

    return None


def _percentile_of(rate: float, p25: float, p50: float, p75: float, p90: float) -> float:
    """Estimate what percentile a given rate corresponds to."""
    if rate <= p25:
        return max(0.0, 25.0 * (rate / p25))
    if rate <= p50:
        return 25.0 + 25.0 * ((rate - p25) / (p50 - p25))
    if rate <= p75:
        return 50.0 + 25.0 * ((rate - p50) / (p75 - p50))
    if rate <= p90:
        return 75.0 + 15.0 * ((rate - p75) / (p90 - p75))
    return min(100.0, 90.0 + 10.0 * ((rate - p90) / (p90 * 0.15)))


def _market_position(percentile: float) -> str:
    if percentile < 40:
        return "below_market"
    if percentile < 60:
        return "at_market"
    if percentile < 80:
        return "above_market"
    return "significantly_above"


class BenchmarkAgent:
    """
    Compares extracted role rates against the synthetic benchmark database.
    Calculates percentile positions, recommends target rates, and estimates savings.
    """
    name = "Benchmark Agent"

    def run(self, extraction: ExtractionResult) -> BenchmarkResult:
        comparisons = []
        total_monthly_savings = 0.0

        for role in extraction.roles:
            bm = _find_benchmark(role.title)
            if not bm:
                continue

            p25, p50, p75, p90 = bm["p25"], bm["p50"], bm["p75"], bm["p90"]
            rate = role.hourly_rate
            pct = _percentile_of(rate, p25, p50, p75, p90)
            delta = ((rate - p50) / p50) * 100.0
            position = _market_position(pct)

            # Target = p50; walk-away = p75
            target = p50
            walk_away = p75

            # Monthly savings if negotiated to target
            hours_per_month = 160 * role.fte_count
            monthly_savings = max(0.0, (rate - target) * hours_per_month)
            total_monthly_savings += monthly_savings

            comparisons.append(BenchmarkComparison(
                role_title=role.title,
                proposed_rate=rate,
                p25=p25, p50=p50, p75=p75, p90=p90,
                percentile_position=round(pct, 1),
                delta_from_p50_pct=round(delta, 1),
                market_position=position,
                target_rate=target,
                walk_away_rate=walk_away,
                potential_savings_monthly=round(monthly_savings, 0),
                confidence=0.92,
            ))

        # Payment terms assessment
        pt = extraction.payment_terms
        pt_assessment = "Net 30 is industry standard — current terms are acceptable."
        if "45" in pt.schedule:
            pt_assessment = "Net 45 exceeds the industry standard of Net 30. Recommend negotiating to Net 30."
        elif "60" in pt.schedule:
            pt_assessment = "Net 60 is significantly above market. Strong recommendation to negotiate to Net 30."
        elif "15" in pt.schedule:
            pt_assessment = "Net 15 is favourable for the client — retain if possible."

        duration = extraction.contract_metadata.duration_months or 12
        total_contract_savings = total_monthly_savings * duration

        above_market = [c for c in comparisons if c.market_position in ("above_market", "significantly_above")]
        summary = (
            f"{len(above_market)} of {len(comparisons)} roles are priced above market median. "
            f"Estimated monthly savings potential: ${total_monthly_savings:,.0f} "
            f"(${total_contract_savings:,.0f} over {duration} months)."
        )

        return BenchmarkResult(
            comparisons=comparisons,
            payment_terms_assessment=pt_assessment,
            total_monthly_savings_potential=round(total_monthly_savings, 0),
            total_contract_savings_potential=round(total_contract_savings, 0),
            summary=summary,
        )


# ══════════════════════════════════════════════════════════════════════════════
# 4. Risk Assessment Agent
# ══════════════════════════════════════════════════════════════════════════════

RISK_TOOL = {
    "name": "assess_contract_risks",
    "description": "Assess legal, commercial, and operational risks in the SOW.",
    "input_schema": {
        "type": "object",
        "properties": {
            "findings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "category":       {"type": "string"},
                        "severity":       {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
                        "description":    {"type": "string"},
                        "clause_text":    {"type": "string"},
                        "recommendation": {"type": "string"}
                    },
                    "required": ["category", "severity", "description", "recommendation"]
                }
            },
            "overall_risk_score": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"]},
            "reasoning": {"type": "string"}
        },
        "required": ["findings", "overall_risk_score", "reasoning"]
    }
}


class RiskAgent:
    """
    Uses Claude to identify risky, non-standard, or missing clauses.
    Returns a scored risk register with remediation recommendations.
    """
    name = "Risk Assessment Agent"

    def run(self, sow_text: str, extraction: ExtractionResult) -> RiskAssessment:
        context = (
            f"Key Clauses Extracted:\n"
            f"- IP Ownership: {extraction.key_clauses.ip_ownership or 'Not found'}\n"
            f"- Termination: {extraction.key_clauses.termination or 'Not found'}\n"
            f"- Liability: {extraction.key_clauses.liability or 'Not found'}\n"
            f"- SLA: {extraction.key_clauses.sla or 'Not found'}\n"
            f"- Payment Terms: {extraction.payment_terms.schedule}\n"
        )

        response = get_client().messages.create(
            model=MODEL,
            max_tokens=3000,
            tools=[RISK_TOOL],
            tool_choice={"type": "any"},
            system=(
                "You are a senior contract risk analyst reviewing professional services SOWs on behalf of the CLIENT (buyer). "
                "Identify ALL material risks: missing clauses, non-standard terms, uncapped liability, ambiguous IP, "
                "problematic payment terms, weak SLAs, auto-renewal traps, and any other red flags. "
                "Rate each finding HIGH / MEDIUM / LOW. Be specific — quote relevant clause text where possible."
            ),
            messages=[{
                "role": "user",
                "content": (
                    f"Assess the risks in this SOW from the CLIENT's perspective.\n\n"
                    f"Extracted context:\n{context}\n\n"
                    f"Full SOW text:\n{sow_text}"
                )
            }],
        )

        tool_result = None
        for block in response.content:
            if block.type == "tool_use" and block.name == "assess_contract_risks":
                tool_result = block.input
                break

        if not tool_result:
            raise ValueError("Risk Agent: Claude did not invoke the risk tool")

        findings = [
            RiskFinding(
                category=f.get("category", "General"),
                severity=RiskSeverity(f.get("severity", "MEDIUM")),
                description=f.get("description", ""),
                clause_text=f.get("clause_text"),
                recommendation=f.get("recommendation", ""),
            )
            for f in tool_result.get("findings", [])
        ]

        return RiskAssessment(
            findings=findings,
            overall_risk_score=tool_result.get("overall_risk_score", "MEDIUM"),
            reasoning=tool_result.get("reasoning", ""),
        )


# ══════════════════════════════════════════════════════════════════════════════
# 5. Negotiation Agent
# ══════════════════════════════════════════════════════════════════════════════

NEGOTIATION_TOOL = {
    "name": "negotiation_response",
    "description": "Provide a structured negotiation response with full reasoning trace.",
    "input_schema": {
        "type": "object",
        "properties": {
            "message": {
                "type": "string",
                "description": "Your negotiation message to the counterparty (vendor)"
            },
            "reasoning": {
                "type": "string",
                "description": "Internal reasoning: which benchmarks/risks drove this position, what leverage you're using"
            },
            "confidence": {
                "type": "number",
                "description": "Confidence score 0.0-1.0 in the negotiation position taken"
            },
            "willing_to_concede": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Items you are willing to negotiate/compromise on"
            },
            "firm_positions": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Items you are holding firm on and why"
            },
            "current_positions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "item":         {"type": "string"},
                        "original":     {"type": "string"},
                        "our_position": {"type": "string"},
                        "status":       {"type": "string", "enum": ["pending", "agreed", "rejected", "in_progress"]}
                    }
                }
            },
            "phase": {
                "type": "string",
                "enum": ["opening", "negotiating", "closing", "agreed", "deadlock"],
                "description": "Current negotiation phase"
            }
        },
        "required": ["message", "reasoning", "confidence", "phase"]
    }
}


def _build_negotiation_system(extraction: ExtractionResult, benchmark: BenchmarkResult, risks: RiskAssessment) -> str:
    above = [c for c in benchmark.comparisons if c.market_position in ("above_market", "significantly_above")]
    high_risks = [f for f in risks.findings if f.severity == RiskSeverity.HIGH]

    bm_lines = "\n".join([
        f"  - {c.role_title}: proposed ${c.proposed_rate}/hr | p50=${c.p50} | p75=${c.p75} | "
        f"at {c.percentile_position:.0f}th percentile | target ${c.target_rate}/hr"
        for c in benchmark.comparisons
    ])

    risk_lines = "\n".join([
        f"  - [{f.severity}] {f.category}: {f.description}"
        for f in risks.findings[:8]
    ])

    return f"""You are an expert contract negotiator acting on behalf of the CLIENT (buyer) in a professional services SOW negotiation.

YOUR MANDATE: Secure the best possible commercial terms while maintaining a professional, constructive tone.

=== BENCHMARK ANALYSIS ===
{len(above)} of {len(benchmark.comparisons)} roles are priced above market:
{bm_lines}

Payment Terms: {benchmark.payment_terms_assessment}
Total Savings Potential: ${benchmark.total_monthly_savings_potential:,.0f}/month (${benchmark.total_contract_savings_potential:,.0f} over contract)

=== RISK FINDINGS ===
Overall Risk Score: {risks.overall_risk_score}
{risk_lines}

=== NEGOTIATION PRINCIPLES ===
1. Always cite specific market data (e.g. "industry p50 for this role is $X/hr") to justify positions.
2. HOLD FIRM on HIGH-severity risks (liability caps, missing termination clauses, IP ambiguity).
3. Lead with rates most significantly above market — use percentile data as your anchor.
4. Be strategic with concessions: offer small wins on low-priority items to protect high-priority gains.
5. Target: rates at p50. Walk-away: rates at p75 maximum.
6. Track what has been agreed — never re-open closed items.
7. Keep responses professional, specific, and backed by data.

Always use the negotiation_response tool to structure your output so the UI can display your reasoning."""


class NegotiationAgent:
    """
    Drives the interactive negotiation conversation using Claude.
    Returns both the message and a full reasoning trace for the UI.
    """
    name = "Negotiation Agent"

    def open(self, extraction: ExtractionResult, benchmark: BenchmarkResult, risks: RiskAssessment) -> NegotiationMessage:
        """Generate the agent's opening negotiation message."""
        system_prompt = _build_negotiation_system(extraction, benchmark, risks)

        above = [c for c in benchmark.comparisons if c.market_position in ("above_market", "significantly_above")]
        high_risks = [f for f in risks.findings if f.severity == RiskSeverity.HIGH]
        pt_issue = "45" in extraction.payment_terms.schedule or "60" in extraction.payment_terms.schedule

        opening_context = (
            f"You are opening the negotiation. Summarise your findings and propose the agenda. "
            f"Key facts: {len(above)} roles above market, {len(high_risks)} high-severity risks, "
            f"payment terms: {extraction.payment_terms.schedule}."
        )

        return self._call(system_prompt, [{"role": "user", "content": opening_context}])

    def respond(
        self,
        system_prompt: str,
        history: list,
        user_message: str,
    ) -> NegotiationMessage:
        """Respond to a user message within an ongoing negotiation."""
        messages = history + [{"role": "user", "content": user_message}]
        return self._call(system_prompt, messages)

    def _call(self, system_prompt: str, messages: list) -> NegotiationMessage:
        response = get_client().messages.create(
            model=MODEL,
            max_tokens=2048,
            tools=[NEGOTIATION_TOOL],
            tool_choice={"type": "any"},
            system=system_prompt,
            messages=messages,
        )

        tool_result = None
        for block in response.content:
            if block.type == "tool_use" and block.name == "negotiation_response":
                tool_result = block.input
                break

        if not tool_result:
            # Fallback to plain text content
            text = " ".join(b.text for b in response.content if hasattr(b, "text"))
            return NegotiationMessage(
                role="agent",
                content=text,
                reasoning="Direct response (tool invocation unavailable)",
                confidence=0.7,
                phase="negotiating",
                agent_name=self.name,
            )

        positions = [
            NegotiationPosition(
                item=p.get("item", ""),
                original=p.get("original", ""),
                our_position=p.get("our_position", ""),
                status=p.get("status", "pending"),
            )
            for p in tool_result.get("current_positions", [])
        ]

        return NegotiationMessage(
            role="agent",
            content=tool_result.get("message", ""),
            reasoning=tool_result.get("reasoning", ""),
            confidence=tool_result.get("confidence", 0.8),
            willing_to_concede=tool_result.get("willing_to_concede", []),
            firm_positions=tool_result.get("firm_positions", []),
            current_positions=positions,
            phase=tool_result.get("phase", "negotiating"),
            agent_name=self.name,
        )


# ══════════════════════════════════════════════════════════════════════════════
# 6. Report Agent  (pure Python — aggregates session data)
# ══════════════════════════════════════════════════════════════════════════════

class ReportAgent:
    """Generates the final negotiation summary report from session state."""
    name = "Report Agent"

    def run(self, session: SessionState) -> NegotiationReport:
        extraction = session.extraction
        benchmark = session.benchmark
        risks = session.risks

        # Collect agreed positions from all agent messages
        agreed: list[NegotiationPosition] = []
        for msg in session.messages:
            for pos in msg.current_positions:
                if pos.status == "agreed":
                    # De-duplicate by item name
                    if not any(a.item == pos.item for a in agreed):
                        agreed.append(pos)

        # Build line items from benchmark comparisons
        line_items = []
        total_monthly_savings = 0.0

        if benchmark:
            for comp in benchmark.comparisons:
                # Check if there's an agreed position for this role
                agreed_pos = next((a for a in agreed if comp.role_title.lower() in a.item.lower()), None)
                if agreed_pos:
                    outcome = "reduced"
                    negotiated = agreed_pos.our_position
                else:
                    outcome = "unchanged" if comp.market_position == "at_market" else "pending"
                    negotiated = f"${comp.proposed_rate}/hr (proposed)"

                savings = comp.potential_savings_monthly
                total_monthly_savings += savings if outcome == "reduced" else 0

                line_items.append(ReportLineItem(
                    role_or_term=comp.role_title,
                    original=f"${comp.proposed_rate}/hr",
                    negotiated=negotiated,
                    outcome=outcome,
                    financial_impact=savings,
                ))

        # Payment terms
        if extraction:
            pt = extraction.payment_terms
            pt_agreed = next((a for a in agreed if "payment" in a.item.lower()), None)
            line_items.append(ReportLineItem(
                role_or_term="Payment Terms",
                original=pt.schedule,
                negotiated=pt_agreed.our_position if pt_agreed else pt.schedule,
                outcome="improved" if pt_agreed else "pending",
                financial_impact=None,
            ))

        key_wins = [a.item for a in agreed]
        outstanding = [li.role_or_term for li in line_items if li.outcome in ("unchanged", "pending")]

        duration = (extraction.contract_metadata.duration_months or 12) if extraction else 12
        total_contract_savings = total_monthly_savings * duration

        return NegotiationReport(
            session_id=session.session_id,
            sow_name=session.sow_name,
            original_risk_score=risks.overall_risk_score if risks else "UNKNOWN",
            final_risk_score="MEDIUM" if risks and risks.overall_risk_score in ("HIGH", "CRITICAL") and len(agreed) > 0 else (risks.overall_risk_score if risks else "UNKNOWN"),
            line_items=line_items,
            total_monthly_savings=round(total_monthly_savings, 0),
            total_contract_savings=round(total_contract_savings, 0),
            key_wins=key_wins,
            outstanding_items=outstanding,
            summary=(
                f"Negotiation session completed. {len(agreed)} items agreed. "
                f"Estimated monthly savings: ${total_monthly_savings:,.0f}. "
                f"Total contract savings: ${total_contract_savings:,.0f} over {duration} months."
            ),
        )


# ══════════════════════════════════════════════════════════════════════════════
# Orchestrator
# ══════════════════════════════════════════════════════════════════════════════

class Orchestrator:
    """
    Co-ordinates all agents through the four-phase pipeline:
      Phase 1: INGESTION → Phase 2: ANALYSIS → Phase 3: NEGOTIATION → Phase 4: REPORT
    """

    def __init__(self):
        self.ingestion   = DocIngestionAgent()
        self.extraction  = ExtractionAgent()
        self.benchmark   = BenchmarkAgent()
        self.risk        = RiskAgent()
        self.negotiation = NegotiationAgent()
        self.report      = ReportAgent()

    # ── Phase 1+2: Ingest + Analyse ──────────────────────────────────────────
    def analyse(self, session: SessionState) -> SessionState:
        session.status = "analyzing"
        log = session.agent_log

        # 1. Ingestion
        ingestion_result = self.ingestion.run(session.sow_name)
        log.append({"agent": self.ingestion.name, "action": "classify", "result": {
            "doc_type": ingestion_result["doc_type"],
            "confidence": ingestion_result["confidence"],
            "word_count": ingestion_result["word_count"],
            "reasoning": ingestion_result["reasoning"],
        }})

        # 2. Extraction
        extraction = self.extraction.run(session.sow_text)
        session.extraction = extraction
        log.append({"agent": self.extraction.name, "action": "extract", "result": {
            "roles_found": len(extraction.roles),
            "overall_confidence": extraction.overall_confidence,
            "notes": extraction.extraction_notes,
        }})

        # 3. Benchmark + Risk (logically parallel)
        benchmark = self.benchmark.run(extraction)
        session.benchmark = benchmark
        log.append({"agent": self.benchmark.name, "action": "benchmark", "result": {
            "comparisons": len(benchmark.comparisons),
            "monthly_savings_potential": benchmark.total_monthly_savings_potential,
            "summary": benchmark.summary,
        }})

        risks = self.risk.run(session.sow_text, extraction)
        session.risks = risks
        log.append({"agent": self.risk.name, "action": "risk_assess", "result": {
            "findings": len(risks.findings),
            "overall_score": risks.overall_risk_score,
        }})

        # 4. Negotiation Agent opens
        opening = self.negotiation.open(extraction, benchmark, risks)
        session.messages.append(opening)
        log.append({"agent": self.negotiation.name, "action": "open_negotiation", "result": {
            "phase": opening.phase,
            "confidence": opening.confidence,
        }})

        session.status = "negotiating"
        return session

    # ── Phase 3: Negotiate turn ───────────────────────────────────────────────
    def negotiate_turn(self, session: SessionState, user_message: str) -> NegotiationMessage:
        # Append user message
        session.messages.append(NegotiationMessage(role="user", content=user_message))

        # Rebuild system prompt from session context
        system_prompt = _build_negotiation_system(session.extraction, session.benchmark, session.risks)

        # Build conversation history for Claude (only role/content pairs)
        history = []
        for m in session.messages[:-1]:   # exclude last user message (added separately)
            if m.role == "agent":
                history.append({"role": "assistant", "content": m.content})
            elif m.role == "user" and m.content != user_message:
                history.append({"role": "user", "content": m.content})

        agent_reply = self.negotiation.respond(system_prompt, history, user_message)
        session.messages.append(agent_reply)

        session.agent_log.append({"agent": self.negotiation.name, "action": "respond", "result": {
            "phase": agent_reply.phase,
            "confidence": agent_reply.confidence,
        }})

        return agent_reply

    # ── Phase 4: Report ───────────────────────────────────────────────────────
    def generate_report(self, session: SessionState) -> NegotiationReport:
        session.status = "complete"
        rpt = self.report.run(session)
        session.agent_log.append({"agent": self.report.name, "action": "report", "result": {
            "total_savings": rpt.total_contract_savings,
        }})
        return rpt
