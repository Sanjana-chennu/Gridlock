"use client";

import { useState, useEffect } from "react";
import { getSCITA, type SCITAData } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid rgba(124, 58, 237, 0.08)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(124, 58, 237, 0.06)",
      }}
    >
      <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{label}</div>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
          <span style={{ color: "#64748b" }}>{p.name}:</span>
          <span style={{ color: "#0f172a", fontWeight: 600 }}>
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SCITAQueuePage() {
  const [scita, setScita] = useState<SCITAData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSCITAData() {
      try {
        const res = await getSCITA();
        setScita(res.data);
      } catch (err) {
        console.error("Failed to load SCITA queue data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSCITAData();
  }, []);

  if (loading || !scita) {
    return (
      <div style={{ padding: "32px 40px" }}>
        <div className="skeleton" style={{ height: 32, width: 250, marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          <div className="skeleton" style={{ height: 300 }} />
          <div className="skeleton" style={{ height: 300 }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Header Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          SCITA Queue Tracker
        </h1>
        <p style={{ fontSize: 14, color: "#475569" }}>
          Monitor ticketing back-office latency processing times and fine delivery delays
        </p>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Avg processing latency", value: `${scita.avg_processing_days} days`, color: "#d97706" },
          { label: "Re-offend before fine", value: `${scita.reoffend_before_fine}%`, color: "#ef4444" },
          { label: "Effective deterrence", value: `${scita.effective_deterrence}%`, color: "#10b981" },
          { label: "Fine delivery target", value: "< 3 days", color: "#2563eb" },
        ].map((kpi, i) => (
          <div key={i} className="stat-card" style={{ display: "flex", flexDirection: "column", borderLeft: `3px solid ${kpi.color}` }}>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color, marginTop: 4 }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Latency Alert banner */}
      <div className="alert-danger" style={{ marginBottom: 24, borderLeft: "4px solid #ef4444" }}>
        <b>{scita.reoffend_before_fine}%</b> of chronic offenders commit a new violation before receiving their first fine — meaning enforcement has <b>zero immediate consequence</b> for repeat offenders.
      </div>

      {/* Recharts chart row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Latency chart */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
            Processing Time Trend (2024)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={scita.monthly}>
              <defs>
                <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(124, 58, 237, 0.06)" />
              <XAxis dataKey="month" tickLine={false} stroke="#64748b" style={{ fontSize: 11 }} />
              <YAxis tickLine={false} domain={[15, 24]} stroke="#64748b" style={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine
                y={19.5}
                stroke="#d97706"
                strokeDasharray="6 3"
                label={{ value: "19.5d avg", fill: "#d97706", fontSize: 11, position: "right" }}
              />
              <Area
                type="monotone"
                dataKey="avg_days"
                name="Latency (Days)"
                stroke="#7c3aed"
                strokeWidth={2.5}
                fill="url(#gradPurple)"
                dot={{ fill: "#7c3aed", r: 4, stroke: "#ffffff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Violations vs Rejections */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
            Monthly Violations vs Rejections
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={scita.monthly} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(124, 58, 237, 0.06)" />
              <XAxis dataKey="month" tickLine={false} stroke="#64748b" style={{ fontSize: 11 }} />
              <YAxis tickLine={false} stroke="#64748b" style={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="violations" name="Violations" fill="#6366f1" opacity={0.6} radius={[3, 3, 0, 0]} />
              <Bar dataKey="rejected" name="Rejected" fill="#ef4444" opacity={0.8} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Timeline workflow step cards */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>
          Deterrence Timeline — Enforcement to Delivery Flow
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0 }}>
          {[
            { day: "Day 0", text: "Violation occurs. Officer issues ticket.", color: "#2563eb" },
            { day: "Day 2", text: "Same offender parks illegally again. Zero awareness of fine.", color: "#d97706" },
            { day: "Day 5", text: "Ticket enters SCITA back-office queue. Processing begins.", color: "#8b5cf6" },
            { day: "Day 7", text: "17% chance: ticket rejected. Work wasted entirely.", color: "#ef4444" },
            { day: "Day 19.5", text: "Fine notice finally arrives. Offender has re-violated 3× by now.", color: "#10b981" },
          ].map((step, i) => (
            <div
              key={i}
              style={{
                padding: 16,
                textAlign: "center",
                borderLeft: i > 0 ? "1px solid rgba(124, 58, 237, 0.08)" : "none",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(124, 58, 237, 0.08)",
                  color: "#7c3aed",
                  fontSize: 13,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: step.color, marginBottom: 6 }}>
                {step.day}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{step.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
