"""
Single NegotiationAgent — one Claude agent, three tools.

The agent negotiates directly WITH the vendor/supplier on behalf of the buyer.
Tone: professional, direct, firm — backed by market benchmark data.
"""

import json
import os
from typing import Any

import anthropic
from data_store import lookup_benchmark, lookup_payment_terms, save_feedback, get_learning_context

# ── Anthropic client ─────────────────────────────────────────────────────
_client: anthropic.Anthropic | None = None

def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client

MODEL = os.getenv("MODEL", "claude-sonnet-4-5")

# ═══════════════════════════════════════════════════════════════════════════
# TOOL SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

TOOLS: list[dict] = [
    {
        "name": "extract_sow_data",
        "description": (
            "Extract all structured data from a Statement of Work document. "
            "Identify every named professional-services role with its hourly rate, "
            "FTE count, and seniority level. Also extract payment terms (schedule, type, "
            "late-payment penalty) and any notable contract clauses. "
            "Assign a confidence score 0–1 per field based on how clearly it appears."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client_name":     { "type": "string" },
                "contract_value":  { "type": "number", "description": "Total USD contract value" },
                "duration_months": { "type": "number" },
                "roles": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title":       { "type": "string" },
                            "level":       { "type": "string" },
                            "fte_count":   { "type": "number" },
                            "hourly_rate": { "type": "number" },
                            "confidence":  { "type": "number" },
                        },
                        "required": ["title", "hourly_rate", "confidence"],
                    },
                },
                "payment_terms": {
                    "type": "object",
                    "properties": {
                        "schedule":         { "type": "string" },
                        "type":             { "type": "string" },
                        "late_penalty_pct": { "type": "number" },
                        "confidence":       { "type": "number" },
                    },
                    "required": ["schedule", "confidence"],
                },
                "key_clauses": {
                    "type": "object",
                    "properties": {
                        "ip_ownership":  { "type": "string" },
                        "termination":   { "type": "string" },
                        "liability_cap": { "type": "string" },
                        "governing_law": { "type": "string" },
                    },
                },
                "extraction_notes": { "type": "string" },
            },
            "required": ["roles", "payment_terms"],
        },
    },
    {
        "name": "lookup_benchmarks",
        "description": (
            "Compare extracted roles and payment terms against the internal "
            "synthetic benchmark database. Returns p25/p50/p75/p90 percentile bands, "
            "market position, delta from median, target and walk-away rates."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "roles": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title":         { "type": "string" },
                            "proposed_rate": { "type": "number" },
                        },
                        "required": ["title", "proposed_rate"],
                    },
                },
                "payment_schedule": { "type": "string" },
            },
            "required": ["roles"],
        },
    },
    {
        "name": "save_feedback",
        "description": (
            "Persist feedback after a completed negotiation session for agent learning."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "rating":      { "type": "integer" },
                "outcome":     { "type": "string", "enum": ["agreed", "partial", "no_deal"] },
                "what_worked": { "type": "string" },
                "what_didnt":  { "type": "string" },
                "notes":       { "type": "string" },
            },
            "required": ["rating", "outcome"],
        },
    },
]

# ═══════════════════════════════════════════════════════════════════════════
# TOOL EXECUTION
# ═══════════════════════════════════════════════════════════════════════════

def _execute_tool(name: str, inputs: dict) -> Any:
    if name == "extract_sow_data":
        return inputs

    if name == "lookup_benchmarks":
        comparisons = [
            lookup_benchmark(r["title"], float(r["proposed_rate"]))
            for r in inputs.get("roles", [])
        ]
        total_monthly_exposure = sum(
            c.get("monthly_cost_exposure", 0) for c in comparisons
        )
        result: dict = {
            "role_comparisons":            comparisons,
            "total_monthly_cost_exposure": total_monthly_exposure,
        }
        if sched := inputs.get("payment_schedule"):
            result["payment_terms_assessment"] = lookup_payment_terms(sched)
        return result

    if name == "save_feedback":
        total = save_feedback(
            rating      = int(inputs.get("rating", 3)),
            outcome     = inputs.get("outcome", "partial"),
            what_worked = inputs.get("what_worked", ""),
            what_didnt  = inputs.get("what_didnt", ""),
            notes       = inputs.get("notes", ""),
        )
        return {"saved": True, "total_feedback_sessions": total}

    raise ValueError(f"Unknown tool: {name}")

# ═══════════════════════════════════════════════════════════════════════════
# SYSTEM PROMPT
# ═══════════════════════════════════════════════════════════════════════════

_SYSTEM_BASE = """\
You are a senior commercial negotiator representing the buyer in a contract \
negotiation with a vendor who has submitted a Statement of Work (SOW) for \
professional IT services. You are speaking directly to the vendor.

## Your Role
You negotiate on behalf of the buyer to secure fair, market-aligned rates and \
payment terms. You are professional, direct, and firm. You do not advise — \
you negotiate. Every position you take must be backed by market data.

## Workflow — follow this order on every new SOW
1. Call **extract_sow_data** to parse the document.
2. Call **lookup_benchmarks** with the extracted roles and payment schedule.
3. Open negotiations: introduce yourself, summarise what you reviewed, and \
   present your counter-offer for each item that is above market. Be specific \
   and cite benchmark data.
4. Negotiate item by item — keep turns focused and professional.
5. Once all items are resolved, present the **Final Agreed Terms** in a clean \
   summary table and state that the agreement will be sent to the buyer for \
   formal approval.

## Negotiation Principles
| Principle | Detail |
|---|---|
| **Opening offer** | p50 (benchmarked rate) — your first counter for every above-benchmark role |
| **Maximum concession** | p75 for standard roles; p90 only for rare specialist roles |
| **Payment terms** | Net 30 is standard; propose Net 30 if vendor asks for Net 45+ |
| **Evidence** | Always cite the benchmark delta, e.g. "our internal benchmark data shows this rate is 28% above the benchmarked rate" |
| **Tone** | Direct and professional — no hedging, no filler. State your position clearly |
| **Closure** | Do not drag negotiations. If vendor agrees within walk-away, accept and close |

## Response Format
- Address the vendor directly (e.g. "Thank you for submitting your SOW…")
- Use **bold** for role names, rates, and key figures
- Present counter-offers in a markdown table with exactly these columns:
  `Role | Vendor Rate | Our Offer | Benchmark | Delta from Benchmark`
- The "Benchmark" column is the internal benchmarked rate (p50). The "Delta from Benchmark" column shows the % difference between Vendor Rate and Benchmark (e.g. +18.2% or -5.0%). Never use "Market p50" or "Delta from Market" as column names.
- Keep each turn concise — one clear position or question per message
- When all items are agreed: output a **Final Agreed Terms** table, then state \
  the summary will be forwarded to the buyer for approval

## Tools
| Tool | When to call |
|---|---|
| `extract_sow_data` | First message only — parse the SOW |
| `lookup_benchmarks` | Immediately after extraction |
| `save_feedback` | Only when buyer approval feedback is explicitly submitted |
"""


def _build_system() -> str:
    learning = get_learning_context()
    return _SYSTEM_BASE + learning


# ═══════════════════════════════════════════════════════════════════════════
# AGENT CLASS
# ═══════════════════════════════════════════════════════════════════════════

class NegotiationAgent:
    def __init__(self):
        # Captures tool results (extraction + benchmarks) for explainability
        self.captured_tools: dict = {}

    def run_turn(
        self,
        messages: list[dict],
        sow_text: str | None = None,
    ) -> tuple[str, list[dict]]:
        self.captured_tools = {}
        msgs = list(messages)

        if sow_text and not msgs:
            msgs.append({
                "role": "user",
                "content": (
                    "Please review the following Statement of Work and open the negotiation "
                    "directly with the vendor. Extract the data, benchmark the rates, then "
                    "present your counter-offer clearly and professionally.\n\n"
                    f"---BEGIN SOW---\n{sow_text}\n---END SOW---"
                ),
            })

        client = _get_client()
        system = _build_system()

        while True:
            response = client.messages.create(
                model      = MODEL,
                max_tokens = 4096,
                system     = system,
                tools      = TOOLS,
                messages   = msgs,
            )

            assistant_blocks = response.content
            msgs.append({"role": "assistant", "content": assistant_blocks})

            if response.stop_reason != "tool_use":
                reply = " ".join(
                    b.text for b in assistant_blocks if hasattr(b, "text")
                ).strip()
                return reply, msgs

            tool_results = []
            for block in assistant_blocks:
                if not (hasattr(block, "type") and block.type == "tool_use"):
                    continue
                try:
                    result = _execute_tool(block.name, block.input)
                    # Capture extraction and benchmark results for explainability
                    if block.name in ("extract_sow_data", "lookup_benchmarks"):
                        self.captured_tools[block.name] = result
                except Exception as exc:
                    result = {"error": str(exc)}

                tool_results.append({
                    "type":        "tool_result",
                    "tool_use_id": block.id,
                    "content":     json.dumps(result, default=str),
                })

            msgs.append({"role": "user", "content": tool_results})
