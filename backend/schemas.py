from pydantic import BaseModel, Field
from typing import Optional, List, Any
from enum import Enum


class RiskSeverity(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


# ── Extraction ────────────────────────────────────────────────────────────────

class ExtractedRole(BaseModel):
    title: str
    level: str
    fte_count: float
    hourly_rate: float
    monthly_cost: Optional[float] = None
    confidence: float
    source_snippet: str


class PaymentTerms(BaseModel):
    schedule: str          # e.g. "Net 30", "Net 45"
    payment_type: str      # "time-and-materials" | "fixed-fee" | "milestone"
    milestone_based: bool
    late_payment_penalty: Optional[str] = None
    confidence: float
    source_snippet: str


class ContractMetadata(BaseModel):
    client: str
    vendor: str
    effective_date: Optional[str] = None
    duration_months: Optional[int] = None
    total_value: Optional[float] = None
    contract_ref: Optional[str] = None
    confidence: float


class KeyClauses(BaseModel):
    ip_ownership: Optional[str] = None
    termination: Optional[str] = None
    liability: Optional[str] = None
    governing_law: Optional[str] = None
    sla: Optional[str] = None


class ExtractionResult(BaseModel):
    contract_metadata: ContractMetadata
    roles: List[ExtractedRole]
    payment_terms: PaymentTerms
    key_clauses: KeyClauses
    deliverables: List[str] = []
    overall_confidence: float
    extraction_notes: str


# ── Benchmark ─────────────────────────────────────────────────────────────────

class BenchmarkComparison(BaseModel):
    role_title: str
    proposed_rate: float
    p25: float
    p50: float
    p75: float
    p90: float
    percentile_position: float     # 0-100, where the proposed rate sits
    delta_from_p50_pct: float      # % above/below market median
    market_position: str           # "below_market" | "at_market" | "above_market" | "significantly_above"
    target_rate: float             # recommended negotiation target
    walk_away_rate: float          # maximum acceptable rate
    potential_savings_monthly: float
    confidence: float


class BenchmarkResult(BaseModel):
    comparisons: List[BenchmarkComparison]
    payment_terms_assessment: str
    total_monthly_savings_potential: float
    total_contract_savings_potential: float
    summary: str


# ── Risk ──────────────────────────────────────────────────────────────────────

class RiskFinding(BaseModel):
    category: str
    severity: RiskSeverity
    description: str
    clause_text: Optional[str] = None
    recommendation: str


class RiskAssessment(BaseModel):
    findings: List[RiskFinding]
    overall_risk_score: str        # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    reasoning: str


# ── Negotiation ───────────────────────────────────────────────────────────────

class NegotiationPosition(BaseModel):
    item: str
    original: str
    our_position: str
    status: str = "pending"        # "pending" | "agreed" | "rejected" | "in_progress"


class NegotiationMessage(BaseModel):
    role: str                      # "user" | "agent"
    content: str
    reasoning: Optional[str] = None
    confidence: Optional[float] = None
    willing_to_concede: List[str] = []
    firm_positions: List[str] = []
    current_positions: List[NegotiationPosition] = []
    phase: Optional[str] = None   # "opening" | "negotiating" | "closing" | "agreed"
    agent_name: str = "Negotiation Agent"


# ── Report ────────────────────────────────────────────────────────────────────

class ReportLineItem(BaseModel):
    role_or_term: str
    original: str
    negotiated: str
    outcome: str                   # "reduced" | "unchanged" | "improved" | "agreed"
    financial_impact: Optional[float] = None


class NegotiationReport(BaseModel):
    session_id: str
    sow_name: str
    original_risk_score: str
    final_risk_score: str
    line_items: List[ReportLineItem]
    total_monthly_savings: float
    total_contract_savings: float
    key_wins: List[str]
    outstanding_items: List[str]
    summary: str


# ── Session & API ─────────────────────────────────────────────────────────────

class SessionState(BaseModel):
    session_id: str
    sow_name: str
    sow_text: str
    extraction: Optional[ExtractionResult] = None
    benchmark: Optional[BenchmarkResult] = None
    risks: Optional[RiskAssessment] = None
    messages: List[NegotiationMessage] = []
    status: str = "init"          # "init"|"analyzing"|"ready"|"negotiating"|"complete"
    agent_log: List[dict] = []    # trace of all agent actions


class AnalyzeRequest(BaseModel):
    sow_name: str


class NegotiateRequest(BaseModel):
    message: str
