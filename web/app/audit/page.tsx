"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getHexes, getAstramAudit, type AstramAudit } from "@/lib/api";

// ── Mock Data for disconnected state ──
const MOCK_ZONES = [
  { zone_name: "Marathahalli Bridge", lat: 12.9565, lng: 77.7018, total: 840, rejected: 218, lq: 38.4, nt: 45.2, nj: 16.4, rate: 25.9 },
  { zone_name: "Hebbal Flyover", lat: 13.0358, lng: 77.5976, total: 920, rejected: 74, lq: 12.2, nt: 70.3, nj: 17.5, rate: 8.0 },
  { zone_name: "Majestic Bus Stand", lat: 12.9778, lng: 77.5727, total: 1200, rejected: 264, lq: 68.2, nt: 22.1, nj: 9.7, rate: 22.0 },
  { zone_name: "MG Road", lat: 12.9742, lng: 77.6083, total: 780, rejected: 62, lq: 18.5, nt: 72.4, nj: 9.1, rate: 7.9 },
  { zone_name: "Sony World Signal", lat: 12.9365, lng: 77.6277, total: 650, rejected: 91, lq: 28.5, nt: 51.4, nj: 20.1, rate: 14.0 },
  { zone_name: "Indiranagar 100ft", lat: 12.9696, lng: 77.6408, total: 880, rejected: 141, lq: 24.1, nt: 63.8, nj: 12.1, rate: 16.0 },
  { zone_name: "Koramangala 80ft", lat: 12.9352, lng: 77.6245, total: 520, rejected: 42, lq: 15.2, nt: 75.3, nj: 9.5, rate: 8.1 },
  { zone_name: "Brigade Road", lat: 12.9738, lng: 77.6074, total: 610, rejected: 152, lq: 19.4, nt: 78.1, nj: 2.5, rate: 24.9 },
];

function rateColor(rate: number): string {
  if (rate < 12.0) return "#10b981";
  if (rate <= 20.0) return "#f59e0b";
  return "#ef4444";
}

function rateLabel(rate: number): string {
  if (rate < 12.0) return "Low Rejection";
  if (rate <= 20.0) return "Medium Rejection";
  return "Worst Rejection";
}

/* ── Audit Map ────────────────────────────────────────────────────── */
function AuditMap({
  zones,
  onZoneSelect,
  selectedZone,
}: {
  zones: typeof MOCK_ZONES;
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
            <div style="font-family:Inter,sans-serif">
              <div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#1a1a1a">${z.zone_name}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:13px">
                <span style="color:#888">Rate</span><span style="color:${color};font-weight:700">${z.rate.toFixed(1)}%</span>
                <span style="color:#888">Total</span><span style="color:#333">${z.total.toLocaleString()}</span>
                <span style="color:#888">Rejected</span><span style="color:#333">${z.rejected.toLocaleString()}</span>
                <span style="color:#888">Status</span><span style="color:#333">${rateLabel(z.rate)}</span>
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

  useEffect(() => {
    if (mapInstance.current) {
      import("maplibre-gl").then((ml) => updateMap(ml));
    }
  }, [zones, selectedZone, updateMap]);

  return (
    <div className="map-container" style={{ width: "100%", height: 540 }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

export default function QualityControlPage() {
  const [zones, setZones] = useState<typeof MOCK_ZONES>(MOCK_ZONES);
  const [selectedZone, setSelectedZone] = useState<string>(MOCK_ZONES[0].zone_name);
  const [auditData, setAuditData] = useState<AstramAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"worst" | "best" | "all">("worst");

  useEffect(() => {
    async function loadData() {
      try {
        const hexRes = await getHexes();
        if (hexRes.data && hexRes.data.length > 0) {
          const mappedZones = hexRes.data.map((h) => {
            const rejected = h.rejection_count || 0;
            const total = h.violations || 1;
            const rate = (rejected / total) * 100;
            return {
              zone_name: h.zone_name,
              lat: h.lat,
              lng: h.lng,
              total,
              rejected,
              rate,
              lq: 0,
              nt: 0,
              nj: 0,
            };
          }).sort((a, b) => b.rate - a.rate);
          setZones(mappedZones);
          setSelectedZone(mappedZones[0].zone_name);
        }
      } catch {
        // use mock data if backend isn't available
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
          
          // Also update the zone's internal lq, nt, nj to match real data if available
          setZones(prev => prev.map(z => 
            z.zone_name === selectedZone 
              ? { ...z, lq: res.data.low_quality, nt: res.data.night, nj: res.data.no_junction } 
              : z
          ));
        }
      } catch {
        // Fallback to mock logic if disconnected
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
    return <div style={{ padding: "32px 40px" }}>Loading Quality Control...</div>;
  }

  const avgRate = zones.reduce((s, z) => s + z.rate, 0) / zones.length;
  const activeZoneData = zones.find((z) => z.zone_name === selectedZone) || zones[0];
  const sColor = rateColor(activeZoneData.rate);
  const sLabel = rateLabel(activeZoneData.rate);

  return (
    <div style={{ padding: "32px 40px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
          Engine 3 — Rejection Audit & Quality Control
        </h1>
        <p style={{ fontSize: 14, color: "#888" }}>
          Operational Quality Control · Ticket Rejection Hotspots · ML Diagnostics
        </p>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div className="stat-card" style={{ flex: 1, padding: "16px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>Zones Analysed</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb" }}>{zones.length}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, padding: "16px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>City-Wide Rejection</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b" }}>{avgRate.toFixed(1)}%</div>
        </div>
        <div className="stat-card" style={{ flex: 1, padding: "16px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>Worst Zone</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#ef4444", marginTop: 4 }}>{zones[0].zone_name}</div>
          <div style={{ fontSize: 13, color: "#888" }}>{zones[0].rate.toFixed(1)}%</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: 24 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 16, color: "#1a1a1a" }}>📍 Bengaluru Ticket Rejection Hotspots</h4>
          <p style={{ margin: "4px 0 16px", color: "#888", fontSize: 13 }}>
            🟢 Low &lt;12% &nbsp; 🟡 Medium 12–20% &nbsp; 🔴 Worst &gt;20%
          </p>
          <AuditMap zones={zones} onZoneSelect={setSelectedZone} selectedZone={selectedZone} />
        </div>

        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 16 }}>📊 Audit Inspector</h3>
          
          <select 
            value={selectedZone} 
            onChange={(e) => setSelectedZone(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e5e5e5", marginBottom: 16, fontSize: 14 }}
          >
            {zones.map((z) => (
              <option key={z.zone_name} value={z.zone_name}>{z.zone_name}</option>
            ))}
          </select>

          <div className="card" style={{ padding: "18px 20px", borderLeft: `4px solid ${sColor}`, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, color: "#1a1a1a", fontSize: 16 }}>{activeZoneData.zone_name}</span>
              <span style={{ fontWeight: 800, color: sColor, fontSize: 18 }}>{activeZoneData.rate.toFixed(1)}%</span>
            </div>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>
              • <b>Quality Standing:</b> {sLabel}<br/>
              • <b>Total Tickets:</b> {activeZoneData.total.toLocaleString()}<br/>
              • <b>Rejected:</b> {activeZoneData.rejected.toLocaleString()}<br/>
            </div>
          </div>

          <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#1a1a1a" }}>🔍 Defect Attribution</h4>
          {auditData ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Low Quality Photos", val: auditData.low_quality, color: "#ef4444" },
                { label: "Night / Low-Light", val: auditData.night, color: "#3b82f6" },
                { label: "Missing Junction", val: auditData.no_junction, color: "#f59e0b" },
              ].sort((a,b) => b.val - a.val).map((reason) => (
                <div key={reason.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "#1a1a1a" }}>{reason.label}</span>
                    <span style={{ fontWeight: 700, color: reason.color }}>{reason.val.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(reason.val, 100)}%`, height: "100%", background: reason.color, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
              
              <div style={{ marginTop: 16, padding: 14, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Actionable Insight</div>
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                  {auditData.actionable_insight}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#888" }}>Loading defect attributions...</div>
          )}
        </div>
      </div>
      
      {/* Zone Leaderboard */}
      <div style={{ marginTop: 40 }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 16 }}>🏆 Zone Rejection Leaderboard</h3>
        
        <div className="tab-list" style={{ marginBottom: 16, display: "inline-flex" }}>
          {[
            { id: "worst" as const, label: "🔴 Worst 10" },
            { id: "best" as const, label: "🟢 Best 10" },
            { id: "all" as const, label: "📋 All Zones" },
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
                let displayZones = zones;
                if (activeTab === "worst") displayZones = [...zones].sort((a,b) => b.rate - a.rate).slice(0, 10);
                if (activeTab === "best") displayZones = [...zones].sort((a,b) => a.rate - b.rate).slice(0, 10);
                
                return displayZones.map((z, i) => (
                  <tr key={z.zone_name}>
                    <td style={{ color: "#888", fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{z.zone_name}</td>
                    <td style={{ fontWeight: 800, color: rateColor(z.rate) }}>{z.rate.toFixed(1)}%</td>
                    <td style={{ color: "#555" }}>{z.total.toLocaleString()}</td>
                    <td style={{ color: rateColor(z.rate), fontWeight: 600 }}>{z.rejected.toLocaleString()}</td>
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
