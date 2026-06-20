"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/* ── Animated Counter ─────────────────────────────────────────── */
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const duration = 1500;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);
  return <>{value.toLocaleString()}{suffix}</>;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Page Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 14, color: "#888" }}>
          298,450 real violations · Nov 2023 – Apr 2024 · 43 police stations
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { icon: "🚗", label: "Total Violations", value: 298450, suffix: "", color: "#2563eb" },
          { icon: "🔴", label: "Enforcement Zones", value: 55, suffix: "", color: "#dc2626" },
          { icon: "⏱️", label: "Avg Processing", value: 4, suffix: " days", color: "#d97706" },
          { icon: "🚔", label: "Repeat Offenders", value: 3489, suffix: "", color: "#16a34a" },
        ].map((kpi, i) => (
          <div key={i} className="stat-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: `${kpi.color}12`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {kpi.icon}
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#888", fontWeight: 500, marginBottom: 2 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color }}>
                {mounted ? <AnimatedNumber target={kpi.value} suffix={kpi.suffix} /> : "—"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: Quick Actions + Key Insight */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
        {/* Quick Actions */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 20 }}>
            Quick Actions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link href="/tactical" style={{ textDecoration: "none" }}>
              <div
                className="card"
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 22 }}>🗺️</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>
                      View Patrol Map
                    </div>
                    <div style={{ fontSize: 13, color: "#888" }}>
                      See hotspots, routes & chronic offenders
                    </div>
                  </div>
                </div>
                <span style={{ color: "#ccc", fontSize: 18 }}>→</span>
              </div>
            </Link>

            <Link href="/structural" style={{ textDecoration: "none" }}>
              <div
                className="card"
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 22 }}>📋</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>
                      Policy Analysis
                    </div>
                    <div style={{ fontSize: 13, color: "#888" }}>
                      DFS scores, SCITA delays & BBMP proposals
                    </div>
                  </div>
                </div>
                <span style={{ color: "#ccc", fontSize: 18 }}>→</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Key Insight */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 20 }}>
            Key Finding
          </h2>

          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 36, fontWeight: 800, color: "#dc2626", marginBottom: 4 }}>
              -0.052
            </div>
            <div style={{ fontSize: 14, color: "#991b1b", lineHeight: 1.6 }}>
              Correlation between enforcement and violation reduction.
              <strong> More tickets ≠ fewer violations.</strong> The top 50 zones have been violating for 24 weeks straight despite constant policing.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: "#fffbeb", borderRadius: 10, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#d97706" }}>97 hrs</div>
              <div style={{ fontSize: 12, color: "#92400e", marginTop: 2 }}>Avg processing time</div>
            </div>
            <div style={{ background: "#fef2f2", borderRadius: 10, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#dc2626" }}>16.7%</div>
              <div style={{ fontSize: 12, color: "#991b1b", marginTop: 2 }}>Ticket rejection rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* What This System Does */}
      <div className="card" style={{ padding: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
          How Vyuha Helps
        </h2>
        <p style={{ fontSize: 14, color: "#888", marginBottom: 20 }}>
          Two engines working together — one for daily patrol, one for long-term infrastructure fixes.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ padding: 20, background: "#eff6ff", borderRadius: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e40af", marginBottom: 8 }}>
              ⚡ Engine 1 — Tactical Ops
            </div>
            <ul style={{ fontSize: 13, color: "#1e3a5f", lineHeight: 2, paddingLeft: 18, margin: 0 }}>
              <li>High-ROI hex beat map with patrol routes</li>
              <li>Chronic offender registry (top repeat violators)</li>
              <li>ASTraM AI — predicts if a ticket will get rejected</li>
            </ul>
          </div>
          <div style={{ padding: 20, background: "#faf5ff", borderRadius: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#6b21a8", marginBottom: 8 }}>
              🏛️ Engine 2 — Policy Analysis
            </div>
            <ul style={{ fontSize: 13, color: "#4c1d95", lineHeight: 2, paddingLeft: 18, margin: 0 }}>
              <li>Deterrence Failure Score — zones where enforcement fails</li>
              <li>SCITA processing delay audit with charts</li>
              <li>Auto-generated BBMP infrastructure proposals</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
