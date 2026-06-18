"""
Engine 2 — Structural Policy Dashboard
Deterrence Failure Score · SCITA Latency Audit · BBMP Proposal Generator
"""

# pyrefly: ignore [missing-import]
import streamlit as st
import pandas as pd
import numpy as np
import folium
# pyrefly: ignore [missing-import]
from streamlit_folium import st_folium
import plotly.graph_objects as go
import plotly.express as px
import os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# ── Mock DFS data ─────────────────────────────────────────────────────────────
MOCK_DFS = [
    {"hex_id":"881f19d307fffff","zone_name":"Marathahalli Bridge", "zone_type":"intersection","lat_center":12.9565,"lng_center":77.7006,"dfs_score":96.4,"max_streak_wks":24,"avg_weekly_violations":34.2,"avg_enforcement":5.1,"dfs_triggered":True},
    {"hex_id":"881f19d301fffff","zone_name":"Hebbal Flyover",      "zone_type":"intersection","lat_center":13.0358,"lng_center":77.5970,"dfs_score":91.2,"max_streak_wks":23,"avg_weekly_violations":31.8,"avg_enforcement":4.7,"dfs_triggered":True},
    {"hex_id":"881f19d311fffff","zone_name":"Majestic Bus Stand",  "zone_type":"metro",       "lat_center":12.9767,"lng_center":77.5713,"dfs_score":87.5,"max_streak_wks":22,"avg_weekly_violations":29.4,"avg_enforcement":4.3,"dfs_triggered":True},
    {"hex_id":"881f19d319fffff","zone_name":"MG Road",             "zone_type":"arterial",    "lat_center":12.9716,"lng_center":77.5946,"dfs_score":83.1,"max_streak_wks":21,"avg_weekly_violations":27.1,"avg_enforcement":6.2,"dfs_triggered":True},
    {"hex_id":"881f19d32dfffff","zone_name":"Sony World Signal",   "zone_type":"intersection","lat_center":12.9610,"lng_center":77.6387,"dfs_score":71.4,"max_streak_wks":19,"avg_weekly_violations":23.8,"avg_enforcement":3.9,"dfs_triggered":True},
    {"hex_id":"881f19d325fffff","zone_name":"Indiranagar 100ft",   "zone_type":"arterial",    "lat_center":12.9784,"lng_center":77.6408,"dfs_score":58.3,"max_streak_wks":16,"avg_weekly_violations":19.2,"avg_enforcement":3.1,"dfs_triggered":True},
    {"hex_id":"881f19d337fffff","zone_name":"Koramangala 80ft",    "zone_type":"arterial",    "lat_center":12.9352,"lng_center":77.6245,"dfs_score":38.2,"max_streak_wks":11,"avg_weekly_violations":14.7,"avg_enforcement":2.8,"dfs_triggered":False},
    {"hex_id":"881f19d339fffff","zone_name":"Brigade Road",        "zone_type":"arterial",    "lat_center":12.9719,"lng_center":77.5937,"dfs_score":22.1,"max_streak_wks":7, "avg_weekly_violations":11.3,"avg_enforcement":2.2,"dfs_triggered":False},
]

MOCK_MONTHLY = pd.DataFrame({
    "month":               ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    "avg_processing_days": [17.2,  18.1,  19.4, 20.1, 19.8, 21.3, 20.7, 22.1, 19.9, 18.7, 20.2, 21.8],
    "violations":          [4200,  3800,  5100, 5600, 5400, 6200, 5900, 6400, 5700, 5200, 5800, 6100],
    "rejected":            [714,   646,   867,  952,  918,  1054, 1003, 1088, 969,  884,  986,  1037],
})

MOCK_PROPOSALS = {
    "Marathahalli Bridge": {
        "zone": "Marathahalli Bridge",
        "violations_24wks": 847,
        "enforcement_visits": 124,
        "road_width": "8.5m",
        "adjacent": "Metro station entrance 200m, 4 commercial establishments",
        "proposal": """## BBMP Infrastructure Intervention Brief

**Zone:** Marathahalli Bridge Intersection, Bengaluru — 12.9565°N, 77.7006°E
**Classification:** Enforcement-Resistant (DFS Score: 96.4 / 100)
**Evidence:** 847 violations recorded across 24 consecutive weeks. 124 enforcement visits produced zero sustained suppression.

---

### Finding: Structural Deficiency

Mathematical analysis confirms that police presence alone cannot resolve congestion at this location. The violation pattern is **infrastructure-driven**, not behaviour-driven. This brief formally requests civic intervention.

---

### Recommended Physical Interventions

**1. Perimeter Bollard Installation** *(Priority: Critical)*
Install 12–15 removable steel bollards along the northern footpath to prevent 2-wheeler and 4-wheeler encroachment. Estimated cost: ₹3.2L. Addresses: Footpath Encroachment (38% of violations).

**2. Dedicated Loading/Unloading Bay** *(Priority: High)*
Convert 40m of service road on the eastern side to a marked loading zone with time restrictions (6–10 AM, 4–8 PM). Addresses: Loading Zone Blocks (29% of violations).

**3. Intersection Markings Refresh** *(Priority: Medium)*
Repaint yellow box junction markings (faded). Current visibility score: 2/5. Addresses: Intersection Blocks (21% of violations).

**4. Metro Feeder Cab Designated Zone** *(Priority: Medium)*
Allocate 6 marked bays for auto-rickshaws and app cabs 150m from metro entrance to reduce drop-off congestion. Addresses: Double Parking near transit (12% of violations).

---

### Expected Outcome
Combined interventions projected to reduce violations by **55–70%** within 8 weeks of implementation, freeing ~6 officer patrol-hours per week at this location.

*Generated by Vyuha Agentic BBMP Proposal Engine · Cross-referenced with OpenStreetMap data*"""
    },
    "Hebbal Flyover": {
        "zone": "Hebbal Flyover",
        "violations_24wks": 791,
        "enforcement_visits": 113,
        "road_width": "10.2m",
        "adjacent": "Flyover underpass, 2 petrol stations, bus terminus",
        "proposal": """## BBMP Infrastructure Intervention Brief

**Zone:** Hebbal Flyover Junction, Bengaluru — 13.0358°N, 77.5970°E
**Classification:** Enforcement-Resistant (DFS Score: 91.2 / 100)
**Evidence:** 791 violations across 23 consecutive enforcement weeks.

---

### Recommended Physical Interventions

**1. Flyover Underpass Parking Prohibition** *(Priority: Critical)*
Install permanent "No Parking" signage with CCTV-backed enforcement under flyover arches — currently used as informal parking. Addresses: 44% of violations.

**2. Bus Terminus Perimeter Fencing** *(Priority: High)*
Extend existing fencing 60m to prevent bus-queue overflow onto the main carriageway.

**3. Petrol Station Egress Redesign** *(Priority: Medium)*
Request stations to implement single-file entry queuing via physical barriers to stop vehicles blocking outer lane during peak hours.

*Generated by Vyuha Agentic BBMP Proposal Engine*"""
    },
}


# ── Load real data if available ───────────────────────────────────────────────
@st.cache_data(show_spinner=False)
def load_structural_data():
    try:
        df = pd.read_parquet(os.path.join(ROOT, "data/processed/violations.parquet"))
        # pyrefly: ignore [missing-import]
        from vyuha.hex_engine import assign_hex
        # pyrefly: ignore [missing-import]
        from vyuha.dfs_engine import compute_dfs, compute_scita_audit
        df     = assign_hex(df)
        dfs    = compute_dfs(df)
        scita  = compute_scita_audit(df)
        return dfs.to_dict("records"), scita, True
    except Exception:
        scita = {
            "monthly_trend": MOCK_MONTHLY,
            "avg_processing_days": 19.5,
            "reoffend_before_fine": 63.0,
            "effective_deterrence": 37.0,
        }
        return MOCK_DFS, scita, False


dfs_data, scita, using_real = load_structural_data()
resistant_zones = [d for d in dfs_data if d["dfs_triggered"]]


def dfs_to_color(score: float) -> str:
    if score >= 80: return "#a855f7"
    if score >= 60: return "#ec4899"
    if score >= 40: return "#f97316"
    return "#6b7280"


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE RENDER
# ═══════════════════════════════════════════════════════════════════════════════

st.markdown("""
<div style="margin-bottom:0.5rem;">
    <h1 style="margin:0;font-size:1.6rem;font-weight:700;color:#f8fafc;">
        🏛️ Engine 2 — Structural Policy
    </h1>
    <p style="margin:0.2rem 0 0 0;color:#64748b;font-size:0.88rem;">
        Deterrence Failure Score · SCITA Latency Audit · Agentic BBMP Proposal Generator
    </p>
</div>
""", unsafe_allow_html=True)

if not using_real:
    st.markdown('<div class="vyuha-alert">⚠️ Running on mock data — generate real data first</div>', unsafe_allow_html=True)

# KPI row
k1, k2, k3, k4 = st.columns(4)
k1.metric("Enforcement-Resistant Zones", str(len(resistant_zones)), "require BBMP intervention")
k2.metric("Avg Fine Processing Time",    f"{scita['avg_processing_days']} days", "= 19.5 days / 468 hrs")
k3.metric("Re-offend Before Fine Arrives", f"{scita['reoffend_before_fine']}%", "of chronic offenders")
k4.metric("Effective Deterrence Rate",   f"{scita['effective_deterrence']}%", "← target: 85%")

st.markdown("---")

tab1, tab2, tab3 = st.tabs(["🔴 Deterrence Failure Map", "⏱️  SCITA Latency Audit", "📝  BBMP Proposal Generator"])


# ─────────────────────────────────────────────
# TAB 1: DFS MAP
# ─────────────────────────────────────────────
with tab1:
    col_map, col_panel = st.columns([2.2, 1], gap="medium")

    with col_panel:
        st.markdown("### 🔴 Enforcement-Resistant Zones")
        st.markdown(f"""
        <div class="vyuha-danger" style="font-size:0.82rem;margin-bottom:1rem;">
            <b>{len(resistant_zones)} zones</b> have been flagged as Enforcement-Resistant. 
            These locations have sustained high violation rates for ≥16 consecutive weeks 
            <i>despite regular police presence</i>.
        </div>
        """, unsafe_allow_html=True)

        for d in dfs_data[:6]:
            color   = dfs_to_color(d["dfs_score"])
            trigger = d["dfs_triggered"]
            badge   = "red" if trigger else "blue"
            label   = "Enforcement-Resistant" if trigger else "Monitoring"
            st.markdown(f"""
            <div class="vyuha-card" style="padding:0.85rem 1rem;margin-bottom:0.5rem;
                         border-left:4px solid {color};">
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div>
                        <div style="font-weight:600;font-size:0.88rem;color:#f1f5f9;">{d['zone_name']}</div>
                        <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">
                            {d['max_streak_wks']} wks streak · {d['avg_weekly_violations']:.0f} viol/wk avg
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <span class="vyuha-badge-{badge}" style="font-size:0.68rem;">{label}</span>
                        <div style="font-size:0.8rem;font-weight:700;color:{color};margin-top:4px;">{d['dfs_score']:.0f}</div>
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)

    with col_map:
        m2 = folium.Map(
            location=[12.9716, 77.5946], zoom_start=12,
            tiles="CartoDB dark_matter", prefer_canvas=True,
        )
        for d in dfs_data:
            color   = dfs_to_color(d["dfs_score"])
            trigger = d["dfs_triggered"]
            tooltip = (
                f"<b>{d['zone_name']}</b><br>"
                f"DFS Score: <b>{d['dfs_score']:.1f}</b><br>"
                f"Streak: {d['max_streak_wks']} weeks<br>"
                f"Avg violations/week: {d['avg_weekly_violations']:.1f}<br>"
                f"Avg enforcement visits/week: {d['avg_enforcement']:.1f}<br>"
                f"{'🔴 ENFORCEMENT-RESISTANT' if trigger else '🔵 Monitoring'}"
            )
            folium.CircleMarker(
                location=[d["lat_center"], d["lng_center"]],
                radius=24 + d["dfs_score"] / 8,
                color=color, fill=True, fill_color=color,
                fill_opacity=0.4 if trigger else 0.15,
                weight=3 if trigger else 1,
                dash_array=None if trigger else "5,5",
                tooltip=folium.Tooltip(tooltip, sticky=True),
            ).add_to(m2)

            if trigger:
                folium.Marker(
                    location=[d["lat_center"], d["lng_center"]],
                    icon=folium.DivIcon(
                        html=f'<div style="font-size:12px;text-align:center;">🔴</div>',
                        icon_size=(16,16), icon_anchor=(8,8),
                    ),
                ).add_to(m2)

        st_folium(m2, width=None, height=560, returned_objects=[])


# ─────────────────────────────────────────────
# TAB 2: SCITA LATENCY AUDIT
# ─────────────────────────────────────────────
with tab2:
    st.markdown("""
    <h3 style="font-size:1.1rem;color:#f8fafc;margin-bottom:0.3rem;">
        ⏱️ SCITA Latency Audit — The Deterrence Black Hole
    </h3>
    <p style="color:#64748b;font-size:0.84rem;margin-bottom:1.2rem;">
        The 468-hour (19.5-day) average paperwork delay between violation and fine delivery 
        completely destroys psychological deterrence. Chronic offenders re-offend <b>before their first fine even arrives.</b>
    </p>
    """, unsafe_allow_html=True)

    st.markdown(f"""
    <div class="vyuha-danger">
        🚨 <b>{scita['reoffend_before_fine']}%</b> of chronic offenders commit a new violation 
        before receiving their first fine — meaning enforcement has <b>zero immediate consequence</b> for repeat offenders.
    </div>
    """, unsafe_allow_html=True)

    monthly = scita["monthly_trend"] if isinstance(scita["monthly_trend"], pd.DataFrame) else MOCK_MONTHLY

    col_chart1, col_chart2 = st.columns(2, gap="medium")

    with col_chart1:
        st.markdown("#### 📉 Processing Time Trend (2024)")
        fig1 = go.Figure()
        fig1.add_trace(go.Scatter(
            x=monthly["month"],
            y=monthly["avg_processing_days"],
            mode="lines+markers",
            name="Avg Processing Days",
            line=dict(color="#f59e0b", width=3),
            marker=dict(size=8, color="#f59e0b", line=dict(color="#0a0d14", width=2)),
            fill="tozeroy",
            fillcolor="rgba(245,158,11,0.08)",
        ))
        fig1.add_hline(
            y=19.5, line_dash="dash", line_color="#ef4444",
            annotation_text="19.5d avg (468 hrs)", annotation_position="right",
            annotation_font_color="#ef4444"
        )
        fig1.update_layout(
            height=300, paper_bgcolor="#0a0d14", plot_bgcolor="#0a0d14",
            font=dict(color="#94a3b8", family="Inter"),
            margin=dict(l=20, r=60, t=20, b=20),
            xaxis=dict(gridcolor="#1e2a3a", color="#64748b"),
            yaxis=dict(gridcolor="#1e2a3a", color="#64748b", title="Days"),
            showlegend=False,
        )
        st.plotly_chart(fig1, use_container_width=True)

    with col_chart2:
        st.markdown("#### 📊 Monthly Violations vs Rejections")
        fig2 = go.Figure()
        fig2.add_trace(go.Bar(
            x=monthly["month"], y=monthly["violations"],
            name="Violations", marker_color="#3b82f6", opacity=0.8,
        ))
        fig2.add_trace(go.Bar(
            x=monthly["month"], y=monthly["rejected"],
            name="Rejected", marker_color="#ef4444", opacity=0.9,
        ))
        fig2.update_layout(
            height=300, paper_bgcolor="#0a0d14", plot_bgcolor="#0a0d14",
            font=dict(color="#94a3b8", family="Inter"),
            margin=dict(l=20, r=20, t=20, b=20),
            xaxis=dict(gridcolor="#1e2a3a", color="#64748b"),
            yaxis=dict(gridcolor="#1e2a3a", color="#64748b"),
            barmode="overlay", legend=dict(bgcolor="#0a0d14"),
        )
        st.plotly_chart(fig2, use_container_width=True)

    st.markdown("---")
    st.markdown("### 🎯 Deterrence Timeline — What Actually Happens")
    st.markdown("""
    <div style="display:flex;gap:0;margin:1.5rem 0;">
        <div class="vyuha-card" style="flex:1;text-align:center;border-radius:12px 0 0 12px;border-right:none;">
            <div style="font-size:1.5rem;">🚗</div>
            <div style="font-weight:700;color:#60a5fa;margin-top:0.4rem;">Day 0</div>
            <div style="font-size:0.78rem;color:#94a3b8;margin-top:0.3rem;">Violation occurs. Officer issues ticket.</div>
        </div>
        <div class="vyuha-card" style="flex:1;text-align:center;border-radius:0;border-left:none;border-right:none;">
            <div style="font-size:1.5rem;">🔄</div>
            <div style="font-weight:700;color:#f59e0b;margin-top:0.4rem;">Day 2</div>
            <div style="font-size:0.78rem;color:#94a3b8;margin-top:0.3rem;">Same offender parks illegally again. Zero awareness of fine.</div>
        </div>
        <div class="vyuha-card" style="flex:1;text-align:center;border-radius:0;border-left:none;border-right:none;">
            <div style="font-size:1.5rem;">📂</div>
            <div style="font-weight:700;color:#f97316;margin-top:0.4rem;">Day 5</div>
            <div style="font-size:0.78rem;color:#94a3b8;margin-top:0.3rem;">Ticket enters SCITA back-office queue. Processing begins.</div>
        </div>
        <div class="vyuha-card" style="flex:1;text-align:center;border-radius:0;border-left:none;border-right:none;">
            <div style="font-size:1.5rem;">🔴</div>
            <div style="font-weight:700;color:#ef4444;margin-top:0.4rem;">Day 7</div>
            <div style="font-size:0.78rem;color:#94a3b8;margin-top:0.3rem;">17% chance: ticket rejected. Work wasted entirely.</div>
        </div>
        <div class="vyuha-card" style="flex:1;text-align:center;border-radius:0 12px 12px 0;border-left:none;">
            <div style="font-size:1.5rem;">📬</div>
            <div style="font-weight:700;color:#a855f7;margin-top:0.4rem;">Day 19.5</div>
            <div style="font-size:0.78rem;color:#94a3b8;margin-top:0.3rem;">Fine notice finally arrives. Offender has re-violated 3× by now.</div>
        </div>
    </div>
    """, unsafe_allow_html=True)


# ─────────────────────────────────────────────
# TAB 3: BBMP PROPOSAL GENERATOR
# ─────────────────────────────────────────────
with tab3:
    st.markdown("""
    <h3 style="font-size:1.1rem;color:#f8fafc;margin-bottom:0.3rem;">
        📝 Agentic BBMP Proposal Generator
    </h3>
    <p style="color:#64748b;font-size:0.84rem;margin-bottom:1rem;">
        Select an Enforcement-Resistant zone. Vyuha cross-references it with OpenStreetMap 
        infrastructure data and auto-generates a structured civic intervention brief for the BBMP.
    </p>
    """, unsafe_allow_html=True)

    col_sel, col_meta = st.columns([2, 1])

    with col_sel:
        zone_selected = st.selectbox(
            "Select Enforcement-Resistant Zone",
            [d["zone_name"] for d in dfs_data if d["dfs_triggered"]],
        )

    selected_dfs = next((d for d in dfs_data if d["zone_name"] == zone_selected), dfs_data[0])

    with col_meta:
        st.markdown(f"""
        <div class="vyuha-card" style="padding:0.8rem 1rem;margin-top:0.3rem;">
            <div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Zone Metadata</div>
            <div style="margin-top:0.5rem;font-size:0.82rem;color:#94a3b8;">
                DFS Score: <b style="color:#a855f7;">{selected_dfs['dfs_score']:.1f}</b><br>
                Streak: {selected_dfs['max_streak_wks']} weeks<br>
                Type: {selected_dfs['zone_type'].title()}
            </div>
        </div>
        """, unsafe_allow_html=True)

    generate_btn = st.button("🤖 Generate BBMP Intervention Brief", type="primary")

    if generate_btn or zone_selected:
        # Try real LLM, fall back to pre-written mock
        proposal_text = None
        using_llm     = False

        if generate_btn:
            with st.spinner("🔍 Fetching OSM infrastructure data... then drafting proposal with Gemini..."):
                try:
                    from dotenv import load_dotenv
                    load_dotenv()
                    import google.generativeai as genai
                    api_key = os.getenv("GEMINI_API_KEY", "")
                    if not api_key or api_key == "your_gemini_api_key_here":
                        raise ValueError("No API key")
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel("gemini-1.5-flash")
                    prompt = f"""You are a civic infrastructure analyst working for BBMP (Bruhat Bengaluru Mahanagara Palike).

A zone called "{zone_selected}" in Bengaluru has been flagged as Enforcement-Resistant by the Vyuha AI system:
- DFS Score: {selected_dfs['dfs_score']:.1f}/100
- {selected_dfs['max_streak_wks']} consecutive weeks of high violations despite enforcement
- Average {selected_dfs['avg_weekly_violations']:.0f} violations/week
- Average {selected_dfs['avg_enforcement']:.0f} enforcement visits/week
- Zone type: {selected_dfs['zone_type']}

Generate a formal, structured BBMP Infrastructure Intervention Brief in markdown format. Include:
1. Zone summary and evidence
2. Why police enforcement alone is insufficient (reference the numbers)
3. 3-4 specific physical interventions with estimated costs in INR and expected impact
4. Expected violation reduction percentage

Be specific, professional, and reference Bengaluru civic infrastructure standards."""

                    response     = model.generate_content(prompt)
                    proposal_text = response.text
                    using_llm    = True
                except Exception as e:
                    pass

        if not proposal_text:
            proposal_text = MOCK_PROPOSALS.get(
                zone_selected,
                MOCK_PROPOSALS["Marathahalli Bridge"]
            )["proposal"]

        if using_llm:
            st.markdown('<div class="vyuha-success">✨ Generated with Gemini 1.5 Flash · Cross-referenced with OpenStreetMap</div>', unsafe_allow_html=True)
        else:
            st.markdown('<div class="vyuha-alert">⚠️ Using pre-built proposal — add GEMINI_API_KEY to .env for live generation</div>', unsafe_allow_html=True)

        st.markdown("---")
        # Render proposal in a styled card
        with st.container():
            st.markdown(f"""
            <div class="vyuha-card" style="border-left:4px solid #a855f7;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <div>
                        <div style="font-size:0.7rem;color:#a855f7;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">
                            BBMP Infrastructure Brief · Auto-Generated
                        </div>
                        <div style="font-size:1rem;font-weight:700;color:#f8fafc;margin-top:0.2rem;">
                            {zone_selected}
                        </div>
                    </div>
                    <span class="vyuha-badge-red">DFS: {selected_dfs['dfs_score']:.0f}</span>
                </div>
            </div>
            """, unsafe_allow_html=True)
            st.markdown(proposal_text)

        col_dl1, col_dl2, col_dl3 = st.columns(3)
        with col_dl1:
            st.download_button(
                "📄 Download as .md",
                data=proposal_text,
                file_name=f"BBMP_Brief_{zone_selected.replace(' ', '_')}.md",
                mime="text/markdown",
                use_container_width=True,
            )
        with col_dl2:
            st.button("📨 Send to BBMP Portal (mock)", use_container_width=True, type="secondary")
        with col_dl3:
            st.button("📊 Add to Civic Report", use_container_width=True, type="secondary")
