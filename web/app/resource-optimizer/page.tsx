"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getHexes,
  getRoutes,
  type HexCell,
  type PatrolRoute,
} from "@/lib/api";

function crsColor(crs: number): string {
  if (crs >= 80) return "#00e676"; // Neon green accent for active high values
  if (crs >= 60) return "#00b0ff"; // Neon cyan
  if (crs >= 40) return "#8b5cf6"; // Purple
  if (crs >= 20) return "#ffc107"; // Amber
  return "#8f9e88";
}

function crsBadgeClass(crs: number): string {
  if (crs >= 80) return "badge-green";
  if (crs >= 60) return "badge-blue";
  return "badge-yellow";
}

function CRSBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 6, background: "#e2dcf0", borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
      <div style={{ width: `${Math.min(value, 100)}%`, height: "100%", background: color, borderRadius: 3 }} />
    </div>
  );
}

function TacticalMap({
  hexes,
  routes,
  showRoutes,
  selectedRouteId,
  onHexSelect,
}: {
  hexes: HexCell[];
  routes: PatrolRoute[];
  showRoutes: boolean;
  selectedRouteId: number;
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
              tiles: ["https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "&copy; OpenStreetMap &copy; CartoDB",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [77.5946, 12.9716],
        zoom: 12,
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
        const radius = 28 + h.crs / 10;

        const el = document.createElement("div");
        el.style.cssText = `width:${radius * 2}px;height:${radius * 2}px;cursor:pointer;`;

        const inner = document.createElement("div");
        inner.style.cssText = `
          width:100%;height:100%;
          background:${color}22;
          border:2px solid ${color};
          border-radius:50%;
          transition:transform 0.15s ease;
          display:flex;align-items:center;justify-content:center;
          box-shadow: 0 0 12px ${color}33;
        `;
        inner.innerHTML = `<span style="font-family:Inter,sans-serif;font-size:11px;font-weight:700;color:#0f172a;">#${i + 1}</span>`;
        el.appendChild(inner);

        el.onmouseenter = () => { inner.style.transform = "scale(1.15)"; };
        el.onmouseleave = () => { inner.style.transform = "scale(1)"; };
        el.onclick = () => onHexSelect(h.zone_name);

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
          .setHTML(`
            <div style="font-family:inherit; padding: 4px; background: #ffffff; color: #0f172a;">
              <b style="font-size:14px;color:#7c3aed;">${h.zone_name}</b><br>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:12px;margin-top:6px;color: #475569;">
                <span>CRS:</span><b style="color:#0f172a;">${h.crs.toFixed(0)}</b>
                <span>Violations:</span><b style="color:#0f172a;">${h.violations.toLocaleString()}</b>
                <span>Chronic:</span><b style="color:#0f172a;">${h.chronic_vehicles}</b>
                <span>Type:</span><b style="color:#0f172a;">${h.zone_type}</b>
              </div>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([h.lng, h.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });

      // Clear existing route layers/sources first
      const routesList = [1, 2, 3];
      routesList.forEach((rid) => {
        const lid = `route-layer-${rid}`;
        const sid = `route-${rid}`;
        if (map.getLayer(lid)) map.removeLayer(lid);
        if (map.getSource(sid)) map.removeSource(sid);
      });

      // Draw routes
      if (showRoutes) {
        routes.forEach((route) => {
          if (selectedRouteId !== 0 && route.id !== selectedRouteId) return;

          const coords = route.waypoints.map((w) => [w.lng, w.lat] as [number, number]);
          const sourceId = `route-${route.id}`;
          const layerId = `route-layer-${route.id}`;

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
              "line-width": 4,
              "line-opacity": 0.9,
            },
          });
        });
      }
    },
    [hexes, routes, showRoutes, selectedRouteId, onHexSelect]
  );

  useEffect(() => {
    if (!mapInstance.current) return;
    import("maplibre-gl").then((ml) => updateMap(ml));
  }, [hexes, routes, showRoutes, selectedRouteId, updateMap]);

  return (
    <div className="map-container" style={{ width: "100%", height: 560, position: "relative", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

export default function ResourceOptimizerPage() {
  const [hexes, setHexes] = useState<HexCell[]>([]);
  const [routes, setRoutes] = useState<PatrolRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(0);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [hexRes, routeRes] = await Promise.all([
          getHexes(),
          getRoutes(),
        ]);
        setHexes(hexRes.data);
        setRoutes(routeRes.data);
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "32px 40px" }}>
        <div className="skeleton" style={{ height: 32, width: 250, marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 80 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 560 }} />
      </div>
    );
  }

  const highRiskCount = hexes.filter((h) => h.crs >= 70).length;

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Title Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
          Patrol Beat Optimizer
        </h1>
        <p style={{ fontSize: 14, color: "#475569" }}>
          Dynamic route generator maximizing shift Coverage-to-Violation Return-on-Investment (ROI)
        </p>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Violations", value: "60,000+", subtitle: "↑ 12% vs last month", color: "#7c3aed" },
          { label: "Unique Vehicles", value: "35,000+", subtitle: "1% chronic offenders", color: "#6366f1" },
          { label: "Rejection Rate", value: "17.0%", subtitle: "↓ 2.1pp target", color: "#ef4444" },
          { label: "Avg Processing", value: "19.5 days", subtitle: "↓ 3.2 days target", color: "#d97706" },
          { label: "High-Risk Hexes", value: highRiskCount.toString(), subtitle: "Immediate action beat list", color: "#8b5cf6" },
        ].map((kpi, i) => (
          <div key={i} className="stat-card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", borderTop: `3px solid ${kpi.color}` }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "4px 0" }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{kpi.subtitle}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* Left Column: Map */}
        <div>
          <TacticalMap
            hexes={hexes}
            routes={routes}
            showRoutes={showRoutes}
            selectedRouteId={selectedRouteId}
            onHexSelect={setSelectedHex}
          />
        </div>

        {/* Right Column: Controls and Top Hotspots */}
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>
            High-Risk Patrol Hotspots
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {hexes.slice(0, 4).map((h, i) => {
              const color = crsColor(h.crs);
              const badgeClass = crsBadgeClass(h.crs);
              const isSelected = selectedHex === h.zone_name;

              return (
                <div
                  key={h.hex_id}
                  className="card"
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    borderLeft: `4px solid ${color}`,
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(124, 58, 237, 0.06) 0%, rgba(124, 58, 237, 0.1) 100%)"
                      : "#ffffff",
                  }}
                  onClick={() => setSelectedHex(h.zone_name)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                        #{i + 1} &nbsp; {h.zone_name}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                        {h.zone_type} · {h.violations.toLocaleString()} violations
                      </div>
                    </div>
                    <span className={`badge ${badgeClass}`} style={{ fontSize: 11, fontFamily: "monospace" }}>
                      {h.crs.toFixed(0)}
                    </span>
                  </div>
                  <CRSBar value={h.crs} color={color} />
                </div>
              );
            })}
          </div>

          <hr style={{ border: "none", borderTop: "1px solid rgba(124, 58, 237, 0.08)", margin: "20px 0" }} />

          <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
            Patrol Route Generator
          </h3>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
            Top-3 maximum violation capture itineraries
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <input
              type="checkbox"
              id="show-routes-checkbox"
              checked={showRoutes}
              onChange={(e) => setShowRoutes(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#7c3aed" }}
            />
            <label htmlFor="show-routes-checkbox" style={{ fontSize: 13, color: "#334155", cursor: "pointer", fontWeight: 500 }}>
              Show patrol routes on map
            </label>
          </div>

          {showRoutes && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Select route to highlight
                </label>
                <select
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(parseInt(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13, background: "#ffffff", border: "1px solid rgba(124, 58, 237, 0.15)", color: "#0f172a" }}
                >
                  <option value={0}>All routes</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {routes.map((route) => {
                if (selectedRouteId !== 0 && route.id !== selectedRouteId) return null;
                return (
                  <div
                    key={route.id}
                    className="card"
                    style={{
                      borderLeft: `4px solid ${route.color}`,
                      padding: "12px 16px",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13, color: route.color }}>{route.label}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      CRS Captured: <b style={{ color: "#0f172a" }}>{route.total_crs || route.crs}</b> &nbsp;·&nbsp; ETA: {route.time || route.eta || "45 min"}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, lineHeight: 1.4 }}>
                      {route.waypoints.map((w) => w.zone_name || w.zone).join(" → ")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Rankings table */}
      <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>
        Full Hotspot Hex Ledger
      </h3>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Zone</th>
              <th>Type</th>
              <th>CRS Score</th>
              <th>Total Violations</th>
              <th>Peak Hour</th>
              <th>Chronic Vehicles</th>
              <th>BTP Rejections</th>
            </tr>
          </thead>
          <tbody>
            {hexes.map((h, i) => (
              <tr key={h.hex_id} style={{ background: selectedHex === h.zone_name ? "rgba(124, 58, 237, 0.06)" : "transparent" }}>
                <td><strong style={{ color: "#64748b" }}>#{i + 1}</strong></td>
                <td style={{ fontWeight: 600, color: "#0f172a" }}>{h.zone_name}</td>
                <td style={{ textTransform: "capitalize" }}>{h.zone_type}</td>
                <td>
                  <span className={`badge ${crsBadgeClass(h.crs)}`} style={{ fontSize: 12, fontFamily: "monospace" }}>
                    {h.crs.toFixed(0)}
                  </span>
                </td>
                <td>{h.violations.toLocaleString()}</td>
                <td>{h.peak_violations || "18:00"}</td>
                <td>{h.chronic_vehicles}</td>
                <td>{h.rejection_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
