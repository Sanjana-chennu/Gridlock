"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getDFS,
  getSCITA,
  generateBBMP,
  type DFSZone,
  type SCITAData,
  type BBMPProposal,
} from "@/lib/api";
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

/* ── Color helpers ────────────────────────────────────────────── */
function dfsColor(score: number): string {
  if (score >= 80) return "#7c3aed";
  if (score >= 60) return "#db2777";
  if (score >= 40) return "#ea580c";
  return "#6b7280";
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 20 }}>
      {data.slice(-12).map((v, i) => (
        <div key={i} style={{ flex: 1, minWidth: 2, borderRadius: "1px 1px 0 0", height: `${(v / max) * 100}%`, background: color, opacity: 0.4 + (v / max) * 0.6 }} />
      ))}
    </div>
  );
}

/* ── DFS Map (Light theme) ────────────────────────────────────── */
function DFSMap({ zones, onZoneSelect }: { zones: DFSZone[]; onZoneSelect: (name: string) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const updateMarkers = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (maplibregl: any) => {
      const map = mapInstance.current;
      if (!map) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      zones.forEach((z) => {
        const color = dfsColor(z.dfs_score);
        const size = 24 + z.dfs_score / 4;
        const el = document.createElement("div");
        el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;`;

        const inner = document.createElement("div");
        inner.style.cssText = `
          width:100%;height:100%;
          background:${color}25;
          border:${z.dfs_triggered ? "2.5px solid" : "1.5px dashed"} ${color};
          border-radius:50%;
          transition:transform 0.15s ease;
          display:flex;align-items:center;justify-content:center;
        `;
        inner.innerHTML = z.dfs_triggered ? `<span style="font-size:11px">🔴</span>` : `<span style="font-size:9px;color:${color}">●</span>`;
        el.appendChild(inner);

        el.onmouseenter = () => { inner.style.transform = "scale(1.2)"; };
        el.onmouseleave = () => { inner.style.transform = "scale(1)"; };
        el.onclick = () => onZoneSelect(z.zone_name);

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
          .setHTML(`
            <div style="font-family:Inter,sans-serif">
              <div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#1a1a1a">${z.zone_name}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:13px">
                <span style="color:#888">DFS</span><span style="color:${color};font-weight:700">${z.dfs_score.toFixed(1)}</span>
                <span style="color:#888">Streak</span><span style="color:#333">${z.max_streak_wks} weeks</span>
                <span style="color:#888">Avg/week</span><span style="color:#333">${z.avg_weekly_violations.toFixed(0)}</span>
                <span style="color:#888">Status</span><span style="color:${z.dfs_triggered ? "#dc2626" : "#16a34a"};font-weight:600">${z.dfs_triggered ? "Resistant" : "Monitoring"}</span>
              </div>
              ${z.dfs_triggered ? `<div style="margin-top:8px;padding:6px 8px;background:#fef2f2;border-radius:6px;font-size:11px;color:#991b1b">Persistent failure: ${z.max_streak_wks} weeks of continuous violations without correction.</div>` : ""}
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([z.lng, z.lat])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.push(marker);
      });
    },
    [zones, onZoneSelect]
  );

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    import("maplibre-gl").then((maplibregl) => {
      const map = new maplibregl.Map({
        container: mapRef.current!,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "&copy; OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [77.5946, 12.9716],
        zoom: 11.5,
        attributionControl: false,
      });
      mapInstance.current = map;
      map.on("load", () => updateMarkers(maplibregl));
    });
    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    import("maplibre-gl").then((ml) => updateMarkers(ml));
  }, [zones, updateMarkers]);

  return (
    <div className="map-container" style={{ width: "100%", height: 500 }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

/* ── Custom Chart Tooltip ─────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>{label}</div>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
          <span style={{ color: "#888" }}>{p.name}:</span>
          <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function StructuralPolicyPage() {
  const [dfsZones, setDfsZones] = useState<DFSZone[]>([]);
  const [scita, setScita] = useState<SCITAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dfs" | "scita" | "bbmp">("dfs");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [bbmpZone, setBbmpZone] = useState("");
  const [proposal, setProposal] = useState<BBMPProposal | null>(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalSource, setProposalSource] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [dfsRes, scitaRes] = await Promise.all([getDFS(), getSCITA()]);
        setDfsZones(dfsRes.data);
        setScita(scitaRes.data);
        if (dfsRes.data.length > 0) {
          setBbmpZone(dfsRes.data.filter((d) => d.dfs_triggered)[0]?.zone_name || dfsRes.data[0].zone_name);
        }
      } catch {
        // Will show with empty data
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleGenerateBBMP = async () => {
    if (!bbmpZone) return;
    setProposalLoading(true);
    try {
      const res = await generateBBMP(bbmpZone);
      setProposal(res.data);
      setProposalSource(res.source);
    } catch {
      setProposal({ zone: bbmpZone, proposal: "⚠️ Could not connect to API.", dfs_score: 0 });
      setProposalSource("error");
    } finally {
      setProposalLoading(false);
    }
  };

  const resistantZones = dfsZones.filter((z) => z.dfs_triggered);

  if (loading) {
    return (
      <div style={{ padding: "32px 40px" }}>
        <div className="skeleton" style={{ height: 32, width: 250, marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
        <div className="skeleton" style={{ height: 500 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
          Policy Analysis
        </h1>
        <p style={{ fontSize: 14, color: "#888" }}>
          Deterrence failure scores, processing delays & infrastructure proposals
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { icon: "🔴", label: "Resistant Zones", value: resistantZones.length.toString(), color: "#7c3aed" },
          { icon: "⏱️", label: "Avg Processing", value: `${scita?.avg_processing_days || "—"} days`, color: "#d97706" },
          { icon: "🔄", label: "Re-offend Before Fine", value: scita?.reoffend_before_fine !== undefined ? `${scita.reoffend_before_fine}%` : "—", color: "#dc2626" },
          { icon: "✅", label: "Effective Deterrence", value: scita?.effective_deterrence !== undefined ? `${scita.effective_deterrence}%` : "—", color: "#16a34a" },
        ].map((kpi, i) => (
          <div key={i} className="stat-card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${kpi.color}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              {kpi.icon}
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>{kpi.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-list" style={{ marginBottom: 20, display: "inline-flex" }}>
        {[
          { id: "dfs" as const, label: "🔴 Failure Map" },
          { id: "scita" as const, label: "⏱️ Processing Delays" },
          { id: "bbmp" as const, label: "📝 BBMP Proposals" },
        ].map((tab) => (
          <button key={tab.id} className={`tab-item ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: DFS MAP ────────────────────────────────────── */}
      {activeTab === "dfs" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
          <DFSMap zones={dfsZones} onZoneSelect={setSelectedZone} />

          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 10 }}>
              Enforcement-Resistant Zones
            </div>
            <div className="alert-danger" style={{ marginBottom: 12, fontSize: 13 }}>
              <strong>{resistantZones.length} zones</strong> sustain violations for ≥16 weeks despite regular enforcement.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dfsZones.slice(0, 8).map((z) => {
                const color = dfsColor(z.dfs_score);
                return (
                  <div
                    key={z.hex_id}
                    className="card"
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      borderLeft: `3px solid ${color}`,
                      background: selectedZone === z.zone_name ? "#faf5ff" : "#fff",
                    }}
                    onClick={() => setSelectedZone(z.zone_name)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{z.zone_name}</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                          {z.max_streak_wks} wks · {z.avg_weekly_violations.toFixed(0)} viol/wk
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className={`badge ${z.dfs_triggered ? "badge-red" : "badge-blue"}`} style={{ fontSize: 11 }}>
                          {z.dfs_triggered ? "Resistant" : "Monitoring"}
                        </span>
                        <div style={{ fontSize: 14, fontWeight: 700, color, marginTop: 4 }}>{z.dfs_score.toFixed(0)}</div>
                      </div>
                    </div>
                    <Sparkline data={z.trend} color={color} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: SCITA ──────────────────────────────────────── */}
      {activeTab === "scita" && scita && (
        <div>
          <div className="alert-danger" style={{ marginBottom: 24 }}>
            🚨 <strong>{scita.reoffend_before_fine}%</strong> of chronic offenders re-violate before receiving their first fine — enforcement has zero immediate consequence for repeat offenders.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 16 }}>Processing Time Trend</h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={scita.monthly}>
                  <defs>
                    <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} domain={[15, 24]} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={19.5} stroke="#dc2626" strokeDasharray="6 3" label={{ value: "19.5d avg", fill: "#dc2626", fontSize: 10, position: "right" }} />
                  <Area type="monotone" dataKey="avg_days" name="Avg Days" stroke="#d97706" strokeWidth={2.5} fill="url(#gradAmber)" dot={{ fill: "#d97706", r: 3, stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 16 }}>Monthly Violations vs Rejections</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={scita.monthly} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="violations" name="Violations" fill="#2563eb" opacity={0.7} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="rejected" name="Rejected" fill="#dc2626" opacity={0.85} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Deterrence Timeline */}
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 16 }}>
              What Actually Happens After a Violation
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 0 }}>
              {[
                { icon: "🚗", day: "Day 0", text: "Violation occurs. Officer issues ticket.", color: "#2563eb" },
                { icon: "🔄", day: "Day 2", text: "Same offender parks illegally again.", color: "#d97706" },
                { icon: "📂", day: "Day 5", text: "Ticket enters processing queue.", color: "#ea580c" },
                { icon: "❌", day: "Day 7", text: "17% chance: ticket rejected.", color: "#dc2626" },
                { icon: "📬", day: "Day 19.5", text: "Fine finally arrives. 3 re-violations later.", color: "#7c3aed" },
              ].map((step, i) => (
                <div key={i} style={{
                  padding: 16, textAlign: "center",
                  borderLeft: i > 0 ? "1px solid #e5e5e5" : "none",
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{step.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: step.color, marginBottom: 4 }}>{step.day}</div>
                  <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>{step.text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Delay Distribution */}
          {scita.delay_distribution && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 16 }}>Fine Delivery Delay Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={scita.delay_distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="bucket" tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Tickets" fill="#7c3aed" opacity={0.7} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: BBMP ───────────────────────────────────────── */}
      {activeTab === "bbmp" && (
        <div>
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
              BBMP Infrastructure Proposal Generator
            </h3>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
              Select a zone with persistent violations. Vyuha generates a structured civic intervention brief for BBMP.
            </p>

            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: "#555", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Select Zone
                </label>
                <select value={bbmpZone} onChange={(e) => setBbmpZone(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 14, color: "#333", background: "#fff" }}>
                  {dfsZones.filter((z) => z.dfs_triggered).map((z) => (
                    <option key={z.hex_id} value={z.zone_name}>
                      {z.zone_name} (DFS: {z.dfs_score.toFixed(0)})
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={handleGenerateBBMP} disabled={proposalLoading} className="btn-primary" style={{ height: 42 }}>
                {proposalLoading ? "⏳ Generating..." : "📝 Generate Brief"}
              </button>
            </div>
          </div>

          {proposal && (
            <div>
              {proposalSource === "llm" && <div className="alert-success" style={{ marginBottom: 16 }}>✨ Generated with Gemini AI</div>}
              {proposalSource === "error" && <div className="alert-danger" style={{ marginBottom: 16 }}>⚠️ API connection failed — start the server</div>}
              {proposalSource !== "llm" && proposalSource !== "error" && <div className="alert-warning" style={{ marginBottom: 16 }}>Using pre-built proposal — add GEMINI_API_KEY for live AI generation</div>}

              <div className="card" style={{ padding: 24, borderLeft: "4px solid #7c3aed" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      BBMP Infrastructure Brief
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginTop: 4 }}>{proposal.zone}</div>
                  </div>
                  {proposal.dfs_score > 0 && <span className="badge badge-red">DFS: {proposal.dfs_score.toFixed(0)}</span>}
                </div>

                <div className="proposal-markdown" style={{ borderTop: "1px solid #e5e5e5", paddingTop: 16 }}
                  dangerouslySetInnerHTML={{
                    __html: proposal.proposal
                      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
                      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
                      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                      .replace(/\*(.+?)\*/g, "<em>$1</em>")
                      .replace(/^---$/gm, "<hr/>")
                      .replace(/\n\n/g, "</p><p>")
                  }}
                />

                <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                  <button className="btn-secondary" onClick={() => {
                    const blob = new Blob([proposal.proposal], { type: "text/markdown" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `BBMP_Brief_${proposal.zone.replace(/\s+/g, "_")}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>
                    📄 Download
                  </button>
                  <button className="btn-secondary">📊 Add to Report</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
