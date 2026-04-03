"""
Single NegotiationAgent — one Claude agent, three tools.

Tool use flow:
  1. extract_sow_data   → parse roles / rates / payment terms from SOW text
  2. lookup_benchmarks  → compare each role against internal synthetic benchmarks
  3. save_feedback      → persist post-session feedback for ongoing agent learning

Benchmark data and feedback both live in data_store.py (single source of truth).
The agent's system prompt is enriched with learning context from past sessions
so it continuously improves its negotiation effectiveness.
"""

import json
import os
from typing import Any

import anthropic
from data_store import lookup_benchmark, lookup_payment_terms, save_feedback, get_learning_context

# ── Anthropic client (lazy) ──────────────────────────────────────────────
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
                            "level":       { "type": "string", "description": "e.g. Senior, Lead, Junior" },
                            "fte_count":   { "type": "number" },
                            "hourly_rate": { "type": "number" },
                            "confidence":  { "type": "number", "description": "0 to 1" },
                        },
                        "required": ["title", "hourly_rate", "confidence"],
                    },
                },
                "payment_terms": {
                    "type": "object",
                    "properties": {
                        "schedule":         { "type": "string", "description": "e.g. Net 30" },
                        "type":             { "type": "string", "description": "T&M / Fixed / Milestone" },
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
            "the market position of each proposed rate, delta from median, "
            "recommended target and walk-away rates, and a payment-terms assessment."
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
                "payment_schedule": {
                    "type": "string",
                    "description": "e.g. Net 30 — benchmarked against industry standard",
                },
            },
            "required": ["roles"],
        },
    },
    {
        "name": "save_feedback",
        "description": (
            "Persist human feedback after a completed negotiation session. "
            "This data is stored in the internal data store and used to enrich "
            "the agent's system prompt in future sessions, enabling continuous learning."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "rating":      { "type": "integer", "description": "1 (poor) to 5 (excellent)" },
                "outcome":     { "type": "string",  "enum": ["agreed", "partial", "no_deal"] },
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
        return inputs           # model did the extraction; return as-is

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
# SYSTEM PROMPT  (refreshed each session to include latest learning context)
# ═══════════════════════════════════════════════════════════════════════════

_SYSTEM_BASE = """\
You are a professional contract negotiation agent specialising in IT \
professional-services Statements of Work (SOWs) for MResult, a technology \
consulting firm.

## Your Mandate
Protect the client's commercial interests by negotiating fair, market-aligned \
rates and payment terms for every role in the SOW.

## Workflow — follow this order on every new SOW
1. Call **extract_sow_data** to pull structured data from the document.
2. Call **lookup_benchmarks** with the extracted roles and payment schedule.
3. Present a clear opening assessment: which roles are above/at/below market, \
   the total monthly cost exposure, and your negotiation priorities.
4. Negotiate interactively — one or two items per turn, concise and data-driven.
5. When all items are resolved, present a summary table and explicitly invite \
   the user to rate the session.

## Negotiation Principles
| Principle | Detail |
|---|---|
| **Target rate** | p50 (market median) — this is the goal for every role |
| **Walk-away** | p75 for standard roles; p90 for specialist/niche roles |
| **Payment terms** | Net 30 is the industry standard; flag anything beyond Net 45 |
| **Evidence first** | Always cite the specific benchmark delta, e.g. "+28 % above p50" |
| **Tone** | Professional, collaborative, never combative |
| **Tracking** | Maintain a live tally of agreed / in-progress / outstanding items |

## Response Format
- Use **bold** for role names and key figures
- Bullet each rate comparison: `Role → Proposed $X | Target $Y | Delta +Z%`
- End every turn with a clear next proposal or question
- When negotiation concludes: show a results summary table, then request feedback

## Tools
| Tool | When to call |
|---|---|
| `extract_sow_data` | Very first message — extract structure from the SOW |
| `lookup_benchmarks` | Immediately after extraction — get market data |
| `save_feedback` | Only when the user explicitly submits their rating |
"""


def _build_system() -> str:
    learning = get_learning_context()   # reads from data_store — grows over time
    return _SYSTEM_BASE + learning


# ═══════════════════════════════════════════════════════════════════════════
# AGENT CLASS
# ═══════════════════════════════════════════════════════════════════════════

class NegotiationAgent:
    """
    Single agent that drives the full SOW negotiation lifecycle via tool_use.
    Internally loops until Claude produces a text reply (no pending tool calls).
    """

    def run_turn(
        self,
        messages: list[dict],
        sow_text: str | None = None,
    ) -> tuple[str, list[dict]]:
        """
        Run one conversational turn (may involve multiple internal tool calls).

        Args:
            messages:  Existing Claude-format conversation history.
            sow_text:  Raw SOW document — supply only on the very first turn.

        Returns:
            (reply_text, updated_messages_list)
        """
        msgs = list(messages)

        # First turn: inject the SOW document as the user's opening message
        if sow_text and not msgs:
            msgs.append({
                "role": "user",
                "content": (
                    "Please analyse the following Statement of Work, then open the "
                    "negotiation. Start by extracting the data, benchmark the rates, "
                    "and give me your assessment and opening position.\n\n"
                    f"---BEGIN SOW---\n{sow_text}\n---END SOW---"
                ),
            })

        client = _get_client()
        system = _build_system()

        # Agentic loop: keep going until stop_reason is not "tool_use"
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
                # Extract all text blocks and join them
                reply = " ".join(
                    b.text for b in assistant_blocks if hasattr(b, "text")
                ).strip()
                return reply, msgs

            # Execute every tool the model requested, collect results
            tool_results = []
            for block in assistant_blocks:
                if not (hasattr(block, "type") and block.type == "tool_use"):
                    continue
                try:
                    result = _execute_tool(block.name, block.input)
                except Exception as exc:
                    result = {"error": str(exc)}

                tool_results.append({
                    "type":        "tool_result",
                    "tool_use_id": block.id,
                    "content":     json.dumps(result, default=str),
                })

            msgs.append({"role": "user", "content": tool_results})
