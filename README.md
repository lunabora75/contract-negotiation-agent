# Contract Negotiation Agent — Demo

AI-powered SOW negotiation using a 6-agent architecture built on Claude.

## Architecture

```
User Interface (Next.js)
        │
FastAPI Backend (Orchestrator)
        │
   ┌────┴──────────────────────────────────────────┐
   ▼          ▼           ▼          ▼          ▼
Doc        Extraction  Benchmark  Risk       Negotiation
Ingestion  Agent       Agent      Assessment Agent
Agent      (Claude)    (Python)   Agent      (Claude)
                                  (Claude)        │
                                                  ▼
                                              Report
                                              Agent
```

## Quick Start

### 1. Set your API key

```bash
# In the backend folder, create a .env file:
echo ANTHROPIC_API_KEY=your_key_here > backend\.env
```

### 2. Start the backend

```bash
# Run start_backend.bat  OR manually:
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Start the frontend

```bash
# Run start_frontend.bat  OR manually:
cd frontend
npm install
npm run dev
```

### 4. Open the app

Navigate to **http://localhost:3000**

---

## Demo Scenarios

| SOW | Description | Expected Outcome |
|-----|-------------|-----------------|
| TechCorp Financial | Rates 15-30% above market, Net 45, uncapped liability | HIGH risk, large savings potential |
| RetailNow Corp | Rates at market median, Net 30, clean terms | LOW risk, minor adjustments |
| HealthFirst Insurance | Mixed rates, ambiguous IP, no termination clause | HIGH risk, complex negotiation |

## Agent Explainability

Every agent message includes:
- **Confidence score** (0-100%) per extracted field
- **Source citation** — exact text the data was pulled from
- **Reasoning trace** — plain-English explanation of the agent's decision
- **Positions tracker** — what has been agreed vs. pending vs. rejected

Click any agent message in the chat to view its full reasoning trace in the right panel.

## Project Structure

```
contract-negotiation-agent/
├── backend/
│   ├── main.py          # FastAPI routes
│   ├── agents.py        # All 6 agents + Orchestrator
│   ├── schemas.py       # Pydantic data models
│   ├── requirements.txt
│   └── data/
│       ├── benchmarks.json          # Synthetic market rate data
│       └── sows/                    # Synthetic SOW documents
│           ├── sow_above_market.txt
│           ├── sow_at_market.txt
│           └── sow_mixed.txt
├── frontend/
│   └── app/
│       ├── page.tsx     # Main 3-panel UI
│       └── globals.css
├── start_backend.bat
└── start_frontend.bat
```
