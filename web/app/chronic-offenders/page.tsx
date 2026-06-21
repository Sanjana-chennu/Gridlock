"use client";

import { useState, useEffect } from "react";
import {
  getChronic,
  getHexes,
  type ChronicOffender,
  type HexCell,
} from "@/lib/api";

export default function ChronicOffendersPage() {
  const [chronic, setChronic] = useState<ChronicOffender[]>([]);
  const [hexes, setHexes] = useState<HexCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [chronicFilterZone, setChronicFilterZone] = useState("All Zones");

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [hexRes, chronicRes] = await Promise.all([
          getHexes(),
          getChronic("All Zones"),
        ]);
        setHexes(hexRes.data);
        setChronic(chronicRes.data);
      } catch (err) {
        console.error("Failed to load initial chronic data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData();
  }, []);

  useEffect(() => {
    async function filterChronic() {
      try {
        const res = await getChronic(chronicFilterZone);
        setChronic(res.data);
      } catch (e) {
        console.error("Failed to filter chronic offenders", e);
      }
    }
    if (!loading) {
      filterChronic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chronicFilterZone]);

  if (loading) {
    return (
      <div style={{ padding: "32px 40px" }}>
        <div className="skeleton" style={{ height: 32, width: 250, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 120, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Title Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
          Chronic Offender Registry
        </h1>
        <p style={{ fontSize: 14, color: "#475569" }}>
          Targeted repeat offender dashboard for high-ROI vehicle seizure and impounding
        </p>
      </div>

      {/* Danger Alert Box */}
      <div className="alert-danger" style={{ marginBottom: 24, fontSize: 14, borderLeft: "4px solid #ef4444" }}>
        <b>Critical:</b> 350 vehicles identified as chronic offenders — accounting for 30% of all violations citywide.
        Towing these vehicles has a 3.2× higher CRS impact than standard enforcement.
      </div>

      {/* Filtering row */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 6 }}>
            Filter by dispatch zone (get hit list for specific hotspot)
          </label>
          <select
            value={chronicFilterZone}
            onChange={(e) => setChronicFilterZone(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, background: "#ffffff", border: "1px solid rgba(124, 58, 237, 0.15)", color: "#0f172a" }}
          >
            <option value="All Zones">All Zones</option>
            {hexes.map((h) => (
              <option key={h.hex_id} value={h.zone_name}>
                {h.zone_name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => alert("Hit list exported to PDF successfully! (mocked)")}
          className="btn-secondary"
          style={{ height: 42, background: "#ffffff", border: "1px solid rgba(124, 58, 237, 0.15)" }}
        >
          Export Hit List as PDF
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 28 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Vehicle Plate</th>
              <th>Total Violations</th>
              <th>Last 30d</th>
              <th>Days Since Last</th>
              <th>Zones Hit</th>
              <th>Threat Score</th>
            </tr>
          </thead>
          <tbody>
            {chronic.map((c) => (
              <tr key={c.vehicle_number}>
                <td><strong style={{ color: "#64748b" }}>#{c.registry_rank}</strong></td>
                <td>
                  <code style={{ fontSize: 13, background: "#f5f3ff", border: "1px solid rgba(124, 58, 237, 0.1)", padding: "3px 8px", borderRadius: 4, color: "#7c3aed", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                    {c.vehicle_number}
                  </code>
                </td>
                <td style={{ fontWeight: 600, color: "#0f172a" }}>{c.total_violations}</td>
                <td>
                  <span style={{ color: c.recent_30d >= 10 ? "#ef4444" : "#2d3748", fontWeight: c.recent_30d >= 10 ? 700 : 500 }}>
                    {c.recent_30d}
                  </span>
                </td>
                <td style={{ color: c.days_since_last <= 3 ? "#059669" : "#2d3748", fontWeight: 500 }}>
                  {c.days_since_last} days ago
                </td>
                <td>{c.unique_zones}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="progress-bar" style={{ width: 120 }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min((c.offender_score / 350) * 100, 100)}%`,
                          background: c.offender_score > 280 ? "#ef4444" : c.offender_score > 150 ? "#d97706" : "#059669",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: "#0f172a", fontFamily: "monospace", fontWeight: 700 }}>
                      {c.offender_score.toFixed(1)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid rgba(124, 58, 237, 0.08)", margin: "24px 0" }} />

      <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>
        Targeting Performance Multipliers
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div className="card" style={{ padding: 20, textAlign: "center", borderTop: "3px solid #ef4444" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#ef4444" }}>84</div>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Max violations by a single vehicle</div>
        </div>
        <div className="card" style={{ padding: 20, textAlign: "center", borderTop: "3px solid #d97706" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#d97706" }}>3.2×</div>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Higher CRS impact vs standard ticket</div>
        </div>
        <div className="card" style={{ padding: 20, textAlign: "center", borderTop: "3px solid #10b981" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#10b981" }}>72%</div>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Re-violation rate within 30 days</div>
        </div>
      </div>
    </div>
  );
}
