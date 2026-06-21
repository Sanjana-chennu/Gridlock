"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  getDFS,
  generateBBMP,
  type BBMPProposal,
  type DFSZone,
} from "@/lib/api";

function CivicBriefContent() {
  const searchParams = useSearchParams();
  const zoneQuery = searchParams.get("zone");

  const [dfsZones, setDfsZones] = useState<DFSZone[]>([]);
  const [selectedZoneName, setSelectedZoneName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Proposal states
  const [proposal, setProposal] = useState<BBMPProposal | null>(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalSource, setProposalSource] = useState("");

  // Satellite image dynamic states
  const [satImageLoading, setSatImageLoading] = useState(true);
  const [satImageError, setSatImageError] = useState(false);

  useEffect(() => {
    async function loadZones() {
      try {
        const dfsRes = await getDFS();
        setDfsZones(dfsRes.data);
        if (dfsRes.data.length > 0) {
          // If zone query param matches any zone, select it, otherwise default to first
          const matched = dfsRes.data.find(z => z.zone_name.toLowerCase() === zoneQuery?.toLowerCase());
          setSelectedZoneName(matched ? matched.zone_name : dfsRes.data[0].zone_name);
        }
      } catch (err) {
        console.error("Failed to load zones for proposal generator", err);
      } finally {
        setLoading(false);
      }
    }
    loadZones();
  }, [zoneQuery]);

  useEffect(() => {
    if (selectedZoneName) {
      setProposal(null);
      setProposalSource("");
      setSatImageLoading(true);
      setSatImageError(false);
    }
  }, [selectedZoneName]);

  const handleGenerateProposal = async () => {
    if (!selectedZoneName) return;
    setProposalLoading(true);
    setProposal(null);
    setProposalSource("");

    try {
      const res = await generateBBMP(selectedZoneName);
      setProposal(res.data);
      setProposalSource(res.source);
    } catch {
      setProposal({ zone: selectedZoneName, proposal: "Connection to generator failed.", dfs_score: 0 });
      setProposalSource("error");
    } finally {
      setProposalLoading(false);
    }
  };

  const selectedDfs = dfsZones.find((z) => z.zone_name === selectedZoneName);

  if (loading) {
    return (
      <div style={{ padding: "32px 40px" }}>
        <div className="skeleton" style={{ height: 32, width: 250, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 500 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Title Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          Civic Brief Generator
        </h1>
        <p style={{ fontSize: 14, color: "#475569" }}>
          Llama 3.2 Vision + Groq AI-powered municipal action letter architect
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: 24, marginBottom: 24 }}>
        {/* Left Side: Parameters and Satellite Tile */}
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
            Proposal Parameters
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, display: "block", marginBottom: 6 }}>
                Enforcement Zone
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

            {selectedDfs && (
              <div
                className="card"
                style={{
                  padding: "16px",
                  borderLeft: `4px solid ${selectedDfs.dfs_score > 60 ? "#7c3aed" : "#2563eb"}`
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>DFS Severity</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: "#7c3aed" }}>{selectedDfs.dfs_score.toFixed(1)}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                  Streak: <b>{selectedDfs.max_streak_wks} weeks</b> resistant. Weekly average violation flow stands at <b>{selectedDfs.avg_weekly_violations.toFixed(0)}</b>.
                </div>
              </div>
            )}

            {/* Satellite Analysis Frame */}
            <div>
              <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 6 }}>
                Stitched Satellite View
              </p>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 230,
                  background: "#fbfaff",
                  borderRadius: 10,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(124, 58, 237, 0.08)",
                }}
              >
                {satImageLoading && !satImageError && (
                  <div style={{ fontSize: 12, color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ fontSize: 24, marginBottom: 6 }}>📡</span>
                    <span>Retrieving satellite tiles...</span>
                  </div>
                )}

                <img
                  src={`http://127.0.0.1:8000/api/bbmp/image?zone=${encodeURIComponent(selectedZoneName)}`}
                  alt={`Satellite Frame of ${selectedZoneName}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: satImageLoading || satImageError ? "none" : "block",
                  }}
                  onLoad={() => setSatImageLoading(false)}
                  onError={() => {
                    setSatImageLoading(false);
                    setSatImageError(true);
                  }}
                />

                {satImageError && (
                  <div style={{ textAlign: "center", padding: 12, color: "#64748b", fontSize: 12 }}>
                    Stitched imagery offline (FastAPI cache refresh needed)
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleGenerateProposal}
              disabled={proposalLoading}
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", height: 42 }}
            >
              {proposalLoading ? "Generating proposal with Groq..." : "Generate BBMP Proposal Brief"}
            </button>
          </div>
        </div>

        {/* Right Side: Proposal Results */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
            Action Brief Document
          </h3>

          {!proposal && !proposalLoading && (
            <div
              className="card"
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 40,
                textAlign: "center",
                color: "#64748b",
                borderStyle: "dashed",
              }}
            >
              <span style={{ fontSize: 40, marginBottom: 12 }}>📝</span>
              <h4 style={{ color: "#1e293b", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>No brief generated yet</h4>
              <p style={{ fontSize: 12, maxWidth: 300 }}>Select a zone and click the button to trigger Llama-3 Vision + Groq proposal drafting.</p>
            </div>
          )}

          {proposalLoading && (
            <div
              className="card"
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 40,
                color: "#64748b"
              }}
            >
              <span style={{ fontSize: 32, marginBottom: 12 }} className="animate-spin">🔄</span>
              <h4 style={{ color: "#1e293b", fontSize: 14, fontWeight: 700 }}>Processing image tiles & drafting...</h4>
              <p style={{ fontSize: 11, marginTop: 4 }}>Streaming response from Groq Llama 3.3 pipeline</p>
            </div>
          )}

          {proposal && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div className="alert-success" style={{ marginBottom: 16, borderLeft: "4px solid #10b981", fontSize: 13 }}>
                {!proposalSource.includes("fallback") ? `Document drafted successfully via AI (${proposalSource})` : "API disconnected — mock brief fallback"}
              </div>

              <div className="card" style={{ padding: 24, flex: 1, borderLeft: "4px solid #7c3aed", maxHeight: 420, overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#7c3aed", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1rem" }}>
                      BBMP Infrastructure Brief · Auto-Generated
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                      {proposal.zone}
                    </div>
                  </div>
                </div>

                <div
                  className="proposal-markdown"
                  style={{ borderTop: "1px solid rgba(124, 58, 237, 0.08)", paddingTop: 16, fontSize: 13, lineHeight: 1.7, color: "#475569" }}
                  dangerouslySetInnerHTML={{
                    __html: proposal.proposal
                      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
                      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
                      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                      .replace(/\*(.+?)\*/g, "<em>$1</em>")
                      .replace(/^---$/gm, "<hr/>")
                      .replace(/\n\n/g, "</p><p>"),
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const blob = new Blob([proposal.proposal], { type: "text/markdown" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `BBMP_Brief_${proposal.zone.replace(/\s+/g, "_")}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download .md
                </button>
                <button onClick={() => alert("Sent proposal to BBMP portal! (mock)")} className="btn-secondary" style={{ flex: 1 }}>
                  Send BBMP Portal
                </button>
                <button onClick={() => alert("Added proposal to BTP Civic Report! (mock)")} className="btn-secondary" style={{ flex: 1 }}>
                  Save Report
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CivicBriefPage() {
  return (
    <Suspense fallback={<div>Loading Civic Brief Generator...</div>}>
      <CivicBriefContent />
    </Suspense>
  );
}
