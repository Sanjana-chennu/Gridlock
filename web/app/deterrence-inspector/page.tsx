"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getDFS,
  type DFSZone,
} from "@/lib/api";

function dfsColor(score: number): string {
  if (score >= 80) return "#7c3aed"; // Purple high risk
  if (score >= 60) return "#d97706"; // Amber medium-high
  if (score >= 40) return "#2563eb"; // Cyan/Blue medium
  return "#64748b"; // Charcoal low
}

function DFSMap({
  zones,
  selectedZoneName,
  onZoneSelect,
}: {
  zones: DFSZone[];
  selectedZoneName: string;
  onZoneSelect: (name: string) => void;
}) {
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
        const isSelected = z.zone_name === selectedZoneName;
        const size = isSelected ? 34 + z.dfs_score / 6 : 20 + z.dfs_score / 8;

        const el = document.createElement("div");
        el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;`;

        const inner = document.createElement("div");
        inner.style.cssText = `
          width:100%;height:100%;
          background:${isSelected ? "#ffffff" : color}${isSelected ? "95" : (z.dfs_triggered ? "60" : "25")};
          border:${isSelected ? "4px solid #ffffff" : (z.dfs_triggered ? "2px solid" : "1px dashed")} ${isSelected ? "#ffffff" : color};
          border-radius:50%;
          transition:transform 0.15s ease;
          display:flex;align-items:center;justify-content:center;
          box-shadow: 0 0 12px ${isSelected ? "#ffffff" : color}${z.dfs_triggered ? "50" : "20"};
        `;
        inner.innerHTML = z.dfs_triggered
          ? `<span style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:50%;"></span>`
          : `<span style="font-size:9px;color:${isSelected ? "#111827" : color}">●</span>`;

        el.appendChild(inner);

        el.onmouseenter = () => { inner.style.transform = "scale(1.2)"; };
        el.onmouseleave = () => { inner.style.transform = "scale(1)"; };
        el.onclick = () => onZoneSelect(z.zone_name);

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
          .setHTML(`
            <div style="font-family:inherit; padding: 4px; background:#ffffff; color:#0f172a;">
              <b style="font-size:14px;color:#7c3aed;">${z.zone_name}</b><br>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:12px;margin-top:6px;color:#475569;">
                <span>DFS Score:</span><b style="color:${color}">${z.dfs_score.toFixed(1)}</b>
                <span>Streak:</span><b>${z.max_streak_wks} weeks</b>
                <span>Avg Violations:</span><b>${z.avg_weekly_violations.toFixed(0)}/wk</b>
                <span>Status:</span><b style="color:${z.dfs_triggered ? "#ef4444" : "#10b981"}">${z.dfs_triggered ? "Resistant" : "Monitoring"}</b>
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
    [zones, selectedZoneName, onZoneSelect]
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
        zoom: 12,
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
  }, [zones, selectedZoneName, updateMarkers]);

  return (
    <div className="map-container" style={{ width: "100%", height: 520, borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(124, 58, 237, 0.08)" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

export default function DeterrenceInspectorPage() {
  const [dfsZones, setDfsZones] = useState<DFSZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZoneName, setSelectedZoneName] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      try {
        const dfsRes = await getDFS();
        setDfsZones(dfsRes.data);
        if (dfsRes.data.length > 0) {
          const firstTriggered = dfsRes.data.find((z) => z.dfs_triggered);
          setSelectedZoneName(firstTriggered ? firstTriggered.zone_name : dfsRes.data[0].zone_name);
        }
      } catch (err) {
        console.error("Failed to load DFS data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const selectedDfs = dfsZones.find((z) => z.zone_name === selectedZoneName) || dfsZones[0];
  const resistantZones = dfsZones.filter((z) => z.dfs_triggered);

  let gapDescription = "";
  if (selectedDfs && selectedDfs.violation_distribution) {
    const sortedOffenses = Object.entries(selectedDfs.violation_distribution);
    if (sortedOffenses.length > 0) {
      const [topOffense, pct] = sortedOffenses[0];
      if (topOffense.includes("FOOTPATH")) {
        gapDescription = `<b>Footpath Encroachment</b> (${pct}%): Footpaths lack physical barriers, causing vehicles to mount and park on sidewalks.`;
      } else if (topOffense.includes("BUS")) {
        gapDescription = `<b>Bus Stop Obstruction</b> (${pct}%): Lack of dedicated bus pull-out bays causes buses to block lanes and vehicles to encroach.`;
      } else if (topOffense.includes("CROSSING") || topOffense.includes("JUNCTION") || topOffense.includes("SIGNAL")) {
        gapDescription = `<b>Junction Geometry Deficit</b> (${pct}%): Lack of intersection clearance markers (yellow grid boxes) and corner bulb-outs.`;
      } else {
        gapDescription = `<b>Parking Capacity Deficit</b> (${pct}%): Absence of demarcated on-street slots and loading bays leads to unregulated double-parking.`;
      }
    }
  }

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

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Title Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          Deterrence Inspector
        </h1>
        <p style={{ fontSize: 14, color: "#475569" }}>
          Identify zones resistant to patrol enforcement and pinpoint physical infrastructure defects
        </p>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Resistant Zones", value: resistantZones.length.toString(), color: "#7c3aed" },
          { label: "Highest DFS score", value: dfsZones.length > 0 ? `${Math.max(...dfsZones.map(z => z.dfs_score)).toFixed(0)}` : "0", color: "#ef4444" },
          { label: "Target reduction", value: "↓ 15%", color: "#10b981" },
          { label: "Avg weekly visits", value: dfsZones.length > 0 ? (dfsZones.reduce((a, b) => a + b.avg_enforcement, 0) / dfsZones.length).toFixed(1) : "0", color: "#2563eb" }
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

      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: 24, marginBottom: 24 }}>
        {/* Map Column */}
        <div>
          <DFSMap
            zones={dfsZones}
            selectedZoneName={selectedZoneName}
            onZoneSelect={setSelectedZoneName}
          />
        </div>

        {/* Inspector Panel */}
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
            Zone Diagnostics
          </h3>

          {/* Selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, display: "block", marginBottom: 6 }}>
              Select enforcement zone to audit
            </label>
            <select
              value={selectedZoneName}
              onChange={(e) => setSelectedZoneName(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, background: "#ffffff", border: "1px solid rgba(124, 58, 237, 0.15)", color: "#0f172a" }}
            >
              {dfsZones.map((z) => (
                <option key={z.hex_id} value={z.zone_name}>
                  {z.zone_name}
                </option>
              ))}
            </select>
          </div>

          {/* Metadata Card */}
          {selectedDfs && (
            <div
              className="card"
              style={{
                borderLeft: `4px solid ${dfsColor(selectedDfs.dfs_score)}`,
                padding: "16px",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span className={selectedDfs.dfs_triggered ? "badge-red badge" : "badge-blue badge"} style={{ fontSize: 10 }}>
                  {selectedDfs.dfs_triggered ? "Enforcement-Resistant" : "Monitoring"}
                </span>
                <span style={{ fontWeight: 800, color: dfsColor(selectedDfs.dfs_score), fontSize: 18 }}>
                  DFS: {selectedDfs.dfs_score.toFixed(1)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.8 }}>
                • <b>Enforcement Streak:</b> {selectedDfs.max_streak_wks} weeks stagnant<br />
                • <b>Avg Weekly Violations:</b> {selectedDfs.avg_weekly_violations.toFixed(1)} / week<br />
                • <b>Avg Enforcement Visits:</b> {selectedDfs.avg_enforcement.toFixed(1)} / week<br />
                • <b>Trend Status:</b> Enforcement-Resistant
              </div>
            </div>
          )}

          {/* Gap Description Box */}
          {gapDescription && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 6 }}>
                Primary Infrastructure Defect
              </p>
              <div
                style={{
                  fontSize: 13,
                  color: "#475569",
                  background: "#fbfaff",
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(124, 58, 237, 0.08)",
                }}
                dangerouslySetInnerHTML={{ __html: gapDescription }}
              />
            </div>
          )}

          {/* Action Link to Civic Brief */}
          <div className="card" style={{ padding: 16, background: "rgba(124, 58, 237, 0.04)", border: "1px dashed rgba(124, 58, 237, 0.2)" }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed", marginBottom: 4 }}>Need infrastructure upgrades?</h4>
            <p style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>Generate and submit an official municipal action proposal to the BBMP using the satellite audit sub-system.</p>
            <button
              onClick={() => window.location.href = `/civic-brief?zone=${encodeURIComponent(selectedZoneName)}`}
              className="btn-primary"
              style={{ fontSize: 12, padding: "6px 12px", border: "none" }}
            >
              Launch Civic Brief Generator
            </button>
          </div>
        </div>
      </div>

      {/* Resistant Zones ledger */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
        Resistant Hotspot Register
      </h3>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Zone Name</th>
              <th>DFS Score</th>
              <th>Max Streak</th>
              <th>Avg Weekly Violations</th>
              <th>Avg Enforcement Visits</th>
              <th>Primary Violation</th>
            </tr>
          </thead>
          <tbody>
            {dfsZones.map((z) => {
              const mainViolation = z.violation_distribution ? Object.keys(z.violation_distribution)[0] : "N/A";
              return (
                <tr key={z.hex_id} style={{ background: selectedZoneName === z.zone_name ? "rgba(124, 58, 237, 0.06)" : "transparent" }}>
                  <td style={{ fontWeight: 600, color: "#0f172a" }}>{z.zone_name}</td>
                  <td style={{ fontWeight: 850, color: dfsColor(z.dfs_score) }}>{z.dfs_score.toFixed(1)}</td>
                  <td>{z.max_streak_wks} weeks</td>
                  <td>{z.avg_weekly_violations.toFixed(0)}</td>
                  <td>{z.avg_enforcement.toFixed(1)} / wk</td>
                  <td style={{ textTransform: "capitalize", fontSize: 11, color: "#475569" }}>{mainViolation.replace(/_/g, " ").toLowerCase()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
