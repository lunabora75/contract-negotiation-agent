const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, ExternalHyperlink,
  PageBreak
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Colour palette ──────────────────────────────────────────────────────────
const NAVY   = "09131B";
const ORANGE = "F89738";
const LGRAY  = "F4F4F4";
const MGRAY  = "DBDBDB";
const WHITE  = "FFFFFF";
const DGRAY  = "555555";

// ── Shared border helper ────────────────────────────────────────────────────
const cell_border = (color = MGRAY) => ({
  top:    { style: BorderStyle.SINGLE, size: 1, color },
  bottom: { style: BorderStyle.SINGLE, size: 1, color },
  left:   { style: BorderStyle.SINGLE, size: 1, color },
  right:  { style: BorderStyle.SINGLE, size: 1, color },
});
const no_border = () => ({
  top:    { style: BorderStyle.NONE, size: 0, color: WHITE },
  bottom: { style: BorderStyle.NONE, size: 0, color: WHITE },
  left:   { style: BorderStyle.NONE, size: 0, color: WHITE },
  right:  { style: BorderStyle.NONE, size: 0, color: WHITE },
});

// ── Helper: simple paragraph ────────────────────────────────────────────────
const p = (text, opts = {}) => new Paragraph({
  spacing: { after: opts.afterSpacing ?? 160 },
  alignment: opts.align ?? AlignmentType.LEFT,
  children: [new TextRun({
    text,
    font: "Arial",
    size: opts.size ?? 22,
    bold: opts.bold ?? false,
    color: opts.color ?? NAVY,
    italics: opts.italic ?? false,
  })],
});

// ── Helper: heading ─────────────────────────────────────────────────────────
const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 360, after: 200 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ORANGE, space: 4 } },
  children: [new TextRun({ text, font: "Arial", size: 32, bold: true, color: NAVY })],
});
const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 280, after: 160 },
  children: [new TextRun({ text, font: "Arial", size: 26, bold: true, color: NAVY })],
});
const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 200, after: 120 },
  children: [new TextRun({ text, font: "Arial", size: 23, bold: true, color: ORANGE })],
});

// ── Helper: bullet ──────────────────────────────────────────────────────────
const bullet = (text, sub = false) => new Paragraph({
  numbering: { reference: "bullets", level: sub ? 1 : 0 },
  spacing: { after: 100 },
  children: [new TextRun({ text, font: "Arial", size: 22, color: NAVY })],
});

// ── Helper: orange accent bar (section divider) ─────────────────────────────
const divider = () => new Paragraph({
  spacing: { before: 40, after: 40 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: ORANGE, space: 1 } },
  children: [],
});

// ── Helper: full-width coloured header cell ─────────────────────────────────
const headerCell = (text, bg = NAVY, width = 9360) => new TableCell({
  width: { size: width, type: WidthType.DXA },
  shading: { fill: bg, type: ShadingType.CLEAR },
  borders: cell_border(bg),
  margins: { top: 100, bottom: 100, left: 150, right: 150 },
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, font: "Arial", size: 22, bold: true, color: WHITE })],
  })],
});

// ── Helper: table cell ──────────────────────────────────────────────────────
const tc = (text, opts = {}) => new TableCell({
  width: { size: opts.width ?? 2340, type: WidthType.DXA },
  shading: { fill: opts.bg ?? WHITE, type: ShadingType.CLEAR },
  borders: cell_border(MGRAY),
  verticalAlign: VerticalAlign.CENTER,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  children: [new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    children: [new TextRun({
      text,
      font: "Arial",
      size: opts.size ?? 20,
      bold: opts.bold ?? false,
      color: opts.color ?? NAVY,
    })],
  })],
});

// ── Helper: page break ──────────────────────────────────────────────────────
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// ── Helper: spacer ──────────────────────────────────────────────────────────
const spacer = (pts = 200) => new Paragraph({ spacing: { after: pts }, children: [] });

// ── Cover page ──────────────────────────────────────────────────────────────
const coverPage = [
  spacer(1440),

  // Title block
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "MRESULT", font: "Arial", size: 52, bold: true, color: ORANGE })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: "AI-Powered Contract Negotiation", font: "Arial", size: 40, bold: true, color: NAVY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "Solution Approach Document", font: "Arial", size: 28, color: DGRAY, italics: true })],
  }),
  divider(),
  spacer(240),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "Version 1.0  |  April 2026", font: "Arial", size: 22, color: DGRAY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "Confidential — For Internal Use Only", font: "Arial", size: 20, color: DGRAY, italics: true })],
  }),
  pageBreak(),
];

// ── 1. Executive Summary ────────────────────────────────────────────────────
const execSummary = [
  h1("1. Executive Summary"),
  p("MResult has developed an AI-powered Contract Negotiation platform that transforms how professional services Statements of Work (SOW) are reviewed, negotiated, and approved. The solution reduces the time-to-agreement on professional services contracts from days to hours by automating the negotiation process against a proprietary internal benchmark dataset, while keeping human decision-makers in full control of the outcome."),
  spacer(80),
  p("Key value propositions:", { bold: true }),
  bullet("Automated extraction of roles, rates, and payment terms from uploaded SOW documents"),
  bullet("Real-time negotiation between an AI agent and the vendor, guided by internal benchmark data"),
  bullet("Structured approval workflow with explainability and confidence scoring for Category Managers"),
  bullet("Continuous self-learning: every human approval, rejection, or re-negotiation decision feeds back into the agent's knowledge base"),
  bullet("Full audit trail and contract history for governance and compliance"),
  spacer(120),
  p("The platform is built on Anthropic's Claude Sonnet model with a FastAPI backend and a Next.js frontend styled to MResult brand guidelines. It is deployed on Railway (backend) and Vercel (frontend) with automated CI/CD via GitHub."),
];

// ── 2. Problem Statement ────────────────────────────────────────────────────
const problemStatement = [
  spacer(80),
  h1("2. Problem Statement"),
  p("Professional services procurement faces three core inefficiencies:"),
  spacer(60),

  // Table
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2600, 3380, 3380],
    rows: [
      new TableRow({ children: [
        headerCell("Challenge", NAVY, 2600),
        headerCell("Current State", NAVY, 3380),
        headerCell("Impact", NAVY, 3380),
      ]}),
      new TableRow({ children: [
        tc("Manual Review", { width: 2600, bold: true }),
        tc("Category managers read SOWs manually to extract rates and terms", { width: 3380 }),
        tc("Hours of effort per contract; error-prone and inconsistent", { width: 3380 }),
      ]}),
      new TableRow({ children: [
        tc("Benchmark Gaps", { width: 2600, bold: true, bg: LGRAY }),
        tc("No standardised internal rate card to negotiate against", { width: 3380, bg: LGRAY }),
        tc("Vendors are accepted at or near their asking rate; overpayment risk", { width: 3380, bg: LGRAY }),
      ]}),
      new TableRow({ children: [
        tc("Slow Approval Cycles", { width: 2600, bold: true }),
        tc("Negotiation and approval passes through multiple manual hand-offs", { width: 3380 }),
        tc("Days to weeks delay; reduced vendor satisfaction and delivery risk", { width: 3380 }),
      ]}),
      new TableRow({ children: [
        tc("No Learning Loop", { width: 2600, bold: true, bg: LGRAY }),
        tc("Past negotiation outcomes not systematically captured", { width: 3380, bg: LGRAY }),
        tc("Organisation does not improve over time; same mistakes repeated", { width: 3380, bg: LGRAY }),
      ]}),
    ],
  }),
];

// ── 3. Solution Overview ────────────────────────────────────────────────────
const solutionOverview = [
  spacer(80),
  h1("3. Solution Overview"),
  p("The MResult AI Contract Negotiation platform is a web-based application with three distinct portals that map to real-world procurement roles. A single AI agent, powered by Claude Sonnet, orchestrates the end-to-end negotiation lifecycle using specialised tools for document analysis, benchmark lookup, and negotiation strategy."),
  spacer(80),
  h2("3.1 User Portals"),
  spacer(60),

  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2000, 2360, 2500, 2500],
    rows: [
      new TableRow({ children: [
        headerCell("Portal", NAVY, 2000),
        headerCell("Primary User", NAVY, 2360),
        headerCell("Key Actions", NAVY, 2500),
        headerCell("Output", NAVY, 2500),
      ]}),
      new TableRow({ children: [
        tc("Category Manager", { width: 2000, bold: true }),
        tc("Procurement / Category Manager", { width: 2360 }),
        tc("Upload SOW, trigger negotiation, approve / reject / re-negotiate", { width: 2500 }),
        tc("Approved contract terms or re-negotiation instruction", { width: 2500 }),
      ]}),
      new TableRow({ children: [
        tc("Vendor", { width: 2000, bold: true, bg: LGRAY }),
        tc("Vendor / Supplier Representative", { width: 2360, bg: LGRAY }),
        tc("Review AI counter-offer, accept or counter, reach agreement", { width: 2500, bg: LGRAY }),
        tc("Agreed negotiated terms submitted for approval", { width: 2500, bg: LGRAY }),
      ]}),
      new TableRow({ children: [
        tc("Landing Page", { width: 2000, bold: true }),
        tc("All users", { width: 2360 }),
        tc("Persona selection, solution overview, benchmark criteria reference", { width: 2500 }),
        tc("Routing to correct portal", { width: 2500 }),
      ]}),
    ],
  }),

  spacer(80),
  h2("3.2 Contract Lifecycle States"),
  spacer(40),
  p("Every contract progresses through a defined set of statuses, visible in the Category Manager portal:"),
  spacer(60),

  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2600, 4360, 2400],
    rows: [
      new TableRow({ children: [
        headerCell("Status", ORANGE, 2600),
        headerCell("Description", ORANGE, 4360),
        headerCell("Next Action", ORANGE, 2400),
      ]}),
      ...[
        ["Contract Uploaded",              "SOW received and stored. Extraction not yet triggered.",                       "Send to AI Agent"],
        ["Negotiation in Progress",         "AI agent is actively negotiating with the vendor via chat.",                  "Await completion"],
        ["Negotiation Complete — Pending Approval", "Agreement reached. Awaiting Category Manager decision.",              "Approve / Reject / Re-negotiate"],
        ["Pending Offline Review",          "Category Manager has taken the contract offline for further review.",         "Return with decision"],
        ["Re-negotiate",                    "Category Manager has sent the contract back with specific instructions.",     "Agent re-opens negotiation"],
        ["Approved",                        "Terms accepted. Contract moves to history for reference.",                    "—"],
        ["Rejected",                        "Terms rejected. Feedback captured for agent learning.",                       "—"],
      ].map(([status, desc, next], i) => new TableRow({ children: [
        tc(status, { width: 2600, bold: true, bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(desc,   { width: 4360,            bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(next,   { width: 2400,            bg: i % 2 === 0 ? WHITE : LGRAY }),
      ]})),
    ],
  }),
];

// ── 4. Architecture ─────────────────────────────────────────────────────────
const architecture = [
  spacer(80),
  h1("4. Technical Architecture"),

  h2("4.1 High-Level Component View"),
  spacer(40),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 3520, 3500],
    rows: [
      new TableRow({ children: [
        headerCell("Layer", NAVY, 2340),
        headerCell("Component", NAVY, 3520),
        headerCell("Technology", NAVY, 3500),
      ]}),
      ...[
        ["Presentation",   "Landing Page, Category Manager Portal, Vendor Portal",              "Next.js 15 · React 19 · Tailwind CSS · TypeScript"],
        ["API Gateway",    "RESTful API with session management, CORS, health endpoints",        "FastAPI (Python 3.12) · Uvicorn · Pydantic"],
        ["AI Engine",      "Single orchestration agent with tools",                              "Anthropic Claude Sonnet · Agent SDK"],
        ["Tools / Skills", "SOW extraction, benchmark lookup, negotiation strategy, feedback",   "Python functions called as tools by the agent"],
        ["Data Store",     "SOW sessions, benchmark dataset, feedback store",                    "In-memory (JSON) · localStorage (client history)"],
        ["Deployment",     "CI/CD on git push",                                                 "Railway (backend) · Vercel (frontend) · GitHub"],
      ].map(([layer, comp, tech], i) => new TableRow({ children: [
        tc(layer, { width: 2340, bold: true,   bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(comp,  { width: 3520,               bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(tech,  { width: 3500, color: DGRAY, bg: i % 2 === 0 ? WHITE : LGRAY }),
      ]})),
    ],
  }),

  spacer(80),
  h2("4.2 AI Agent Design"),
  p("A single Claude Sonnet agent manages the full negotiation lifecycle. It does not rely on multiple specialised agents; instead it uses a set of Python tool functions to perform discrete tasks. This keeps the architecture simple, auditable, and cost-efficient."),
  spacer(60),

  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2600, 3360, 3400],
    rows: [
      new TableRow({ children: [
        headerCell("Tool", ORANGE, 2600),
        headerCell("Purpose", ORANGE, 3360),
        headerCell("Output", ORANGE, 3400),
      ]}),
      ...[
        ["extract_sow_data",    "Parse uploaded document; identify roles, rates, payment terms, duration",   "Structured JSON with confidence scores per field"],
        ["lookup_benchmarks",   "Compare each extracted role against internal benchmark dataset",            "P50, P75, P90 rates, delta from benchmark, monthly exposure"],
        ["negotiate",           "Generate professional counter-offers and respond to vendor messages",       "Structured chat message with rate table and rationale"],
        ["save_feedback",       "Persist Category Manager decisions, comments, and outcomes",                "Updated feedback store for future learning"],
        ["get_feedback_context","Retrieve prior negotiation outcomes for similar roles",                      "Context snippets injected into agent system prompt"],
      ].map(([tool, purpose, output], i) => new TableRow({ children: [
        tc(tool,    { width: 2600, bold: true, color: ORANGE, bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(purpose, { width: 3360,             bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(output,  { width: 3400, color: DGRAY, bg: i % 2 === 0 ? WHITE : LGRAY }),
      ]})),
    ],
  }),

  spacer(80),
  h2("4.3 Data Architecture"),
  p("All persistent data is stored as structured JSON. Three logical data domains are used:"),
  spacer(60),

  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2200, 2560, 2300, 2300],
    rows: [
      new TableRow({ children: [
        headerCell("Domain", NAVY, 2200),
        headerCell("Contents", NAVY, 2560),
        headerCell("Read by", NAVY, 2300),
        headerCell("Written by", NAVY, 2300),
      ]}),
      ...[
        ["Session Store",      "SOW file, extracted data, chat transcript, status, approval decision", "Agent, Approval page, Manager portal", "API on upload / each chat message"],
        ["Benchmark Dataset",  "Synthetic internal rate card: role, P25/P50/P75/P90 rates, notes",    "Agent (lookup_benchmarks tool)",       "Pre-seeded; updated by admin"],
        ["Feedback Store",     "CM decisions, comments, session IDs, outcomes, timestamps",            "Agent (get_feedback_context tool)",    "Agent (save_feedback tool)"],
      ].map(([domain, contents, read, write], i) => new TableRow({ children: [
        tc(domain,   { width: 2200, bold: true, bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(contents, { width: 2560,             bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(read,     { width: 2300, color: DGRAY, bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(write,    { width: 2300, color: DGRAY, bg: i % 2 === 0 ? WHITE : LGRAY }),
      ]})),
    ],
  }),

  spacer(80),
  h2("4.4 Benchmark Criteria"),
  p("The internal benchmark dataset uses market percentile notation to classify rates. The agent uses these thresholds to determine its negotiation strategy:"),
  spacer(60),

  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1400, 2160, 2400, 3400],
    rows: [
      new TableRow({ children: [
        headerCell("Percentile", ORANGE, 1400),
        headerCell("Label", ORANGE, 2160),
        headerCell("Agent Behaviour", ORANGE, 2400),
        headerCell("Interpretation", ORANGE, 3400),
      ]}),
      ...[
        ["P25", "Below Market",    "Accept immediately",        "25% of the market charges this rate or less — unusually low; likely a new or budget vendor"],
        ["P50", "Benchmark",       "Opening counter-offer",     "Exact market median — the agent's first counter-offer target; fair and defensible"],
        ["P75", "Experienced Range","Walk-away threshold",      "Top quartile — agent will concede up to this point in negotiation but will not exceed it"],
        ["P90", "Premium / Niche", "Exception only",            "Only 10% of the market charges more — acceptable only for highly specialised, rare roles"],
      ].map(([pct, label, behaviour, interpretation], i) => new TableRow({ children: [
        tc(pct,           { width: 1400, bold: true, color: ORANGE, bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(label,         { width: 2160, bold: true,               bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(behaviour,     { width: 2400,                           bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(interpretation,{ width: 3400, color: DGRAY,            bg: i % 2 === 0 ? WHITE : LGRAY }),
      ]})),
    ],
  }),
];

// ── 5. User Journey ─────────────────────────────────────────────────────────
const userJourney = [
  spacer(80),
  h1("5. End-to-End User Journey"),

  h2("5.1 Category Manager Journey"),
  bullet("Lands on the MResult landing page and selects the Category Manager persona"),
  bullet("Uploads a professional services SOW (PDF, DOCX, or TXT — up to 10 MB)"),
  bullet("Reviews AI-extracted roles, rates, and payment terms with extraction confidence scores"),
  bullet("Clicks \u201CSend to AI Agent for Negotiation\u201D — status changes to Negotiation in Progress"),
  bullet("The AI agent initiates the negotiation in the Vendor portal"),
  bullet("Once the agent marks the negotiation complete, status changes to Pending Approval"),
  bullet("Category Manager opens the Approval page and reviews:"),
  bullet("Contract Intelligence panel — extracted terms with confidence scores", true),
  bullet("Benchmark Analysis panel — rate comparison with delta and monthly exposure", true),
  bullet("Final Negotiated Terms panel — the agreed position", true),
  bullet("Negotiation Transcript — full chat history", true),
  bullet("Category Manager selects one of three decisions:"),
  bullet("Approve Terms — contract moves to Approved history", true),
  bullet("Re-negotiate Terms — provides mandatory comments; agent re-engages vendor with the feedback", true),
  bullet("Offline Review — contract remains in Pending section for manual processing", true),
  bullet("Decision and comments are saved to the feedback store for agent self-learning"),

  spacer(80),
  h2("5.2 Vendor Journey"),
  bullet("Lands on the MResult landing page and selects the Vendor persona"),
  bullet("Sees a list of SOWs that have been sent for negotiation (status: Negotiation in Progress)"),
  bullet("Clicks on a SOW to open the negotiation chat"),
  bullet("The AI agent opens with a professional greeting, summarises the SOW, and presents a structured counter-offer table with Benchmark rates and deltas"),
  bullet("Vendor responds to each counter-offer — accepting, countering, or querying individual line items"),
  bullet("Agent negotiates professionally, conceding up to P75 per role, using CM feedback from prior negotiations to inform its position"),
  bullet("When agreement is reached, agent informs the vendor that terms have been sent to the Category Manager for approval"),
  bullet("If the CM sends it back for re-negotiation, the agent re-opens the chat and informs the vendor of the reason"),

  spacer(80),
  h2("5.3 Re-negotiation Flow"),
  bullet("Category Manager rejects or re-negotiates with mandatory comments explaining the reason"),
  bullet("Contract status changes to Re-negotiate"),
  bullet("Agent reads the CM comments from the feedback store as context"),
  bullet("Agent re-opens the Vendor chat: \u201CThis contract was reviewed by the Category Manager. Based on their feedback\u2026\u201D"),
  bullet("A new negotiation round begins with the CM\u2019s specific instructions embedded in the agent\u2019s strategy"),
  bullet("On second completion, the contract returns to Pending Approval for a fresh CM decision"),
];

// ── 6. Self-Learning Loop ───────────────────────────────────────────────────
const learningLoop = [
  spacer(80),
  h1("6. AI Self-Learning Feedback Loop"),
  p("Every interaction between the Category Manager and the Approval page generates structured feedback that is stored and consumed by the agent in future negotiations. This creates a continuous improvement loop without requiring manual model fine-tuning."),
  spacer(80),

  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [800, 2760, 2900, 2900],
    rows: [
      new TableRow({ children: [
        headerCell("Step", NAVY, 800),
        headerCell("Trigger", NAVY, 2760),
        headerCell("Data Captured", NAVY, 2900),
        headerCell("How Agent Uses It", NAVY, 2900),
      ]}),
      ...[
        ["1", "CM approves terms",           "Session ID, roles, final rates, approval, comments",         "Positive reinforcement — similar future offers start near this rate"],
        ["2", "CM rejects terms",            "Session ID, roles, rejected rates, rejection comments",       "Agent avoids similar positions; adjusts opening offer for this role type"],
        ["3", "CM sends for re-negotiation", "Specific re-negotiation instructions from CM",               "Agent injects CM instructions directly into next negotiation prompt"],
        ["4", "Negotiation completes",       "Full transcript, agreed rates vs benchmark, round count",    "Agent learns negotiation patterns and vendor behaviour over time"],
      ].map(([step, trigger, data, usage], i) => new TableRow({ children: [
        tc(step,    { width: 800,  bold: true, color: ORANGE, align: AlignmentType.CENTER, bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(trigger, { width: 2760,             bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(data,    { width: 2900, color: DGRAY, bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(usage,   { width: 2900, color: DGRAY, bg: i % 2 === 0 ? WHITE : LGRAY }),
      ]})),
    ],
  }),

  spacer(80),
  p("The feedback store is a shared data store that sits alongside the benchmark dataset. Both are read at the start of every new negotiation session via the get_feedback_context tool, which retrieves the most relevant prior outcomes for the roles present in the current SOW. This approach does not require model fine-tuning — it uses retrieval-augmented context to influence the agent\u2019s strategy within the existing Claude Sonnet model."),
];

// ── 7. Technology Stack ─────────────────────────────────────────────────────
const techStack = [
  spacer(80),
  h1("7. Technology Stack"),
  spacer(40),

  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2000, 2480, 2440, 2440],
    rows: [
      new TableRow({ children: [
        headerCell("Category", NAVY, 2000),
        headerCell("Technology", NAVY, 2480),
        headerCell("Version", NAVY, 2440),
        headerCell("Rationale", NAVY, 2440),
      ]}),
      ...[
        ["AI Model",         "Anthropic Claude Sonnet",   "Latest",   "Optimal balance of reasoning, speed and cost for negotiation tasks"],
        ["Backend Framework","FastAPI",                   "Python 3.12","High-performance async API with automatic OpenAPI docs"],
        ["Frontend Framework","Next.js",                 "15.5.14",  "React server components, App Router, TypeScript, Vercel-native"],
        ["Styling",          "Tailwind CSS",              "3.4.x",    "Utility-first; MResult brand tokens applied via inline styles"],
        ["Document Parsing", "pdfminer.six / python-docx","Latest",   "Extracts text from PDF and DOCX SOW uploads"],
        ["Session State",    "In-memory Python dict",     "—",        "Lightweight for POC; swap to Redis or PostgreSQL for production"],
        ["Client History",   "localStorage (JSON)",       "—",        "Persists negotiation history across browser sessions on client"],
        ["CI/CD",            "GitHub Actions (auto)",     "—",        "Vercel and Railway both auto-deploy on push to main branch"],
        ["Backend Hosting",  "Railway",                   "—",        "Dockerfile-based Python deployment; auto-scales, zero-config SSL"],
        ["Frontend Hosting", "Vercel",                    "—",        "Edge-optimised Next.js hosting; global CDN; free tier"],
      ].map(([cat, tech, ver, rationale], i) => new TableRow({ children: [
        tc(cat,       { width: 2000, bold: true,   bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(tech,      { width: 2480,               bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(ver,       { width: 2440, color: DGRAY, bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(rationale, { width: 2440, color: DGRAY, bg: i % 2 === 0 ? WHITE : LGRAY }),
      ]})),
    ],
  }),
];

// ── 8. Security ─────────────────────────────────────────────────────────────
const security = [
  spacer(80),
  h1("8. Security & Governance Considerations"),
  p("The current implementation is a functional prototype. The following controls are recommended for production deployment:"),
  spacer(60),
  bullet("Authentication: Add Azure AD / Okta SSO for both portals. Role-based access control to separate CM and Vendor views"),
  bullet("Data Encryption: Encrypt SOW content at rest in the session store. Enable TLS 1.3 for all API calls (already enforced by Railway / Vercel)"),
  bullet("Document Handling: Scan uploaded files for malware before parsing. Enforce 10 MB file size limit (already implemented)"),
  bullet("API Security: Add API key or JWT authentication to all /api/* routes. Rate-limit the negotiation endpoint to prevent abuse"),
  bullet("Data Residency: Migrate session store to a cloud database (PostgreSQL on Railway or Azure Database) for persistence and GDPR compliance"),
  bullet("Audit Log: Persist the full status change history per contract for compliance and dispute resolution"),
  bullet("PII Handling: Ensure vendor contact names in SOWs are not stored in the feedback dataset used for agent learning"),
];

// ── 9. Roadmap ──────────────────────────────────────────────────────────────
const roadmap = [
  spacer(80),
  h1("9. Future Roadmap"),
  spacer(40),

  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1400, 2160, 3200, 2600],
    rows: [
      new TableRow({ children: [
        headerCell("Phase", NAVY, 1400),
        headerCell("Timeframe", NAVY, 2160),
        headerCell("Capability", NAVY, 3200),
        headerCell("Benefit", NAVY, 2600),
      ]}),
      ...[
        ["Phase 1 — Foundation",  "Current (Q2 2026)",  "Core SOW upload, AI negotiation, CM approval workflow, feedback loop",                         "Functional MVP; end-to-end negotiation capability"],
        ["Phase 2 — Persistence", "Q3 2026",            "Database-backed session store, user authentication, full audit trail",                          "Production-ready; multi-user concurrent support"],
        ["Phase 3 — Intelligence","Q4 2026",            "Fine-tuned benchmark updates from feedback data, vendor scoring, win/loss analytics dashboard", "Improved negotiation accuracy and strategic insight"],
        ["Phase 4 — Integration", "Q1 2027",            "ERP / Procurement system integration (SAP Ariba, Coupa), DocuSign for e-signatures",            "Seamless enterprise workflow; fully paperless"],
        ["Phase 5 — Expansion",   "Q2 2027",            "Extend beyond SOW to MSA, NDA, and other contract types; multi-language support",               "Broader applicability across contract portfolio"],
      ].map(([phase, time, cap, benefit], i) => new TableRow({ children: [
        tc(phase,   { width: 1400, bold: true, color: ORANGE, bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(time,    { width: 2160, color: DGRAY,              bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(cap,     { width: 3200,                            bg: i % 2 === 0 ? WHITE : LGRAY }),
        tc(benefit, { width: 2600, color: DGRAY,             bg: i % 2 === 0 ? WHITE : LGRAY }),
      ]})),
    ],
  }),
];

// ── 10. Deployment ──────────────────────────────────────────────────────────
const deployment = [
  spacer(80),
  h1("10. Deployment & Operations"),
  h2("10.1 Current Deployment"),
  bullet("Repository: https://github.com/lunabora75/contract-negotiation-agent (branch: main)"),
  bullet("Backend: Railway — Dockerfile-based Python 3.12 + FastAPI + Uvicorn"),
  bullet("Frontend: Vercel — Next.js 15.5.14, auto-deployed on push to main"),
  bullet("Environment variables: ANTHROPIC_API_KEY and CORS_ORIGINS set in Railway Variables tab"),
  bullet("NEXT_PUBLIC_API_URL set in Vercel Environment Variables to Railway domain"),

  spacer(80),
  h2("10.2 Deployment Pipeline"),
  bullet("Developer pushes code to GitHub main branch"),
  bullet("Vercel detects push and auto-builds the Next.js frontend (root: frontend/) in ~2 minutes"),
  bullet("Railway detects push and auto-builds the Docker image (root: backend/) in ~3 minutes"),
  bullet("Zero-downtime swap: Railway and Vercel both do blue/green deployment by default"),
  bullet("Health check endpoint: GET /api/health returns {status: ok, model: claude-sonnet-*}"),

  spacer(80),
  h2("10.3 Local Development"),
  p("Run backend:", { bold: true }),
  p("  cd backend && pip install -r requirements.txt && set ANTHROPIC_API_KEY=sk-ant-... && uvicorn main:app --port 8000", { color: DGRAY, size: 18 }),
  spacer(40),
  p("Run frontend:", { bold: true }),
  p("  cd frontend && npm install && set NEXT_PUBLIC_API_URL=http://localhost:8000 && npm run dev", { color: DGRAY, size: 18 }),
];

// ── Assemble document ───────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u25B8", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { color: ORANGE, font: "Arial" } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u2013", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } }, run: { color: DGRAY, font: "Arial" } } },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22, color: NAVY } },
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run:       { size: 32, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run:       { size: 26, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run:       { size: 23, bold: true, font: "Arial", color: ORANGE },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size:   { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: ORANGE, space: 2 } },
          spacing: { after: 0 },
          children: [
            new TextRun({ text: "MResult  |  AI-Powered Contract Negotiation  |  Solution Approach", font: "Arial", size: 18, color: DGRAY }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: MGRAY, space: 2 } },
          spacing: { before: 80 },
          children: [
            new TextRun({ text: "Confidential  |  Page ", font: "Arial", size: 18, color: DGRAY }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: DGRAY }),
            new TextRun({ text: " of ", font: "Arial", size: 18, color: DGRAY }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 18, color: DGRAY }),
          ],
        })],
      }),
    },
    children: [
      ...coverPage,
      ...execSummary,
      ...problemStatement,
      pageBreak(),
      ...solutionOverview,
      pageBreak(),
      ...architecture,
      pageBreak(),
      ...userJourney,
      pageBreak(),
      ...learningLoop,
      pageBreak(),
      ...techStack,
      ...security,
      pageBreak(),
      ...roadmap,
      ...deployment,
    ],
  }],
});

const outPath = path.join(__dirname, "MResult_AI_Contract_Negotiation_Solution_Approach.docx");
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer);
  console.log("Created:", outPath);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
