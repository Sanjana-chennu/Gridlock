"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getHexes,
  getRoutes,
  getChronic,
  predictASTraM,
  type HexCell,
  type PatrolRoute,
  type ChronicOffender,
  type ASTRaMResult,
} from "@/lib/api";

/* ── Sparkline removed — backend doesn't provide trend arrays ── */

/* ── Color helpers ────────────────────────────────────────────── */
function crsColor(crs: number): string {
  if (crs >= 80) return "#dc2626";
  if (crs >= 60) return "#ea580c";
  if (crs >= 40) return "#d97706";
  if (crs >= 20) return "#65a30d";
  return "#16a34a";
}

/* ── CRS Bar ──────────────────────────────────────────────────── */
function CRSBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
      <div style={{ width: `${Math.min(value, 100)}%`, height: "100%", background: color, borderRadius: 3 }} />
    </div>
  );
}

/* ── Tactical Map (Light OpenStreetMap tiles) ─────────────────── */
function TacticalMap({
  hexes,
  routes,
  showRoutes,
  onHexSelect,
}: {
  hexes: HexCell[];
  routes: PatrolRoute[];
  showRoutes: boolean;
  onHexSelect: (name: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

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
      map.on("load", () => updateMap(maplibregl));
    });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMap = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (maplibregl: any) => {
      const map = mapInstance.current;
      if (!map) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Add hex markers
      hexes.forEach((h, i) => {
        const color = crsColor(h.crs);
        const size = 26 + h.crs / 6;

        // Outer container — MapLibre controls its transform, so don't touch it
        const el = document.createElement("div");
        el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;`;

        // Inner circle — we apply hover scale here so it doesn't break positioning
        const inner = document.createElement("div");
        inner.style.cssText = `
          width:100%;height:100%;
          background:${color}30;
          border:2px solid ${color};
          border-radius:50%;
          transition:transform 0.15s ease;
          display:flex;align-items:center;justify-content:center;
        `;
        inner.innerHTML = `<span style="font-size:10px;font-weight:700;color:${color}">${i + 1}</span>`;
        el.appendChild(inner);

        el.onmouseenter = () => { inner.style.transform = "scale(1.2)"; };
        el.onmouseleave = () => { inner.style.transform = "scale(1)"; };
        el.onclick = () => onHexSelect(h.zone_name);

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
          .setHTML(`
            <div style="font-family:Inter,sans-serif">
              <div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#1a1a1a">${h.zone_name}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:13px">
                <span style="color:#888">CRS</span><span style="color:${color};font-weight:700">${h.crs}</span>
                <span style="color:#888">Violations</span><span style="color:#333">${h.violations.toLocaleString()}</span>
                <span style="color:#888">Rejected</span><span style="color:#333">${h.rejection_count}</span>
                <span style="color:#888">Type</span><span style="color:#333;text-transform:capitalize">${h.zone_type}</span>
              </div>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([h.lng, h.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });

      // Draw routes
      if (showRoutes) {
        routes.forEach((route) => {
          const coords = route.waypoints.map((w) => [w.lng, w.lat] as [number, number]);
          const sourceId = `route-${route.id}`;
          const layerId = `route-layer-${route.id}`;

          if (map.getSource(sourceId)) {
            map.removeLayer(layerId);
            map.removeSource(sourceId);
          }

          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: coords },
            },
          });

          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": route.color,
              "line-width": 3.5,
              "line-opacity": 0.85,
            },
          });
        });
      }
    },
    [hexes, routes, showRoutes, onHexSelect]
  );

  useEffect(() => {
    if (!mapInstance.current) return;
    import("maplibre-gl").then((ml) => {
      const map = mapInstance.current;
      if (!map) return;
      routes.forEach((r) => {
        const lid = `route-layer-${r.id}`;
        const sid = `route-${r.id}`;
        if (map.getLayer(lid)) map.removeLayer(lid);
        if (map.getSource(sid)) map.removeSource(sid);
      });
      updateMap(ml);
    });
  }, [hexes, routes, showRoutes, updateMap]);

  return (
    <div className="map-container" style={{ width: "100%", height: 500 }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function TacticalOpsPage() {
  const [hexes, setHexes] = useState<HexCell[]>([]);
  const [routes, setRoutes] = useState<PatrolRoute[]>([]);
  const [chronic, setChronic] = useState<ChronicOffender[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"map" | "chronic" | "astram">("map");
  const [showRoutes, setShowRoutes] = useState(true); // routes visible by default
  const [selectedHex, setSelectedHex] = useState<string | null>(null);

  // ASTraM state
  const [photoQuality, setPhotoQuality] = useState(0.72);
  const [hour, setHour] = useState(9);
  const [zoneType, setZoneType] = useState("arterial");
  const [violationType, setViolationType] = useState("No Parking Zone");
  const [criticality, setCriticality] = useState(1.4);
  const [astramResult, setAstramResult] = useState<ASTRaMResult | null>(null);
  const [astramLoading, setAstramLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [hexRes, routeRes, chronicRes] = await Promise.all([
          getHexes(), getRoutes(), getChronic(),
        ]);
        setHexes(hexRes.data);
        setRoutes(routeRes.data);
        setChronic(chronicRes.data);
      } catch {
        // Will show with empty data
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleASTRaM = async () => {
    setAstramLoading(true);
    try {
      const res = await predictASTraM({
        photo_quality: photoQuality, hour, zone_type: zoneType,
        violation_type: violationType, criticality,
      });
      setAstramResult(res.data);
    } catch {
      setAstramResult({
        risk_score: 0.17, risk_pct: "17%",
        verdict: "⚠️ API unavailable — using baseline",
        reasons: ["Could not connect to API server"],
      });
    } finally {
      setAstramLoading(false);
    }
  };

  const totalViolations = hexes.reduce((s, h) => s + h.violations, 0);
  const highRiskCount = hexes.filter((h) => h.crs >= 70).length;
  const totalChronic = hexes.reduce((s, h) => s + h.chronic_vehicles, 0);

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
          Tactical Operations
        </h1>
        <p style={{ fontSize: 14, color: "#888" }}>
          Patrol routing, hotspot map & chronic offender tracking
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { icon: "📍", label: "Total Violations", value: totalViolations.toLocaleString(), color: "#2563eb" },
          { icon: "🔴", label: "High-Risk Zones", value: highRiskCount.toString(), color: "#dc2626" },
          { icon: "🚗", label: "Chronic Vehicles", value: totalChronic.toString(), color: "#d97706" },
          { icon: "🚔", label: "Patrol Routes", value: routes.length.toString(), color: "#16a34a" },
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
          { id: "map" as const, label: "🗺️ Patrol Map" },
          { id: "chronic" as const, label: "⚠️ Chronic Offenders" },
          { id: "astram" as const, label: "🤖 Ticket Validator" },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: MAP ──────────────────────────────────────────── */}
      {activeTab === "map" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
          {/* Map + route legend */}
          <div>
            <TacticalMap hexes={hexes} routes={routes} showRoutes={showRoutes} onHexSelect={setSelectedHex} />

            {/* Route Legend */}
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>🚔 Patrol Routes</span>
                <button
                  className={showRoutes ? "btn-primary" : "btn-secondary"}
                  style={{ padding: "6px 14px", fontSize: 12 }}
                  onClick={() => setShowRoutes(!showRoutes)}
                >
                  {showRoutes ? "✓ Showing" : "Show Routes"}
                </button>
              </div>
              {routes.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>
                      {r.waypoints.map((w) => w.zone_name || w.zone).join(" → ")}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#555", textAlign: "right" }}>
                    <div style={{ fontWeight: 600 }}>CRS: {r.total_crs || r.crs}</div>
                    <div style={{ color: "#888" }}>{r.eta || r.est_duration || r.time} · {r.stops || r.waypoints.length} stops</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Side Panel: Hotspot Rankings */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 10 }}>
              Top Hotspots by CRS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {hexes.slice(0, 8).map((h, i) => (
                <div
                  key={h.hex_id}
                  className="card"
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    borderLeft: `3px solid ${crsColor(h.crs)}`,
                    background: selectedHex === h.zone_name ? "#eff6ff" : "#fff",
                  }}
                  onClick={() => setSelectedHex(h.zone_name)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>
                        <span style={{ color: "#888", marginRight: 6 }}>#{i + 1}</span>
                        {h.zone_name}
                      </div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                        {h.zone_type} · {h.violations.toLocaleString()} violations
                      </div>
                    </div>
                    <span className={`badge ${h.crs >= 70 ? "badge-red" : h.crs >= 40 ? "badge-yellow" : "badge-green"}`} style={{ fontWeight: 700, fontFamily: "monospace" }}>
                      {h.crs.toFixed(0)}
                    </span>
                  </div>
                  <CRSBar value={h.crs} color={crsColor(h.crs)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CHRONIC OFFENDERS ────────────────────────────── */}
      {activeTab === "chronic" && (
        <div>
          <div className="alert-danger" style={{ marginBottom: 20 }}>
            🚨 <strong>{chronic.length} vehicles</strong> identified as chronic offenders (top 1%) — responsible for disproportionate violations. Towing these has 3.2× higher impact than standard enforcement.
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Vehicle</th>
                  <th>Total</th>
                  <th>Last 30d</th>
                  <th>Days Since</th>
                  <th>Zones</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {chronic.map((c) => (
                  <tr key={c.registry_rank}>
                    <td><strong style={{ color: "#888" }}>#{c.registry_rank}</strong></td>
                    <td>
                      <code style={{ fontSize: 12, background: "#f3f4f6", padding: "2px 8px", borderRadius: 4, color: "#2563eb" }}>
                        {c.vehicle_number}
                      </code>
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.total_violations}</td>
                    <td>
                      <span style={{ color: c.recent_30d >= 10 ? "#dc2626" : "#333", fontWeight: c.recent_30d >= 10 ? 700 : 400 }}>
                        {c.recent_30d}
                      </span>
                    </td>
                    <td style={{ color: c.days_since_last <= 3 ? "#dc2626" : "#555" }}>
                      {c.days_since_last}d ago
                    </td>
                    <td>{c.unique_zones}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="progress-bar" style={{ width: 60 }}>
                          <div className="progress-bar-fill" style={{
                            width: `${Math.min((c.offender_score / 200) * 100, 100)}%`,
                            background: c.offender_score > 100 ? "#dc2626" : c.offender_score > 50 ? "#d97706" : "#16a34a",
                          }} />
                        </div>
                        <span style={{ fontSize: 12, color: "#555", fontFamily: "monospace" }}>{c.offender_score.toFixed(0)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: ASTraM ───────────────────────────────────────── */}
      {activeTab === "astram" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Form */}
          <div className="card" style={{ padding: 28 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
              🤖 Ticket Rejection Predictor
            </h3>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
              Enter ticket details to check rejection risk before submitting.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ fontSize: 12, color: "#555", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Photo Quality
                </label>
                <input type="range" min={0} max={1} step={0.01} value={photoQuality}
                  onChange={(e) => setPhotoQuality(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#2563eb" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa", marginTop: 4 }}>
                  <span>Blurry</span>
                  <span style={{ color: "#2563eb", fontWeight: 600 }}>{photoQuality.toFixed(2)}</span>
                  <span>Crystal Clear</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#555", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Hour of Violation
                </label>
                <input type="range" min={0} max={23} value={hour}
                  onChange={(e) => setHour(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "#2563eb" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa", marginTop: 4 }}>
                  <span>00:00</span>
                  <span style={{ color: "#2563eb", fontWeight: 600 }}>{hour}:00</span>
                  <span>23:00</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#555", fontWeight: 600, display: "block", marginBottom: 6 }}>Zone Type</label>
                  <select value={zoneType} onChange={(e) => setZoneType(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 13, color: "#333", background: "#fff" }}>
                    {["arterial", "intersection", "metro", "residential"].map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#555", fontWeight: 600, display: "block", marginBottom: 6 }}>Violation Type</label>
                  <select value={violationType} onChange={(e) => setViolationType(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 13, color: "#333", background: "#fff" }}>
                    {["No Parking Zone","Double Parking","Footpath Encroachment","Bus Stop Block","Intersection Block"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#555", fontWeight: 600, display: "block", marginBottom: 6 }}>Zone Criticality</label>
                <input type="range" min={0.5} max={2.0} step={0.1} value={criticality}
                  onChange={(e) => setCriticality(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#2563eb" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa", marginTop: 4 }}>
                  <span>Low</span>
                  <span style={{ color: "#2563eb", fontWeight: 600 }}>{criticality.toFixed(1)}</span>
                  <span>Critical</span>
                </div>
              </div>

              <button onClick={handleASTRaM} disabled={astramLoading} className="btn-primary"
                style={{ width: "100%", justifyContent: "center" }}>
                {astramLoading ? "Analyzing..." : "⚡ Check Rejection Risk"}
              </button>
            </div>
          </div>

          {/* Result */}
          <div className="card" style={{ padding: 28 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 24 }}>
              Result
            </h3>

            {astramResult ? (
              <div>
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{
                    fontSize: 56, fontWeight: 800,
                    color: astramResult.risk_score > 0.65 ? "#dc2626" : astramResult.risk_score > 0.35 ? "#d97706" : "#16a34a",
                  }}>
                    {astramResult.risk_pct}
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 600, marginTop: 4,
                    color: astramResult.risk_score > 0.65 ? "#dc2626" : astramResult.risk_score > 0.35 ? "#d97706" : "#16a34a",
                  }}>
                    {astramResult.verdict}
                  </div>
                </div>

                <div className="progress-bar" style={{ height: 10, borderRadius: 5, marginBottom: 24 }}>
                  <div className="progress-bar-fill" style={{
                    width: `${astramResult.risk_score * 100}%`,
                    borderRadius: 5,
                    background: astramResult.risk_score > 0.65 ? "#dc2626" : astramResult.risk_score > 0.35 ? "#d97706" : "#16a34a",
                  }} />
                </div>

                <div style={{ fontSize: 12, color: "#888", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Why This Score
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {astramResult.reasons.map((r, i) => (
                    <div key={i} style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 8, fontSize: 13, color: "#555" }}>
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#ccc" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
                  <div style={{ fontSize: 14, color: "#aaa" }}>Adjust parameters and click predict</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
