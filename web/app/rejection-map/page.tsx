"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAstramZones, getAstramAudit, type AstramAudit } from "@/lib/api";

interface ZoneItem {
  zone_name: string;
  lat: number;
  lng: number;
  total: number;
  rejected: number;
  rate: number;
  lq: number;
  nt: number;
  nj: number;
  top_viols?: string[];
  avg_pq: number;
}

const MOCK_ZONES: ZoneItem[] = [
  { zone_name: "Marathahalli Bridge", lat: 12.9565, lng: 77.7018, total: 840, rejected: 218, lq: 38.4, nt: 45.2, nj: 16.4, rate: 25.9, avg_pq: 0.61 },
  { zone_name: "Hebbal Flyover", lat: 13.0358, lng: 77.5976, total: 920, rejected: 74, lq: 12.2, nt: 70.3, nj: 17.5, rate: 8.0, avg_pq: 0.68 },
  { zone_name: "Majestic Bus Stand", lat: 12.9778, lng: 77.5727, total: 1200, rejected: 264, lq: 68.2, nt: 22.1, nj: 9.7, rate: 22.0, avg_pq: 0.52 },
  { zone_name: "MG Road", lat: 12.9742, lng: 77.6083, total: 780, rejected: 62, lq: 18.5, nt: 72.4, nj: 9.1, rate: 7.9, avg_pq: 0.71 },
  { zone_name: "Sony World Signal", lat: 12.9365, lng: 77.6277, total: 650, rejected: 91, lq: 28.5, nt: 51.4, nj: 20.1, rate: 14.0, avg_pq: 0.64 },
  { zone_name: "Indiranagar 100ft", lat: 12.9696, lng: 77.6408, total: 880, rejected: 141, lq: 24.1, nt: 63.8, nj: 12.1, rate: 16.0, avg_pq: 0.62 },
  { zone_name: "Koramangala 80ft", lat: 12.9352, lng: 77.6245, total: 520, rejected: 42, lq: 15.2, nt: 75.3, nj: 9.5, rate: 8.1, avg_pq: 0.69 },
  { zone_name: "Brigade Road", lat: 12.9738, lng: 77.6074, total: 610, rejected: 152, lq: 19.4, nt: 78.1, nj: 2.5, rate: 24.9, avg_pq: 0.58 },
];

function rateColor(rate: number): string {
  if (rate < 12.0) return "#00e676"; // Neon green
  if (rate <= 20.0) return "#ffc107"; // Amber
  return "#ef4444"; // Neon red
}

function rateLabel(rate: number): string {
  if (rate < 12.0) return "Low Rejection";
  if (rate <= 20.0) return "Medium Rejection";
  return "Worst Rejection";
}

function AuditMap({
  zones,
  onZoneSelect,
  selectedZone,
}: {
  zones: ZoneItem[];
  onZoneSelect: (name: string) => void;
  selectedZone: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const updateMap = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (maplibregl: any) => {
      const map = mapInstance.current;
      if (!map) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      zones.forEach((z) => {
        const color = rateColor(z.rate);
        const isActive = z.zone_name === selectedZone;
        const radius = isActive ? 34 : Math.max(10, Math.min(22, (z.total / 2000) * 12 + 10));

        const el = document.createElement("div");
        el.style.cssText = `width:${radius}px;height:${radius}px;cursor:pointer;`;

        const inner = document.createElement("div");
        inner.style.cssText = `
          width:100%;height:100%;
          background:${isActive ? "#ffffff" : color}90;
          border:${isActive ? "4px" : "2px"} solid ${isActive ? "#ffffff" : color};
          border-radius:50%;
          transition:transform 0.15s ease;
          display:flex;align-items:center;justify-content:center;
          box-shadow: 0 0 10px ${color}50;
        `;
        el.appendChild(inner);

        el.onmouseenter = () => { inner.style.transform = "scale(1.2)"; };
        el.onmouseleave = () => { inner.style.transform = "scale(1)"; };
        el.onclick = () => onZoneSelect(z.zone_name);

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
          .setHTML(`
            <div style="font-family:inherit; padding: 4px; background:#ffffff; color:#0f172a;">
              <b style="font-size:14px;color:#7c3aed;">${z.zone_name}</b><br>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:12px;margin-top:6px;color:#475569;">
                <span>Rate</span><b style="color:${color}">${z.rate.toFixed(1)}%</b>
                <span>Total</span><b>${z.total.toLocaleString()}</b>
                <span>Rejected</span><b>${z.rejected.toLocaleString()}</b>
                <span>Status</span><b>${rateLabel(z.rate).split(" ", 2)[1]}</b>
              </div>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([z.lng, z.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    },
    [zones, selectedZone, onZoneSelect]
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
              tiles: ["https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "&copy; OpenStreetMap &copy; CartoDB",
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

  useEffect(() => {
    if (mapInstance.current) {
      import("maplibre-gl").then((ml) => updateMap(ml));
    }
  }, [zones, selectedZone, updateMap]);

  return (
    <div className="map-container" style={{ width: "100%", height: 540, borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(124, 58, 237, 0.08)" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

export default function RejectionMapPage() {
  const [zones, setZones] = useState<ZoneItem[]>(MOCK_ZONES);
  const [selectedZone, setSelectedZone] = useState<string>(MOCK_ZONES[0].zone_name);
  const [auditData, setAuditData] = useState<AstramAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<"worst" | "best" | "all">("worst");

  useEffect(() => {
    async function loadData() {
      try {
        const zoneRes = await getAstramZones();
        if (zoneRes.data && zoneRes.data.length > 0) {
          const mappedZones = zoneRes.data.map((z) => {
            return {
              zone_name: z.zone_name,
              lat: z.lat,
              lng: z.lng,
              total: z.total,
              rejected: z.rejected,
              rate: z.rate,
              lq: z.low_quality,
              nt: z.night,
              nj: z.no_junction,
              top_viols: z.top_viols,
              avg_pq: z.avg_pq,
            };
          });
          setZones(mappedZones);
          setSelectedZone(mappedZones[0].zone_name);
        }
      } catch {
        // Fallback to MOCK_ZONES
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    async function fetchAudit() {
      if (!selectedZone) return;
      try {
        const res = await getAstramAudit(selectedZone);
        if (res.data) {
          setAuditData(res.data);
          setZones((prev) =>
            prev.map((z) =>
              z.zone_name === selectedZone
                ? {
                    ...z,
                    lq: res.data.low_quality,
                    nt: res.data.night,
                    nj: res.data.no_junction,
                    top_viols: res.data.top_viols,
                  }
                : z
            )
          );
        }
      } catch {
        const m = MOCK_ZONES.find((x) => x.zone_name === selectedZone) || MOCK_ZONES[0];
        setAuditData({
          zone: selectedZone,
          total_rejected: m.rejected,
          low_quality: m.lq,
          night: m.nt,
          no_junction: m.nj,
          actionable_insight: "Check lens cleanliness and enforce proper night-time flash protocol.",
        });
      }
    }
    fetchAudit();
  }, [selectedZone]);

  if (loading) {
    return (
      <div style={{ padding: "32px 40px" }}>
        <div className="skeleton" style={{ height: 32, width: 250, marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 80 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 500 }} />
      </div>
    );
  }

  const avgRate = zones.reduce((s, z) => s + z.rate, 0) / zones.length;
  const activeZoneData = zones.find((z) => z.zone_name === selectedZone) || zones[0];
  const sColor = rateColor(activeZoneData.rate);
  const sLabel = rateLabel(activeZoneData.rate);

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Title Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          Rejection Hotspots
        </h1>
        <p style={{ fontSize: 14, color: "#475569" }}>
          Pinpoint ticket audit rejections and review low-quality image hotspot distributions
        </p>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="stat-card" style={{ borderTop: "2px solid #2563eb" }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
            Zones Analysed
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb", marginTop: 4 }}>{zones.length}</div>
        </div>
        <div className="stat-card" style={{ borderTop: "2px solid #d97706" }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
            City-Wide Rejection Rate
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#d97706", marginTop: 4 }}>{avgRate.toFixed(1)}%</div>
        </div>
        <div className="stat-card" style={{ borderTop: "2px solid #ef4444" }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
            Worst Zone
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#ef4444", marginTop: 8, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
            {zones.sort((a,b) => b.rate - a.rate)[0]?.zone_name}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{zones.sort((a,b) => b.rate - a.rate)[0]?.rate.toFixed(1)}%</div>
        </div>
        <div className="stat-card" style={{ borderTop: "2px solid #10b981" }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
            Total Tickets Audited
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#10b981", marginTop: 4 }}>
            {zones.reduce((s, z) => s + z.total, 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: 24, marginBottom: 32 }}>
        {/* Map column */}
        <div>
          <h4 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>Bengaluru Ticket Rejection Hotspots</h4>
          <p style={{ margin: "4px 0 16px", color: "#64748b", fontSize: 13 }}>
            Low &lt;12% &nbsp; Medium 12–20% &nbsp; Worst &gt;20% — click any zone to inspect
          </p>
          <AuditMap zones={zones} onZoneSelect={setSelectedZone} selectedZone={selectedZone} />
        </div>

        {/* Audit Inspector Panel */}
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Zone Audit Details</h3>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, display: "block", marginBottom: 6 }}>
              Inspect Enforcement Zone
            </label>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, background: "#ffffff", border: "1px solid rgba(124, 58, 237, 0.15)", color: "#0f172a" }}
            >
              {zones.map((z) => (
                <option key={z.zone_name} value={z.zone_name}>
                  {z.zone_name}
                </option>
              ))}
            </select>
          </div>

          <div className="card" style={{ padding: "18px 20px", borderLeft: `4px solid ${sColor}`, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{activeZoneData.zone_name}</span>
              <span style={{ fontWeight: 800, color: sColor, fontSize: 18 }}>{activeZoneData.rate.toFixed(1)}%</span>
            </div>
            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.8 }}>
              • <b>Quality Standing:</b> {sLabel}<br />
              • <b>Total Tickets:</b> {activeZoneData.total.toLocaleString()}<br />
              • <b>Rejected:</b> {activeZoneData.rejected.toLocaleString()}<br />
            </div>
          </div>

          {/* Top Violation Badges */}
          {activeZoneData.top_viols && activeZoneData.top_viols.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 700 }}>
                Top Violation Types (Rejected)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {activeZoneData.top_viols.map((v: string) => (
                  <span
                    key={v}
                    style={{
                      background: "#f5f3ff",
                      border: "1px solid rgba(124, 58, 237, 0.1)",
                      borderRadius: 4,
                      padding: "4px 8px",
                      fontSize: 11,
                      color: "#7c3aed",
                    }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Defect Attribution progress bars */}
          <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Defect Attribution</h4>
          {auditData ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Low Quality Photos", val: auditData.low_quality, color: "#ef4444", range: "photo_quality_score < 0.65" },
                { label: "Night / Low-Light Hours", val: auditData.night, color: "#2563eb", range: "hour < 7 or > 20" },
                { label: "Missing Junction Tag", val: auditData.no_junction, color: "#d97706", range: "has_junction == 0" },
              ].sort((a, b) => b.val - a.val).map((reason) => (
                <div key={reason.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "#475569" }}>
                      {reason.label} <span style={{ fontSize: 10, color: "#64748b" }}>({reason.range})</span>
                    </span>
                    <span style={{ fontWeight: 700, color: reason.color }}>{reason.val.toFixed(1)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${Math.min(reason.val, 100)}%`, background: reason.color }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#64748b" }}>Loading defect attributions...</div>
          )}
        </div>
      </div>

      {/* Leaderboard Table section */}
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Zone Rejection Leaderboard</h3>

        <div className="tab-list" style={{ marginBottom: 16, display: "inline-flex" }}>
          {[
            { id: "worst" as const, label: "Worst 10" },
            { id: "best" as const, label: "Best 10" },
            { id: "all" as const, label: "All Zones" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`tab-item ${activeLeaderboardTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveLeaderboardTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Zone</th>
                <th>Rejection Rate</th>
                <th>Total Tickets</th>
                <th>Rejected</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let displayZones = [...zones];
                if (activeLeaderboardTab === "worst") {
                  displayZones = displayZones.sort((a, b) => b.rate - a.rate).slice(0, 10);
                } else if (activeLeaderboardTab === "best") {
                  displayZones = displayZones.sort((a, b) => a.rate - b.rate).slice(0, 10);
                } else {
                  displayZones = displayZones.sort((a, b) => b.rate - a.rate);
                }

                return displayZones.map((z, i) => (
                  <tr key={z.zone_name} style={{ background: selectedZone === z.zone_name ? "rgba(124, 58, 237, 0.06)" : "transparent" }}>
                    <td><strong style={{ color: "#64748b" }}>{i + 1}</strong></td>
                    <td style={{ fontWeight: 600, color: "#0f172a" }}>{z.zone_name}</td>
                    <td style={{ fontWeight: 800, color: rateColor(z.rate) }}>{z.rate.toFixed(1)}%</td>
                    <td>{z.total.toLocaleString()}</td>
                    <td style={{ color: "#ef4444", fontWeight: 600 }}>{z.rejected.toLocaleString()}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
