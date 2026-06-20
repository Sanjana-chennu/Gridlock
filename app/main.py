"""
Vyuha — Main Streamlit Entry Point
BTP Parking Intelligence & Resource Optimization Command Center
"""

# pyrefly: ignore [missing-import]
import streamlit as st

st.set_page_config(
    page_title="Vyuha — BTP Command Center",
    page_icon="🚔",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Global CSS ────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

/* Base */
html, body, [class*="css"] { font-family: 'Inter', sans-serif; }

.stApp {
    background: #0a0d14;
    color: #e2e8f0;
}

/* Sidebar */
[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #0f1623 0%, #0a0d14 100%);
    border-right: 1px solid #1e2a3a;
}
[data-testid="stSidebar"] .block-container { padding-top: 1rem; }

/* Metric cards */
[data-testid="metric-container"] {
    background: linear-gradient(135deg, #111827 0%, #1a2234 100%);
    border: 1px solid #1e3a5f;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
[data-testid="metric-container"] label { color: #64748b !important; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; }
[data-testid="metric-container"] [data-testid="stMetricValue"] { color: #f8fafc !important; font-weight: 700; }

/* Buttons */
.stButton > button {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    letter-spacing: 0.02em;
    padding: 0.6rem 1.4rem;
    transition: all 0.2s ease;
    box-shadow: 0 4px 15px rgba(37,99,235,0.3);
}
.stButton > button:hover {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(37,99,235,0.45);
}

/* Tabs */
.stTabs [data-baseweb="tab-list"] {
    background: #111827;
    border-radius: 10px;
    padding: 4px;
    gap: 2px;
    border: 1px solid #1e2a3a;
}
.stTabs [data-baseweb="tab"] {
    color: #64748b;
    font-weight: 500;
    border-radius: 8px;
    padding: 0.5rem 1.2rem;
}
.stTabs [aria-selected="true"] {
    background: linear-gradient(135deg, #1e3a5f 0%, #1e4080 100%) !important;
    color: #60a5fa !important;
}

/* Dataframe */
[data-testid="stDataFrame"] { border-radius: 10px; overflow: hidden; }
.stDataFrame thead tr th { background: #111827 !important; color: #60a5fa !important; }

/* Selectbox / Slider */
[data-testid="stSelectbox"] > div, [data-testid="stSlider"] > div {
    background: #111827;
    border-radius: 8px;
}
.stSlider [data-baseweb="slider"] { margin: 0.5rem 0; }

/* Divider */
hr { border-color: #1e2a3a; }

/* Custom card */
.vyuha-card {
    background: linear-gradient(135deg, #111827 0%, #1a2234 100%);
    border: 1px solid #1e3a5f;
    border-radius: 14px;
    padding: 1.2rem 1.4rem;
    margin-bottom: 1rem;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}
.vyuha-badge-red    { background: #7f1d1d; color: #fca5a5; padding: 2px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
.vyuha-badge-yellow { background: #78350f; color: #fcd34d; padding: 2px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
.vyuha-badge-green  { background: #064e3b; color: #6ee7b7; padding: 2px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
.vyuha-badge-blue   { background: #1e3a5f; color: #93c5fd; padding: 2px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }

/* Alert */
.vyuha-alert {
    background: linear-gradient(135deg, #1e1a0e 0%, #292207 100%);
    border-left: 4px solid #f59e0b;
    border-radius: 0 10px 10px 0;
    padding: 1rem 1.2rem;
    margin: 0.8rem 0;
    font-size: 0.9rem;
    color: #fcd34d;
}
.vyuha-success {
    background: linear-gradient(135deg, #052e16 0%, #064e3b 100%);
    border-left: 4px solid #10b981;
    border-radius: 0 10px 10px 0;
    padding: 1rem 1.2rem;
    margin: 0.8rem 0;
    font-size: 0.9rem;
    color: #6ee7b7;
}
.vyuha-danger {
    background: linear-gradient(135deg, #1c0a0a 0%, #2d1111 100%);
    border-left: 4px solid #ef4444;
    border-radius: 0 10px 10px 0;
    padding: 1rem 1.2rem;
    margin: 0.8rem 0;
    font-size: 0.9rem;
    color: #fca5a5;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #0a0d14; }
::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }
</style>
""", unsafe_allow_html=True)

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("""
    <div style="padding: 0.5rem 0 1.5rem 0;">
        <div style="font-size:1.8rem; font-weight:800; 
                    background: linear-gradient(135deg, #60a5fa, #a78bfa);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            🚔 VYUHA
        </div>
        <div style="color:#64748b; font-size:0.78rem; letter-spacing:0.12em; 
                    text-transform:uppercase; margin-top:2px;">
            BTP Parking Intelligence
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("---")
    st.markdown("<p style='color:#64748b;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.1em;'>Navigation</p>", unsafe_allow_html=True)

    page = st.radio(
        "Select Engine",
        ["⚡ Engine 1 — Tactical Ops", "🏛️ Engine 2 — Structural Policy", "📊 Engine 3 — Rejection Audit"],
        label_visibility="collapsed"
    )

    st.markdown("---")
    st.markdown("""
    <div class="vyuha-card" style="margin-top:0.5rem;">
        <div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;">Live Status</div>
        <div style="margin-top:0.6rem;">
            <span style="color:#10b981;font-size:0.85rem;">● </span>
            <span style="font-size:0.82rem;color:#94a3b8;">Data: Loaded</span>
        </div>
        <div style="margin-top:0.3rem;">
            <span style="color:#10b981;font-size:0.85rem;">● </span>
            <span style="font-size:0.82rem;color:#94a3b8;">ASTraM: Ready</span>
        </div>
        <div style="margin-top:0.3rem;">
            <span style="color:#f59e0b;font-size:0.85rem;">● </span>
            <span style="font-size:0.82rem;color:#94a3b8;">BBMP Agent: Standby</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("""
    <div style="position:fixed;bottom:1rem;left:1rem;right:1rem;font-size:0.7rem;color:#374151;text-align:center;">
        Vyuha v1.0 · Built for BTP · 2024
    </div>
    """, unsafe_allow_html=True)

# ── Route to page ─────────────────────────────────────────────────────────────
if "Engine 1" in page:
    import importlib.util, sys, os
    spec = importlib.util.spec_from_file_location(
        "tactical_ops",
        os.path.join(os.path.dirname(__file__), "pages", "01_tactical_ops.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
elif "Engine 2" in page:
    import importlib.util, sys, os
    spec = importlib.util.spec_from_file_location(
        "structural",
        os.path.join(os.path.dirname(__file__), "pages", "02_structural.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
else:
    import importlib.util, sys, os
    spec = importlib.util.spec_from_file_location(
        "rejection_audit",
        os.path.join(os.path.dirname(__file__), "pages", "03_rejection_audit.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

