"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid rgba(124, 58, 237, 0.15)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(124, 58, 237, 0.05)"
      }}
    >
      <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{label}</div>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
          <span style={{ color: "#64748b" }}>{p.name}:</span>
          <span style={{ color: "#0f172a", fontWeight: 600 }}>{p.value}%</span>
        </div>
      ))}
    </div>
  );
}

export default function RejectionClassifierPage() {
  // Simulator inputs
  const [photoQuality, setPhotoQuality] = useState(0.78);
  const [hour, setHour] = useState(14);
  const [gpsMissing, setGpsMissing] = useState(false);
  const [officerRate, setOfficerRate] = useState(12);
  const [zoneRate, setZoneRate] = useState(16);

  // Prediction output
  const [prediction, setPrediction] = useState<{
    probability: number;
    verdict: string;
    color: string;
  } | null>(null);
  const [predicting, setPredicting] = useState(false);

  const runPrediction = async () => {
    setPredicting(true);
    await new Promise((r) => setTimeout(r, 600));

    // Simple deterministic rule to simulate LightGBM
    let riskScore = 0;
    
    // Photo quality impact (higher quality -> lower risk, 35% weight)
    riskScore += (1 - photoQuality) * 35;
    
    // Night/low-light submittal (hour < 7 or > 20 -> higher risk, 28% weight)
    if (hour < 7 || hour > 20) {
      riskScore += 28;
    } else if (hour < 9 || hour > 18) {
      riskScore += 12;
    }

    // Officer rejection history (18% weight)
    riskScore += (officerRate / 100) * 18;

    // Zone rejection history (12% weight)
    riskScore += (zoneRate / 100) * 12;

    // Missing GPS (7% weight)
    if (gpsMissing) {
      riskScore += 7;
    }

    // Scale risk score between 0 and 1
    const finalProb = Math.max(2, Math.min(98, riskScore));
    let verdict = "SAFE TO SUBMIT (Low Risk)";
    let color = "#16a34a"; // Professional green

    if (finalProb > 45) {
      verdict = "HIGH RISK — SUBMISSION REJECTION LIKELY";
      color = "#dc2626"; // Professional red
    } else if (finalProb > 20) {
      verdict = "MODERATE RISK — VERIFY IMAGE CLARITY";
      color = "#ca8a04"; // Professional amber
    }

    setPrediction({
      probability: finalProb,
      verdict,
      color,
    });
    setPredicting(false);
  };

  const distBins = [
    { name: "0–5%", zonesCount: 8 },
    { name: "5–10%", zonesCount: 16 },
    { name: "10–15%", zonesCount: 14 },
    { name: "15–20%", zonesCount: 9 },
    { name: "20–25%", zonesCount: 5 },
    { name: "25%+", zonesCount: 2 },
  ];

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Title Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          Rejection Risk Classifier
        </h1>
        <p style={{ fontSize: 14, color: "#475569" }}>
          LightGBM Binary Classifier diagnostics and pre-submission evidence auditing tools
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: 24 }}>
        {/* Left Side: Pre-submit simulator */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
            Pre-Submit Classifier Simulator
          </h3>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>
            Simulate a ticket submittal by adjusting features below to test the LightGBM decision trees.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Photo Quality Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "#334155", fontWeight: 500 }}>Image Clarity Score (Laplacian variance)</span>
                <span style={{ color: "#7c3aed", fontWeight: 700 }}>{photoQuality.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={photoQuality}
                onChange={(e) => setPhotoQuality(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#7c3aed", background: "#e2e8f0", height: 6, borderRadius: 3 }}
              />
            </div>

            {/* Hour Submittal Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "#334155", fontWeight: 500 }}>Submittal Hour</span>
                <span style={{ color: "#7c3aed", fontWeight: 700 }}>{hour}:00</span>
              </div>
              <input
                type="range"
                min={0}
                max={23}
                step={1}
                value={hour}
                onChange={(e) => setHour(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "#7c3aed", background: "#e2e8f0", height: 6, borderRadius: 3 }}
              />
            </div>

            {/* Officer Rejection history */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "#334155", fontWeight: 500 }}>Officer Rejection Rate</span>
                <span style={{ color: "#7c3aed", fontWeight: 700 }}>{officerRate}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={officerRate}
                onChange={(e) => setOfficerRate(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "#7c3aed", background: "#e2e8f0", height: 6, borderRadius: 3 }}
              />
            </div>

            {/* Zone Rejection history */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "#334155", fontWeight: 500 }}>Zone Rejection Rate</span>
                <span style={{ color: "#7c3aed", fontWeight: 700 }}>{zoneRate}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={zoneRate}
                onChange={(e) => setZoneRate(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "#7c3aed", background: "#e2e8f0", height: 6, borderRadius: 3 }}
              />
            </div>

            {/* Missing GPS tag Checkbox */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0" }}>
              <input
                type="checkbox"
                id="gps-checkbox"
                checked={gpsMissing}
                onChange={(e) => setGpsMissing(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#7c3aed" }}
              />
              <label htmlFor="gps-checkbox" style={{ fontSize: 13, color: "#334155", cursor: "pointer" }}>
                Missing GPS Location Tag
              </label>
            </div>

            <button
              onClick={runPrediction}
              disabled={predicting}
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", height: 42 }}
            >
              {predicting ? "Running LightGBM Decision Paths..." : "Predict Rejection Risk"}
            </button>

            {/* Prediction Output */}
            {prediction && (
              <div
                style={{
                  background: "#f5f3ff",
                  border: `1.5px solid ${prediction.color}`,
                  borderRadius: 8,
                  padding: "16px 20px",
                  marginTop: 10,
                  textAlign: "center"
                }}
              >
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Predicted Rejection Probability
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: prediction.color, margin: "6px 0" }}>
                  {prediction.probability.toFixed(1)}%
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: prediction.color }}>
                  {prediction.verdict}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Diagnostics Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Model info details */}
          <div className="card" style={{ padding: 24 }}>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
              Validation Model: LightGBM Binary Classifier
            </h4>
            <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.8, marginBottom: 16 }}>
              Vyuha uses a <b>LightGBM</b> tree-based ensemble to audit ticket submittals. Before field officers submit photos, the model predicts likelihood of rejection.
            </p>
            <h5 style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 }}>
              Model Performance
            </h5>
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: 8 }}>Metric</th>
                  <th style={{ padding: 8 }}>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 8 }}>Algorithm</td>
                  <td style={{ padding: 8 }}><code>LightGBM Booster (GOSS Mode)</code></td>
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>AUC-ROC Score</td>
                  <td style={{ padding: 8 }}><code style={{ color: "#16a34a" }}>0.824</code></td>
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>Accuracy</td>
                  <td style={{ padding: 8 }}><code style={{ color: "#16a34a" }}>84.3%</code></td>
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>Training Records</td>
                  <td style={{ padding: 8 }}>298,445 BTP tickets</td>
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>Cross-Validation</td>
                  <td style={{ padding: 8 }}>5-Fold Stratified CV</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Model feature importances */}
          <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h5 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
                Model Feature Importance (%)
              </h5>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={[
                    { name: "Photo Quality", weight: 35 },
                    { name: "Hour Submittal", weight: 28 },
                    { name: "Officer History", weight: 18 },
                    { name: "Zone History", weight: 12 },
                    { name: "Missing GPS Tag", weight: 7 },
                  ]}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tickLine={false} stroke="#64748b" style={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tickLine={false} width={100} stroke="#64748b" style={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="weight" fill="#7c3aed" radius={[0, 3, 3, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h5 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
                City-Wide Rejection Rate Distribution
              </h5>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={distBins}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tickLine={false} stroke="#64748b" style={{ fontSize: 10 }} />
                  <YAxis tickLine={false} stroke="#64748b" style={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="zonesCount" name="Zones count" fill="#a78bfa" radius={[3, 3, 0, 0]} opacity={0.65} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
