"""
data_store.py — Single internal data store for:
  1. Synthetic benchmark rates (p25/p50/p75/p90) for professional services roles
  2. Human feedback captured after each negotiation session
     → read back at session start so the agent learns and improves over time

All data lives in  data/store.json  (auto-created on first write).
The benchmark data is baked in here as the source of truth; the JSON file
holds only the feedback entries (benchmarks are never persisted externally).
"""

import json
import datetime
from pathlib import Path
from typing import Optional

STORE_PATH = Path(__file__).parent / "data" / "store.json"

# ═══════════════════════════════════════════════════════════════════════════
# SYNTHETIC BENCHMARK DATA
# Hourly rates in USD for IT professional-services roles.
# Percentiles: p25 (entry), p50 (median), p75 (experienced), p90 (premium)
# ═══════════════════════════════════════════════════════════════════════════

BENCHMARKS: dict = {

    # ── Delivery / Management ──────────────────────────────────────────────
    "Project Manager": {
        "p25": 125, "p50": 145, "p75": 165, "p90": 190,
        "tags": ["delivery", "management"],
        "note": "IT project delivery lead, mid-size programmes",
    },
    "Senior Project Manager": {
        "p25": 148, "p50": 172, "p75": 198, "p90": 228,
        "tags": ["delivery", "management"],
        "note": "Large-programme or multi-workstream delivery lead",
    },
    "Programme Manager": {
        "p25": 175, "p50": 200, "p75": 228, "p90": 260,
        "tags": ["delivery", "management"],
        "note": "Enterprise-scale programme delivery",
    },
    "Scrum Master": {
        "p25": 110, "p50": 130, "p75": 150, "p90": 172,
        "tags": ["agile", "delivery"],
        "note": "Agile ceremony facilitator and team coach",
    },
    "Agile Coach": {
        "p25": 140, "p50": 162, "p75": 185, "p90": 210,
        "tags": ["agile", "delivery"],
        "note": "Organisation-wide agile transformation",
    },
    "Change Manager": {
        "p25": 115, "p50": 135, "p75": 155, "p90": 178,
        "tags": ["change", "management"],
        "note": "Organisational change & adoption specialist",
    },
    "Product Manager": {
        "p25": 140, "p50": 162, "p75": 188, "p90": 215,
        "tags": ["product", "management"],
        "note": "Digital product owner / roadmap lead",
    },

    # ── Architecture ──────────────────────────────────────────────────────
    "Solution Architect": {
        "p25": 185, "p50": 208, "p75": 232, "p90": 260,
        "tags": ["architecture", "technical"],
        "note": "Enterprise solution design across technology stack",
    },
    "Enterprise Architect": {
        "p25": 210, "p50": 238, "p75": 265, "p90": 298,
        "tags": ["architecture", "technical"],
        "note": "C-suite technology advisor, EA frameworks",
    },
    "Cloud Architect": {
        "p25": 178, "p50": 202, "p75": 228, "p90": 258,
        "tags": ["architecture", "cloud"],
        "note": "AWS / Azure / GCP platform architect",
    },
    "Security Architect": {
        "p25": 188, "p50": 214, "p75": 242, "p90": 272,
        "tags": ["architecture", "security"],
        "note": "Cybersecurity and zero-trust architect",
    },
    "Data Architect": {
        "p25": 172, "p50": 195, "p75": 222, "p90": 252,
        "tags": ["architecture", "data"],
        "note": "Data platform / lakehouse design",
    },
    "Integration Architect": {
        "p25": 168, "p50": 190, "p75": 215, "p90": 245,
        "tags": ["architecture", "integration"],
        "note": "API / middleware / ESB architect",
    },

    # ── Engineering ────────────────────────────────────────────────────────
    "Dev Lead": {
        "p25": 148, "p50": 170, "p75": 195, "p90": 222,
        "tags": ["engineering", "leadership"],
        "note": "Software development team lead / tech lead",
    },
    "Senior Developer": {
        "p25": 135, "p50": 158, "p75": 182, "p90": 208,
        "tags": ["engineering"],
        "note": "Senior software engineer (5+ years)",
    },
    "Full Stack Developer": {
        "p25": 118, "p50": 140, "p75": 162, "p90": 188,
        "tags": ["engineering"],
        "note": "Full stack web / API developer",
    },
    "Frontend Developer": {
        "p25": 105, "p50": 125, "p75": 148, "p90": 172,
        "tags": ["engineering"],
        "note": "React / Angular / Vue frontend specialist",
    },
    "Backend Developer": {
        "p25": 112, "p50": 132, "p75": 155, "p90": 180,
        "tags": ["engineering"],
        "note": "API / microservices backend developer",
    },
    "DevOps Engineer": {
        "p25": 130, "p50": 152, "p75": 175, "p90": 200,
        "tags": ["engineering", "devops"],
        "note": "CI/CD, IaC, platform reliability engineering",
    },

    # ── Data & AI ─────────────────────────────────────────────────────────
    "Senior Data Engineer": {
        "p25": 155, "p50": 178, "p75": 202, "p90": 228,
        "tags": ["data", "engineering"],
        "note": "Senior data pipeline / platform engineer",
    },
    "Data Engineer": {
        "p25": 120, "p50": 142, "p75": 165, "p90": 190,
        "tags": ["data", "engineering"],
        "note": "Data pipeline and ETL engineer",
    },
    "Junior Data Engineer": {
        "p25": 88, "p50": 108, "p75": 130, "p90": 152,
        "tags": ["data", "engineering"],
        "note": "Entry-level data engineer",
    },
    "Data Scientist": {
        "p25": 148, "p50": 172, "p75": 198, "p90": 228,
        "tags": ["data", "ai"],
        "note": "Statistical modelling and ML practitioner",
    },
    "ML Engineer": {
        "p25": 160, "p50": 185, "p75": 212, "p90": 242,
        "tags": ["data", "ai"],
        "note": "Machine learning platform and MLOps engineer",
    },
    "AI Engineer": {
        "p25": 168, "p50": 195, "p75": 225, "p90": 258,
        "tags": ["data", "ai"],
        "note": "LLM application and GenAI engineer",
    },
    "Data Analyst": {
        "p25": 88, "p50": 108, "p75": 128, "p90": 150,
        "tags": ["data"],
        "note": "BI / reporting / visualisation analyst",
    },

    # ── Analysis & QA ─────────────────────────────────────────────────────
    "Business Analyst": {
        "p25": 105, "p50": 125, "p75": 148, "p90": 172,
        "tags": ["analysis"],
        "note": "Requirements, process and business analysis",
    },
    "Senior Business Analyst": {
        "p25": 125, "p50": 148, "p75": 172, "p90": 198,
        "tags": ["analysis"],
        "note": "Senior requirements and domain specialist",
    },
    "QA Lead": {
        "p25": 100, "p50": 122, "p75": 145, "p90": 168,
        "tags": ["qa"],
        "note": "Test strategy lead, automation frameworks",
    },
    "QA Engineer": {
        "p25": 80, "p50": 100, "p75": 120, "p90": 142,
        "tags": ["qa"],
        "note": "Manual and automated test engineer",
    },
    "Performance Test Engineer": {
        "p25": 110, "p50": 130, "p75": 152, "p90": 175,
        "tags": ["qa", "performance"],
        "note": "Load / performance / stress testing specialist",
    },
}

# Payment terms benchmark
PAYMENT_TERMS_BENCHMARK = {
    "preferred":            "Net 30",
    "acceptable":           ["Net 15", "Net 30", "Net 45"],
    "flagged":              ["Net 60", "Net 90"],
    "late_penalty_market":  1.5,          # percent per month, market standard
    "note": "Net 30 is the IT professional-services industry standard. "
            "Net 45 is acceptable with justification; Net 60+ should be negotiated down.",
}

# ═══════════════════════════════════════════════════════════════════════════
# STORE ACCESS HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def _load() -> dict:
    if STORE_PATH.exists():
        try:
            return json.loads(STORE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"feedback": []}


def _save(store: dict) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps(store, indent=2, ensure_ascii=False), encoding="utf-8")


# ═══════════════════════════════════════════════════════════════════════════
# BENCHMARK LOOKUP
# ═══════════════════════════════════════════════════════════════════════════

def _percentile(rate: float, p25: float, p50: float, p75: float, p90: float) -> int:
    if rate <= p25:
        return max(0, int((rate / p25) * 25))
    if rate <= p50:
        return 25 + int((rate - p25) / (p50 - p25) * 25)
    if rate <= p75:
        return 50 + int((rate - p50) / (p75 - p50) * 25)
    if rate <= p90:
        return 75 + int((rate - p75) / (p90 - p75) * 15)
    return min(99, 90 + int((rate - p90) / p90 * 10))


def lookup_benchmark(title: str, proposed_rate: float) -> dict:
    """
    Fuzzy-match `title` to the benchmark database and return a full comparison.
    """
    title_l = title.lower()

    # 1. Exact match (case-insensitive)
    match_key: Optional[str] = None
    for key in BENCHMARKS:
        if key.lower() == title_l:
            match_key = key
            break

    # 2. All words in key appear in title
    if not match_key:
        for key in BENCHMARKS:
            words = key.lower().split()
            if sum(w in title_l for w in words) >= max(1, len(words) - 1):
                match_key = key
                break

    # 3. At least one significant word matches
    if not match_key:
        significant = {"manager", "architect", "engineer", "developer", "analyst",
                       "lead", "scientist", "coach", "master", "director"}
        title_words = set(title_l.split())
        for key in BENCHMARKS:
            key_words = set(key.lower().split())
            if key_words & title_words & significant:
                match_key = key
                break

    if not match_key:
        return {
            "title":         title,
            "proposed_rate": proposed_rate,
            "matched":       False,
            "note":          "No benchmark match found for this role title.",
        }

    bm = BENCHMARKS[match_key]
    p25, p50, p75, p90 = bm["p25"], bm["p50"], bm["p75"], bm["p90"]
    pct   = _percentile(proposed_rate, p25, p50, p75, p90)
    delta = round((proposed_rate - p50) / p50 * 100, 1)

    position = (
        "below_market"       if proposed_rate < p25 else
        "at_market"          if proposed_rate <= p50 else
        "above_market"       if proposed_rate <= p75 else
        "significantly_above"
    )

    monthly_exposure = round(max(0, proposed_rate - p50) * 160, 0)   # 160 hrs/month

    return {
        "title":                  title,
        "matched_benchmark":      match_key,
        "proposed_rate":          proposed_rate,
        "matched":                True,
        "p25": p25, "p50": p50, "p75": p75, "p90": p90,
        "percentile":             pct,
        "market_position":        position,
        "delta_from_median_pct":  delta,
        "target_rate":            p50,       # our goal
        "walk_away_rate":         p75,       # max acceptable
        "monthly_cost_exposure":  monthly_exposure,
        "benchmark_note":         bm.get("note", ""),
    }


def lookup_payment_terms(schedule: str) -> dict:
    """Return a benchmark assessment for a payment schedule string."""
    s = schedule.strip()
    if s in PAYMENT_TERMS_BENCHMARK["acceptable"]:
        status = "acceptable"
    elif s in PAYMENT_TERMS_BENCHMARK["flagged"]:
        status = "flagged"
    else:
        status = "non_standard"

    return {
        "proposed":   s,
        "preferred":  PAYMENT_TERMS_BENCHMARK["preferred"],
        "status":     status,
        "note":       PAYMENT_TERMS_BENCHMARK["note"],
    }


# ═══════════════════════════════════════════════════════════════════════════
# FEEDBACK — save + learning context
# ═══════════════════════════════════════════════════════════════════════════

def save_feedback(
    rating: int,
    outcome: str,
    what_worked: str = "",
    what_didnt: str = "",
    notes: str = "",
) -> int:
    """Persist one feedback entry. Returns total feedback count."""
    store = _load()
    store.setdefault("feedback", []).append({
        "rating":       rating,
        "outcome":      outcome,
        "what_worked":  what_worked,
        "what_didnt":   what_didnt,
        "notes":        notes,
        "timestamp":    datetime.datetime.utcnow().isoformat(),
    })
    _save(store)
    return len(store["feedback"])


def get_learning_context() -> str:
    """
    Build a compact learning summary from the most recent feedback entries.
    Injected into the agent system prompt so each new session benefits
    from lessons learned in previous negotiations.
    """
    store    = _load()
    all_fb   = store.get("feedback", [])
    if not all_fb:
        return ""

    recent   = all_fb[-8:]          # look at last 8 sessions
    n        = len(recent)
    avg      = round(sum(f.get("rating", 3) for f in recent) / n, 1)
    outcomes = [f.get("outcome", "") for f in recent]
    agreed   = outcomes.count("agreed")
    partial  = outcomes.count("partial")
    no_deal  = outcomes.count("no_deal")

    worked_items = [f["what_worked"] for f in recent if f.get("what_worked")]
    improve_items = [f["what_didnt"]  for f in recent if f.get("what_didnt")]

    lines = [
        f"\n## Agent Learning Context  (from last {n} negotiation sessions)",
        f"Average user rating: {avg}/5  |  Outcomes: {agreed} agreed, {partial} partial, {no_deal} no-deal",
    ]
    if worked_items:
        lines.append("What worked well: " + "  •  ".join(worked_items[-4:]))
    if improve_items:
        lines.append("Areas to improve: " + "  •  ".join(improve_items[-4:]))

    lines.append(
        "Apply these learnings: lean into what worked, actively correct what did not."
    )
    return "\n".join(lines)
