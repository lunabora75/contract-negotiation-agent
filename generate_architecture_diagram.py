import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.patheffects as pe

fig, ax = plt.subplots(figsize=(20, 14))
ax.set_xlim(0, 20)
ax.set_ylim(0, 14)
ax.axis('off')
fig.patch.set_facecolor('#F8F9FC')

# ── Colour palette ─────────────────────────────────────────────────────────
C_DARK_BLUE  = '#1A2B4A'
C_ORANGE     = '#E86C1E'
C_LIGHT_BLUE = '#D6E4F0'
C_LIGHT_ORG  = '#FDE8D8'
C_GREEN      = '#2E7D32'
C_LIGHT_GRN  = '#D8F0DC'
C_PURPLE     = '#5C35A8'
C_LIGHT_PRP  = '#EAE4F8'
C_GREY       = '#5A5A5A'
C_LIGHT_GRY  = '#EAEAEA'
C_WHITE      = '#FFFFFF'
C_TEAL       = '#00695C'
C_LIGHT_TEL  = '#D8F0EE'

# ── Helper: rounded box ────────────────────────────────────────────────────
def box(ax, x, y, w, h, label, sublabel=None, color=C_WHITE, border=C_DARK_BLUE,
        fontsize=9, bold=True, icon=None):
    rect = FancyBboxPatch((x, y), w, h,
                          boxstyle="round,pad=0.08",
                          facecolor=color, edgecolor=border, linewidth=1.8,
                          zorder=3)
    ax.add_patch(rect)
    cy = y + h / 2 + (0.12 if sublabel else 0)
    txt = ax.text(x + w/2, cy, (icon + '  ' if icon else '') + label,
                  ha='center', va='center', fontsize=fontsize,
                  fontweight='bold' if bold else 'normal',
                  color=C_DARK_BLUE, zorder=4)
    if sublabel:
        ax.text(x + w/2, y + h/2 - 0.22, sublabel,
                ha='center', va='center', fontsize=7.2,
                color=C_GREY, zorder=4, style='italic')
    return rect

# ── Helper: zone (swim-lane background) ────────────────────────────────────
def zone(ax, x, y, w, h, label, color='#EEF2F8', border='#B0BEC5'):
    rect = FancyBboxPatch((x, y), w, h,
                          boxstyle="round,pad=0.15",
                          facecolor=color, edgecolor=border, linewidth=1.2,
                          zorder=1, alpha=0.6)
    ax.add_patch(rect)
    ax.text(x + 0.18, y + h - 0.25, label,
            ha='left', va='top', fontsize=8, fontweight='bold',
            color=border, zorder=2)

# ── Helper: arrow ──────────────────────────────────────────────────────────
def arrow(ax, x1, y1, x2, y2, label='', color=C_DARK_BLUE, style='->', lw=1.5):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle=style, color=color,
                                lw=lw, connectionstyle='arc3,rad=0.0'),
                zorder=5)
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        ax.text(mx, my + 0.14, label, ha='center', va='bottom',
                fontsize=7, color=color, zorder=6,
                bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.85))

def arrow_curve(ax, x1, y1, x2, y2, label='', color=C_DARK_BLUE, rad=0.25, lw=1.5):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='->', color=color,
                                lw=lw, connectionstyle=f'arc3,rad={rad}'),
                zorder=5)
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        ax.text(mx + 0.3, my, label, ha='left', va='center',
                fontsize=7, color=color, zorder=6,
                bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.85))

# ══════════════════════════════════════════════════════════════════════════════
#  TITLE
# ══════════════════════════════════════════════════════════════════════════════
ax.text(10, 13.55, 'CONTRACT NEGOTIATION AGENT', ha='center', va='center',
        fontsize=17, fontweight='bold', color=C_DARK_BLUE)
ax.text(10, 13.15, 'High-Level Solution Architecture', ha='center', va='center',
        fontsize=10, color=C_ORANGE, style='italic')
ax.plot([1, 19], [12.9, 12.9], color=C_ORANGE, lw=2.5)

# ══════════════════════════════════════════════════════════════════════════════
#  ZONES
# ══════════════════════════════════════════════════════════════════════════════
# User zone
zone(ax, 0.3, 10.1, 3.2, 2.45, 'USER / BROWSER', '#EEF2F8', '#78909C')
# Frontend zone
zone(ax, 3.8, 9.8,  5.2, 2.75, 'FRONTEND  (Next.js 15 / React 19 / TypeScript)', '#E3F2FD', '#1565C0')
# Backend zone
zone(ax, 0.3, 5.5,  8.7, 4.0,  'BACKEND  (FastAPI / Python / Uvicorn  —  Port 8000)', '#FFF3E0', '#E65100')
# AI Agent zone
zone(ax, 9.3, 5.5,  6.8, 4.0,  'AI AGENT  (Claude Sonnet  —  Anthropic)', '#EDE7F6', '#4527A0')
# Data zone
zone(ax, 0.3, 0.5,  8.7, 4.7,  'DATA LAYER', '#E8F5E9', '#2E7D32')
# External zone
zone(ax, 9.3, 0.5,  6.8, 4.7,  'EXTERNAL / CLOUD', '#FCE4EC', '#880E4F')

# ══════════════════════════════════════════════════════════════════════════════
#  COMPONENTS — User
# ══════════════════════════════════════════════════════════════════════════════
box(ax, 0.55, 11.2, 2.7,  0.95, 'Buyer / Negotiator', 'Upload SOW, Chat',
    color='#E3F2FD', border='#1565C0', fontsize=8.5)
box(ax, 0.55, 10.2, 2.7,  0.85, 'Approver', 'Review & Approve Terms',
    color='#E3F2FD', border='#1565C0', fontsize=8.5)

# ══════════════════════════════════════════════════════════════════════════════
#  COMPONENTS — Frontend
# ══════════════════════════════════════════════════════════════════════════════
box(ax, 4.0, 11.2,  2.35, 0.95, 'Negotiation UI', 'page.tsx (3-panel layout)',
    color=C_WHITE, border='#1565C0', fontsize=8)
box(ax, 6.55, 11.2, 2.2,  0.95, 'Approval Portal', 'approval/[sessionId]',
    color=C_WHITE, border='#1565C0', fontsize=8)
box(ax, 4.0, 10.05, 4.75, 0.95, 'Markdown Renderer  |  Session History (localStorage)',
    color='#E3F2FD', border='#1565C0', fontsize=7.8, bold=False)

# ══════════════════════════════════════════════════════════════════════════════
#  COMPONENTS — Backend
# ══════════════════════════════════════════════════════════════════════════════
box(ax, 0.55, 8.15, 3.9, 1.0,  'REST API Router', 'main.py  |  FastAPI',
    color=C_LIGHT_ORG, border=C_ORANGE, fontsize=8.5)
box(ax, 4.65, 8.15, 4.1, 1.0,  'Session Manager', 'In-memory SESSIONS dict  |  UUIDs',
    color=C_LIGHT_ORG, border=C_ORANGE, fontsize=8)
box(ax, 0.55, 6.85, 3.9, 1.05, 'File Processor', 'pypdf  |  python-docx  |  TXT\n(max 10 MB)',
    color=C_WHITE, border=C_ORANGE, fontsize=8)
box(ax, 4.65, 6.85, 4.1, 1.05, 'Pydantic Schemas', 'schemas.py\nExtractionResult, BenchmarkResult …',
    color=C_WHITE, border=C_ORANGE, fontsize=8)
box(ax, 0.55, 5.65, 8.2, 0.95, 'API Endpoints:   /sessions   /chat   /summary   /approval   /feedback   /health',
    color='#FFF3E0', border='#BF360C', fontsize=7.8, bold=False)

# ══════════════════════════════════════════════════════════════════════════════
#  COMPONENTS — AI Agent
# ══════════════════════════════════════════════════════════════════════════════
box(ax, 9.55, 8.3,  6.2, 0.85, 'Negotiation Agent', 'agent.py  |  Claude Tool-Use',
    color=C_LIGHT_PRP, border=C_PURPLE, fontsize=8.5)
box(ax, 9.55, 7.25, 1.85, 0.85, 'extract_sow_data', 'Tool 1',
    color=C_WHITE, border=C_PURPLE, fontsize=7.5)
box(ax, 11.6, 7.25, 1.95, 0.85, 'lookup_benchmarks', 'Tool 2',
    color=C_WHITE, border=C_PURPLE, fontsize=7.5)
box(ax, 13.75, 7.25, 1.85, 0.85, 'save_feedback', 'Tool 3',
    color=C_WHITE, border=C_PURPLE, fontsize=7.5)
box(ax, 9.55, 6.1,  6.2, 0.95, 'System Prompt  +  Learning Context\n(p50 open → p75 max | firm tone | last 8 sessions feedback)',
    color='#EDE7F6', border='#7B1FA2', fontsize=7.5, bold=False)
box(ax, 9.55, 5.65, 6.2, 0.3,  'Concession Strategy:   p50 → p75 (standard)   |   p50 → p90 (specialist)',
    color='#F3E5F5', border='#9C27B0', fontsize=7, bold=False)

# ══════════════════════════════════════════════════════════════════════════════
#  COMPONENTS — Data Layer
# ══════════════════════════════════════════════════════════════════════════════
box(ax, 0.55, 3.6,  3.9, 1.3,  'Market Benchmarks', 'data_store.py\n50+ IT roles  |  p25/p50/p75/p90\nFuzzy role matching',
    color=C_LIGHT_GRN, border=C_GREEN, fontsize=8)
box(ax, 4.65, 3.6,  4.1, 1.3,  'Feedback Store', 'data/store.json\nRating, outcome, notes\nLast 8 sessions → learning context',
    color=C_LIGHT_GRN, border=C_GREEN, fontsize=8)
box(ax, 0.55, 1.7,  3.9, 1.65, 'Sample SOWs', 'data/sows/\nsow_above_market.txt\nsow_at_market.txt\nsow_mixed.txt',
    color=C_WHITE, border=C_GREEN, fontsize=8)
box(ax, 4.65, 1.7,  4.1, 1.65, 'benchmarks.json', 'data/benchmarks.json\nAlternate rate reference\n(JSON format)',
    color=C_WHITE, border=C_GREEN, fontsize=8)
box(ax, 0.55, 0.65, 8.2, 0.85, 'data_store.py  —  get_benchmarks()  |  save_feedback()  |  get_learning_context()',
    color='#E8F5E9', border='#1B5E20', fontsize=7.8, bold=False)

# ══════════════════════════════════════════════════════════════════════════════
#  COMPONENTS — External
# ══════════════════════════════════════════════════════════════════════════════
box(ax, 9.55, 3.5,  6.2, 1.5,  'Anthropic API', 'claude-sonnet-4-5\n(configurable via MODEL env var)\nTool-use  |  Multi-turn messages',
    color='#FCE4EC', border='#880E4F', fontsize=8.5)
box(ax, 9.55, 1.6,  2.9, 1.65, 'Railway.app', 'Backend deployment\nDocker container\nrailway.json',
    color=C_WHITE, border='#880E4F', fontsize=8)
box(ax, 12.65, 1.6, 3.1, 1.65, 'Vercel', 'Frontend deployment\nNext.js optimised\nvercel.json',
    color=C_WHITE, border='#880E4F', fontsize=8)
box(ax, 9.55, 0.65, 6.2, 0.75, 'Environment Config:   ANTHROPIC_API_KEY   |   MODEL   |   CORS_ORIGINS   |   NEXT_PUBLIC_API_URL',
    color='#FCE4EC', border='#C62828', fontsize=7.2, bold=False)

# ══════════════════════════════════════════════════════════════════════════════
#  ARROWS
# ══════════════════════════════════════════════════════════════════════════════
# User → Frontend
arrow(ax, 3.25, 11.67, 4.0, 11.67,  'Upload SOW / Chat', color='#1565C0')
arrow(ax, 3.25, 10.62, 4.0, 10.62,  'Review transcript', color='#1565C0')

# Frontend → Backend
arrow(ax, 5.17, 10.05, 3.5, 9.15,   'REST calls', color=C_ORANGE)
arrow(ax, 7.65, 10.05, 6.0, 9.15,   'REST calls', color=C_ORANGE)

# Backend → AI Agent
arrow(ax, 8.75, 8.65, 9.55, 8.65,   'run_turn(messages)', color=C_PURPLE)

# AI Agent → Anthropic
arrow(ax, 12.65, 6.1, 12.65, 5.0,   'Messages API', color='#880E4F')

# Backend → Data Store
arrow(ax, 4.60, 7.37, 4.60, 4.9,    'read benchmarks\nwrite feedback', color=C_GREEN, lw=1.4)

# AI Tools → Data Store
arrow(ax, 11.52, 7.25, 4.75, 4.9,   '', color=C_GREEN, lw=1.2)
ax.text(7.8, 6.35, 'lookup / save', ha='center', fontsize=7, color=C_GREEN, style='italic')

# Backend internal
arrow(ax, 4.50, 8.65, 4.65, 8.65,   '', color=C_ORANGE, lw=1.2)
arrow(ax, 2.50, 8.15, 2.50, 7.9,    '', color=C_ORANGE, lw=1.2)

# Deployment arrows (dashed style)
ax.annotate('', xy=(10.0, 5.5), xytext=(10.0, 5.0),
            arrowprops=dict(arrowstyle='->', color='#880E4F', lw=1.2,
                            linestyle='dashed'), zorder=5)

# ══════════════════════════════════════════════════════════════════════════════
#  LEGEND
# ══════════════════════════════════════════════════════════════════════════════
legend_x, legend_y = 16.3, 12.5
ax.text(legend_x, legend_y, 'LEGEND', fontsize=8, fontweight='bold', color=C_DARK_BLUE)
items = [
    (C_LIGHT_BLUE,  '#1565C0',  'Frontend Layer'),
    (C_LIGHT_ORG,   C_ORANGE,   'Backend / API Layer'),
    (C_LIGHT_PRP,   C_PURPLE,   'AI Agent Layer'),
    (C_LIGHT_GRN,   C_GREEN,    'Data Layer'),
    ('#FCE4EC',     '#880E4F',  'External / Cloud'),
]
for i, (fc, ec, lbl) in enumerate(items):
    ry = legend_y - 0.55 - i * 0.52
    r = FancyBboxPatch((legend_x, ry), 0.45, 0.35,
                       boxstyle='round,pad=0.05',
                       facecolor=fc, edgecolor=ec, linewidth=1.5, zorder=3)
    ax.add_patch(r)
    ax.text(legend_x + 0.6, ry + 0.17, lbl, va='center',
            fontsize=7.5, color=C_GREY)

# data flow arrow in legend
ax.annotate('', xy=(legend_x + 0.45, legend_y - 3.45),
            xytext=(legend_x, legend_y - 3.45),
            arrowprops=dict(arrowstyle='->', color=C_DARK_BLUE, lw=1.5), zorder=5)
ax.text(legend_x + 0.6, legend_y - 3.45, 'Data / Control Flow', va='center',
        fontsize=7.5, color=C_GREY)

# ══════════════════════════════════════════════════════════════════════════════
#  FOOTER
# ══════════════════════════════════════════════════════════════════════════════
ax.plot([0.3, 19.7], [0.38, 0.38], color=C_ORANGE, lw=1.5)
ax.text(0.3, 0.22, 'Contract Negotiation Agent  |  High-Level Architecture  |  v1.0  |  April 2026',
        fontsize=7.5, color=C_GREY, va='center')
ax.text(19.7, 0.22, 'INTERNAL / CONFIDENTIAL', fontsize=7.5, color=C_GREY,
        va='center', ha='right')

plt.tight_layout(pad=0.2)
out = '/home/user/contract-negotiation-agent/Contract_Negotiation_Agent_Architecture.png'
plt.savefig(out, dpi=180, bbox_inches='tight', facecolor='#F8F9FC')
plt.close()
print(f'Saved: {out}')
