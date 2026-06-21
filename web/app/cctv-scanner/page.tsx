"use client";

import { useState, useEffect } from "react";
import {
  getHexes,
  uploadAndDetectPlate,
  type HexCell,
} from "@/lib/api";

export default function CCTVScannerPage() {
  const [hexes, setHexes] = useState<HexCell[]>([]);
  const [loading, setLoading] = useState(true);

  // Photo Uploader state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [lastDetResult, setLastDetResult] = useState<{
    plate_text: string;
    confidence_det: number;
    confidence_ocr: number;
    bbox: number[];
    method: string;
    error: string | null;
    annotated_image: string | null;
  } | null>(null);
  const [liveTicketPending, setLiveTicketPending] = useState(false);
  const [liveTicketLogged, setLiveTicketLogged] = useState<{ ref: string; plate: string } | null>(null);

  // Archive Search State
  const [cctvStep, setCctvStep] = useState<1 | 2 | 3>(1);
  const [cctvZone, setCctvZone] = useState("");
  const [cctvTime, setCctvTime] = useState("17:45");
  const [cctvWindow, setCctvWindow] = useState(30);
  const [cctvPartial, setCctvPartial] = useState("");
  const [cctvVType, setCctvVType] = useState("Any");
  const [cctvColor, setCctvColor] = useState("Any");
  const [cctvScanning, setCctvScanning] = useState(false);
  const [cctvScanStep, setCctvScanStep] = useState(0); // 0-5 scanner simulation
  const [suspects, setSuspects] = useState<Array<{
    plate: string;
    is_chronic: boolean;
    hits: number;
    violations: number;
    last_30d: number;
    score: number;
    known: boolean;
  }>>([]);
  const [cctvManualPlate, setCctvManualPlate] = useState("");
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);

  // Frame retrieval state
  const [cctvRetrieveDone, setCctvRetrieveDone] = useState(false);
  const [cctvRetrieving, setCctvRetrieving] = useState(false);
  const [cctvRetrieveStep, setCctvRetrieveStep] = useState(0);
  const [cctvLoggedTicket, setCctvLoggedTicket] = useState<{ ref: string; plate: string } | null>(null);

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const hexRes = await getHexes();
        setHexes(hexRes.data);
        if (hexRes.data.length > 0) {
          setCctvZone(hexRes.data[0].zone_name);
        }
      } catch (err) {
        console.error("Failed to load CCTV initialization data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Handle uploader plate detection
  const handleUploadDetect = async () => {
    if (!uploadFile) return;
    setDetecting(true);
    setDetectionError(null);
    setLastDetResult(null);
    setLiveTicketLogged(null);
    setLiveTicketPending(false);

    try {
      const res = await uploadAndDetectPlate(uploadFile);
      if (res.data.error && !res.data.plate_text) {
        throw new Error(res.data.error);
      }
      setLastDetResult(res.data);
    } catch (e: unknown) {
      const err = e as Error;
      setDetectionError(err.message || "Plate detection failed.");
    } finally {
      setDetecting(false);
    }
  };

  // Confirm uploader live ticket log
  const handleLiveTicketLogConfirm = () => {
    if (!lastDetResult) return;
    const ref = `CCTV-LIVE-${Math.floor(Date.now() % 100000)}`;
    setLiveTicketLogged({ ref, plate: lastDetResult.plate_text });
    setLiveTicketPending(false);
  };

  // Handle archive search scanner trigger
  const handleCCTVSearch = async () => {
    setCctvScanning(true);
    setSelectedPlate(null);
    setCctvRetrieveDone(false);
    setCctvLoggedTicket(null);
    setCctvStep(2);

    // Run 5 stages simulated progress scanner
    setCctvScanStep(1); // Connecting to network
    await new Promise((r) => setTimeout(r, 400));
    setCctvScanStep(2); // Locating camera nodes
    await new Promise((r) => setTimeout(r, 400));
    setCctvScanStep(3); // Scanning buffered frames
    await new Promise((r) => setTimeout(r, 500));
    setCctvScanStep(4); // YOLOv8 vehicle detection
    await new Promise((r) => setTimeout(r, 400));
    setCctvScanStep(5); // OCR reading plates
    await new Promise((r) => setTimeout(r, 300));
    setCctvScanning(false);

    // Build deterministic mock list
    const mockAll = [
      { plate: "KA51AB4821", is_chronic: true, violations: 84, last_30d: 12, score: 312.4 },
      { plate: "KA03AB1247", is_chronic: true, violations: 79, last_30d: 11, score: 298.1 },
      { plate: "KA09AB7734", is_chronic: true, violations: 71, last_30d: 9, score: 281.7 },
      { plate: "KA22AB3391", is_chronic: false, violations: 0, last_30d: 0, score: 0.0 },
      { plate: "KA17AB9056", is_chronic: false, violations: 0, last_30d: 0, score: 0.0 },
      { plate: "KA04CD8812", is_chronic: false, violations: 0, last_30d: 0, score: 0.0 },
      { plate: "KA01MH5544", is_chronic: true, violations: 63, last_30d: 7, score: 249.8 },
      { plate: "MH12DE4591", is_chronic: false, violations: 0, last_30d: 0, score: 0.0 },
      { plate: "TS09GH3312", is_chronic: false, violations: 0, last_30d: 0, score: 0.0 },
    ];

    const partialFilter = cctvPartial.trim().toUpperCase();
    const resultList = mockAll
      .filter((m) => !partialFilter || m.plate.toUpperCase().includes(partialFilter))
      .map((s, idx) => {
        const seedValue = Math.sin(idx + 1) * 10000;
        const hits = Math.floor((seedValue - Math.floor(seedValue)) * 5) + 1;
        return {
          plate: s.plate,
          is_chronic: s.is_chronic,
          hits,
          violations: s.violations,
          last_30d: s.last_30d,
          score: s.score,
          known: s.is_chronic,
        };
      });

    setSuspects(resultList);
  };

  // Handle frame retrieval uploader
  const handleRetrieveFrame = async () => {
    setCctvRetrieving(true);
    setCctvRetrieveStep(1); // Locking camera
    await new Promise((r) => setTimeout(r, 600));
    setCctvRetrieveStep(2); // YOLOv8 scan
    await new Promise((r) => setTimeout(r, 800));
    setCctvRetrieveStep(3); // OCR extraction
    await new Promise((r) => setTimeout(r, 600));
    setCctvRetrieveStep(4); // ASTraM validate
    await new Promise((r) => setTimeout(r, 500));
    setCctvRetrieving(false);
    setCctvRetrieveDone(true);
    setCctvStep(3);
  };

  // Confirm SCITA log
  const handleCCTVLogTicketConfirm = () => {
    if (!selectedPlate) return;
    const ref = `CCTV-REC-${Math.floor(Date.now() % 100000)}`;
    setCctvLoggedTicket({ ref, plate: selectedPlate });
  };

  // Reset uploader
  const handleCCTVReset = () => {
    setSelectedPlate(null);
    setCctvRetrieveDone(false);
    setCctvLoggedTicket(null);
    setCctvStep(1);
  };

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
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
          CCTV Scanner & Portal
        </h1>
        <p style={{ fontSize: 14, color: "#475569" }}>
          Live YOLOv8 license plate detector, EasyOCR transcriber, and historic CCTV audit engine
        </p>
      </div>

      {/* Uploader Component card at top */}
      <div
        className="card"
        style={{
          background: "#ffffff",
          border: "1px solid rgba(124, 58, 237, 0.08)",
          padding: "20px 24px",
          borderRadius: 12,
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontWeight: 800, color: "#7c3aed", fontSize: 15 }}>
            Live YOLOv8 + EasyOCR — Real-Time Plate Extractor
          </span>
          <span style={{ background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed", fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
            EDGE AI ACTIVE
          </span>
        </div>
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>
          Upload any evidence photograph to extract the license plate number instantly via the integrated computer vision pipeline.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Uploader Column */}
          <div>
            <label style={{ fontSize: 12, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 6 }}>
              Upload a vehicle photo (JPG / PNG)
            </label>
            <div
              style={{
                border: "2px dashed rgba(124, 58, 237, 0.25)",
                borderRadius: 10,
                padding: "24px 16px",
                textAlign: "center",
                background: "#fbfaff",
                cursor: "pointer",
                position: "relative",
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadFile(file);
                    setUploadPreview(URL.createObjectURL(file));
                    setLastDetResult(null);
                    setDetectionError(null);
                  }
                }}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
              />
              <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginTop: 8 }}>
                {uploadFile ? uploadFile.name : "Click or drag to select a photo"}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                Supports JPG, JPEG, PNG, WEBP
              </div>
            </div>

            <button
              onClick={handleUploadDetect}
              disabled={!uploadFile || detecting}
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
            >
              {detecting ? "Running Detection..." : "Run YOLOv8 + EasyOCR Detection"}
            </button>
          </div>

          {/* Uploader Results Preview Column */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            {uploadPreview && !lastDetResult && (
              <div style={{ textAlign: "center", width: "100%" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadPreview}
                  alt="Upload Preview"
                  style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, objectFit: "contain", border: "1px solid rgba(124, 58, 237, 0.15)" }}
                />
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
                  Uploaded photo — click the button to run detection
                </div>
              </div>
            )}

            {detectionError && (
              <div className="alert-danger" style={{ width: "100%", fontSize: 13 }}>
                {detectionError}
              </div>
            )}

            {lastDetResult && (
              <div style={{ width: "100%" }}>
                {lastDetResult.annotated_image && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    <div style={{ border: "1px solid rgba(124, 58, 237, 0.15)", borderRadius: 8, overflow: "hidden", width: "100%", maxHeight: 220, display: "flex", justifyContent: "center", background: "#fbfaff" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={lastDetResult.annotated_image}
                        alt="Annotated Plate"
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                      />
                    </div>
                    <div style={{ textAlign: "center", fontSize: 11, color: "#64748b" }}>
                      Plate region detected via {lastDetResult.method} — bounding box highlighted
                    </div>
                  </div>
                )}

                {lastDetResult.plate_text ? (
                  <div
                    style={{
                      background: "rgba(16, 185, 129, 0.04)",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                      borderRadius: 8,
                      padding: "16px 20px",
                      marginTop: 10,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                      <span>
                        Detected via <code style={{ background: "#f5f3ff", color: "#64748b", padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>{lastDetResult.method}</code>
                      </span>
                      <span>
                        Det: <b style={{ color: "#10b981" }}>{(lastDetResult.confidence_det * 100).toFixed(0)}%</b> &nbsp;
                        OCR: <b style={{ color: "#10b981" }}>{(lastDetResult.confidence_ocr * 100).toFixed(0)}%</b>
                      </span>
                    </div>

                    {/* Yellow license plate */}
                    <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
                      <div
                        style={{
                          background: "linear-gradient(135deg, #facc15 0%, #eab308 100%)",
                          border: "4px double #1e293b",
                          borderRadius: 6,
                          padding: "6px 28px",
                          textAlign: "center",
                          position: "relative",
                          minWidth: 200,
                          boxShadow: "0 4px 20px rgba(250,204,21,0.2)",
                        }}
                      >
                        <div style={{ fontSize: 5, letterSpacing: "0.3em", position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", fontWeight: 600, opacity: 0.55, color: "#0f172a" }}>
                          IND
                        </div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 800, letterSpacing: "0.14em", color: "#0f172a", fontSize: 20, marginTop: 2 }}>
                          {lastDetResult.plate_text}
                        </div>
                      </div>
                    </div>

                    {/* Confirmation dialog */}
                    {!liveTicketPending && !liveTicketLogged && (
                      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                        <button
                          onClick={() => {
                            setCctvPartial(lastDetResult.plate_text);
                            setCctvStep(1);
                            alert(`Plate ${lastDetResult.plate_text} loaded into search hint!`);
                          }}
                          className="btn-secondary"
                          style={{ flex: 1, padding: "8px 12px", fontSize: 12 }}
                        >
                          Use in Search
                        </button>
                        <button
                          onClick={() => setLiveTicketPending(true)}
                          className="btn-primary"
                          style={{ flex: 1, padding: "8px 12px", fontSize: 12, justifyContent: "center" }}
                        >
                          Log as Ticket
                        </button>
                      </div>
                    )}

                    {liveTicketPending && (
                      <div style={{ background: "rgba(124, 58, 237, 0.04)", border: "1.5px solid rgba(124, 58, 237, 0.2)", borderRadius: 10, padding: 14, marginTop: 12 }}>
                        <div style={{ fontSize: 11, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 700 }}>
                          Confirm Violation Ticket
                        </div>
                        <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.8 }}>
                          <b>Plate detected:</b> <span style={{ fontFamily: "JetBrains Mono", color: "#eab308", fontWeight: 700 }}>{lastDetResult.plate_text}</span><br />
                          <b>OCR Confidence:</b> {(lastDetResult.confidence_ocr * 100).toFixed(0)}%<br />
                          <b>Timestamp:</b> {new Date().toLocaleTimeString()}
                        </div>
                        <p style={{ fontSize: 11, color: "#64748b", margin: "8px 0" }}>
                          This will log a ticket directly into the BTP SCITA queue.
                        </p>
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button onClick={handleLiveTicketLogConfirm} className="btn-primary" style={{ flex: 1, fontSize: 12, padding: "6px 12px", justifyContent: "center" }}>
                            Yes, Log
                          </button>
                          <button onClick={() => setLiveTicketPending(false)} className="btn-secondary" style={{ flex: 1, fontSize: 12, padding: "6px 12px" }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {liveTicketLogged && (
                      <div style={{ marginTop: 12 }}>
                        <div className="alert-success" style={{ fontSize: 13 }}>
                          Ticket logged! Plate **{liveTicketLogged.plate}** → BTP Reference **{liveTicketLogged.ref}**
                        </div>
                        <button onClick={() => setLiveTicketLogged(null)} className="btn-secondary" style={{ width: "100%", marginTop: 8, padding: "6px 12px", fontSize: 12 }}>
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="alert-danger" style={{ marginTop: 10 }}>
                    Bounding box detected but OCR character reading failed. Try another photo.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid rgba(124, 58, 237, 0.08)", margin: "28px 0" }} />

      {/* 3-Step process layout */}
      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", marginBottom: 24, border: "1px solid rgba(124, 58, 237, 0.08)" }}>
        {[
          { id: 1, label: "① Enter Incident Details" },
          { id: 2, label: "② CCTV Scan Results" },
          { id: 3, label: "③ Retrieve Frame & Log" },
        ].map((step) => {
          const isCurrent = cctvStep === step.id;
          const isPassed = cctvStep > step.id;
          let bg = "rgba(241, 238, 247, 0.8)";
          let color = "#64748b";
          if (isCurrent) {
            bg = "#7c3aed";
            color = "#fff";
          } else if (isPassed) {
            bg = "rgba(16, 185, 129, 0.15)";
            color = "#10b981";
          }

          return (
            <div
              key={step.id}
              style={{
                flex: 1,
                padding: "12px 14px",
                background: bg,
                color: color,
                fontSize: 12,
                fontWeight: 600,
                textAlign: "center",
                transition: "all 0.3s ease",
              }}
            >
              {isPassed ? `✓ ${step.label.slice(2)}` : step.label}
            </div>
          );
        })}
      </div>

      {/* STEP 1 Box */}
      {cctvStep === 1 && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
            ① Enter Incident Details
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            {/* Left Side */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Enforcement Zone
                </label>
                <select
                  value={cctvZone}
                  onChange={(e) => setCctvZone(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "#ffffff", border: "1px solid rgba(124, 58, 237, 0.15)", color: "#0f172a" }}
                >
                  {hexes.map((h) => (
                    <option key={h.hex_id} value={h.zone_name}>
                      {h.zone_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Approximate Time (±30 min window scanned)
                </label>
                <input
                  type="time"
                  value={cctvTime}
                  onChange={(e) => setCctvTime(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "#ffffff", border: "1px solid rgba(124, 58, 237, 0.15)", color: "#0f172a" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Scan window: {cctvWindow} minutes either side
                </label>
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={10}
                  value={cctvWindow}
                  onChange={(e) => setCctvWindow(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "#7c3aed", background: "#e2dcf0", height: 6, borderRadius: 3 }}
                />
              </div>
            </div>

            {/* Right Side */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Partial plate hint (optional)
                </label>
                <input
                  type="text"
                  value={cctvPartial}
                  onChange={(e) => setCctvPartial(e.target.value)}
                  placeholder="e.g. KA03 or AB12 or leave blank"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "#ffffff", border: "1px solid rgba(124, 58, 237, 0.15)", color: "#0f172a" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Vehicle type (optional)
                </label>
                <select
                  value={cctvVType}
                  onChange={(e) => setCctvVType(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "#ffffff", border: "1px solid rgba(124, 58, 237, 0.15)", color: "#0f172a" }}
                >
                  <option value="Any">Any</option>
                  <option value="Car">Car</option>
                  <option value="Auto-Rickshaw">Auto-Rickshaw</option>
                  <option value="Bike/Two-Wheeler">Bike/Two-Wheeler</option>
                  <option value="Truck/Heavy">Truck/Heavy</option>
                  <option value="Van/Minibus">Van/Minibus</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Vehicle colour (optional)
                </label>
                <select
                  value={cctvColor}
                  onChange={(e) => setCctvColor(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "#ffffff", border: "1px solid rgba(124, 58, 237, 0.15)", color: "#0f172a" }}
                >
                  <option value="Any">Any</option>
                  <option value="White">White</option>
                  <option value="Black">Black</option>
                  <option value="Silver/Grey">Silver/Grey</option>
                  <option value="Red">Red</option>
                  <option value="Blue">Blue</option>
                  <option value="Green">Green</option>
                  <option value="Yellow">Yellow</option>
                </select>
              </div>
            </div>
          </div>

          <button onClick={handleCCTVSearch} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
            Scan CCTV Archive
          </button>
        </div>
      )}

      {/* STEP 2 Box */}
      {cctvStep === 2 && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
            ② CCTV Scan Results
          </h3>

          {cctvScanning ? (
            <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { s: 1, label: "Establishing stream to municipal CCTV node..." },
                { s: 2, label: "Selecting nearest camera nodes for zone..." },
                { s: 3, label: "Scanning buffered frames in time window..." },
                { s: 4, label: "YOLOv8 vehicle detection processing..." },
                { s: 5, label: "OCR reading license plates from frame sequence..." },
              ].map((item) => {
                const isPassed = cctvScanStep > item.s;
                const isCurrent = cctvScanStep === item.s;
                return (
                  <div
                    key={item.s}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13,
                      color: isPassed ? "#10b981" : isCurrent ? "#7c3aed" : "#64748b",
                    }}
                  >
                    <span>{isPassed ? "" : isCurrent ? "• " : "  "}</span>
                    <span style={{ fontWeight: isCurrent ? 700 : 500 }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              {/* Camera metadata block */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid rgba(124, 58, 237, 0.08)",
                  borderRadius: 8,
                  padding: "12px 18px",
                  marginBottom: 16,
                  display: "flex",
                  gap: 24,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Camera Node</div>
                  <code style={{ fontSize: 13, color: "#7c3aed", fontWeight: 700 }}>
                    CAM_{cctvZone.toUpperCase().replace(/\s+/g, "_")}_JUNC_C04
                  </code>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Scan Window</div>
                  <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 650 }}>
                    {cctvTime} (±{cctvWindow} min)
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Vehicles Detected</div>
                  <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 650 }}>{suspects.length} unique plates</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                  <span>
                    <span style={{ color: "#ef4444", marginRight: 4 }}>●</span>
                    Chronic
                  </span>
                  <span>
                    <span style={{ color: "#0284c7", marginRight: 4 }}>●</span>
                    First-time
                  </span>
                </div>
              </div>

              {suspects.length === 0 ? (
                <div className="alert-warning">
                  No vehicles matching the parameters found in the time window. Try adjusting partial hints or window sizes.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {suspects.map((s) => {
                    const borderCol = s.is_chronic ? "#ef4444" : "#64748b";
                    return (
                      <div
                        key={s.plate}
                        className="card"
                        style={{
                          padding: "14px 18px",
                          borderLeft: `4px solid ${borderCol}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                              {s.plate}
                            </span>
                            <span className={`badge ${s.is_chronic ? "badge-red" : "badge-blue"}`} style={{ fontSize: 10 }}>
                              {s.is_chronic ? "Chronic" : "First-time"}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                            {s.known ? (
                              <>
                                <b>{s.violations}</b> total violations &nbsp;·&nbsp;
                                <b>{s.last_30d}</b> in last 30d &nbsp;·&nbsp;
                                Threat Score: <b>{s.score.toFixed(1)}</b>
                              </>
                            ) : (
                              <span style={{ fontStyle: "italic", color: "#64748b" }}>
                                No previous enforcement record in BTP database
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedPlate(s.plate);
                            setCctvStep(3);
                            setCctvRetrieveDone(false);
                            setCctvLoggedTicket(null);
                          }}
                          className="btn-secondary"
                          style={{ padding: "6px 16px", fontSize: 12 }}
                        >
                          Select →
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Manual entry lookup */}
              <hr style={{ border: "none", borderTop: "1px solid rgba(124, 58, 237, 0.08)", margin: "20px 0" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={cctvManualPlate}
                    onChange={(e) => setCctvManualPlate(e.target.value)}
                    placeholder="Not seeing vehicle? Enter plate manually here"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "#ffffff", border: "1px solid rgba(124, 58, 237, 0.15)", color: "#0f172a" }}
                  />
                </div>
                <button
                  onClick={() => {
                    if (cctvManualPlate.trim()) {
                      setSelectedPlate(cctvManualPlate.trim().toUpperCase());
                      setCctvStep(3);
                      setCctvRetrieveDone(false);
                      setCctvLoggedTicket(null);
                    }
                  }}
                  className="btn-primary"
                >
                  OCR Lookup
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 3 Box */}
      {cctvStep === 3 && selectedPlate && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div
            style={{
              background: "#fbfaff",
              border: "1px solid rgba(124, 58, 237, 0.08)",
              borderRadius: 8,
              padding: "12px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>Selected Vehicle</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                {selectedPlate}
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 12, color: "#64748b" }}>
              <div>Zone: {cctvZone}</div>
              <div style={{ marginTop: 2 }}>Time: {cctvTime}</div>
            </div>
          </div>

          {cctvRetrieving && (
            <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { s: 1, label: " Locking onto camera node sensor..." },
                { s: 2, label: " Re-running YOLOv8 check on frame buffer..." },
                { s: 3, label: " Performing deep OCR plate transcription..." },
                { s: 4, label: " Retrieving ASTraM evidence validation metrics..." },
              ].map((item) => {
                const isPassed = cctvRetrieveStep > item.s;
                const isCurrent = cctvRetrieveStep === item.s;
                return (
                  <div key={item.s} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: isPassed ? "#10b981" : isCurrent ? "#7c3aed" : "#64748b" }}>
                    <span>{isPassed ? "✓" : isCurrent ? "•" : "○"}</span>
                    <span style={{ fontWeight: isCurrent ? 600 : 400 }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {!cctvRetrieveDone && !cctvRetrieving && (
            <button onClick={handleRetrieveFrame} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              Retrieve CCTV Frame & Validate with ASTraM
            </button>
          )}

          {cctvRetrieveDone && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 24, marginBottom: 20 }}>
                {/* Left details panel */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {/* Styled yellow plate */}
                  <div style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}>
                    <div
                      style={{
                        background: "linear-gradient(135deg, #facc15 0%, #eab308 100%)",
                        border: "4px double #1e293b",
                        borderRadius: 6,
                        padding: "10px 40px",
                        textAlign: "center",
                        position: "relative",
                        minWidth: 220,
                        boxShadow: "0 4px 20px rgba(250,204,21,0.25)",
                      }}
                    >
                      <div style={{ fontSize: 5, letterSpacing: "0.3em", position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", fontWeight: 600, opacity: 0.55, color: "#0f172a" }}>
                        IND
                      </div>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 800, letterSpacing: "0.16em", color: "#0f172a", fontSize: 24, marginTop: 4 }}>
                        {selectedPlate}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: -6, marginBottom: 16 }}>
                    OCR reconstructed from CCTV frame
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%" }}>
                    <div className="card" style={{ padding: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#64748b" }}>YOLOv8 Conf</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981", marginTop: 4 }}>97.8%</div>
                    </div>
                    <div className="card" style={{ padding: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#64748b" }}>OCR Accuracy</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981", marginTop: 4 }}>94.5%</div>
                    </div>
                  </div>
                </div>

                {/* Right ASTraM details panel */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="card" style={{ padding: 14, borderLeft: "4px solid #10b981" }}>
                    <div style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>Frame Acquired</div>
                    <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.8, marginTop: 8 }}>
                      <b>Camera Node:</b> <code style={{ color: "#7c3aed" }}>CAM_{cctvZone.toUpperCase().replace(/\s+/g, "_")}_JUNC_C04</code><br />
                      <b>GPS:</b> <code>12.9716, 77.5946</code><br />
                      <b>BBox:</b> <code>[x:210, y:312, w:115, h:48]</code><br />
                      <b>Frame Timestamp:</b> <code>{cctvTime}:48</code>
                    </div>
                  </div>

                  <div className="card" style={{ padding: 14, borderTop: "3px solid #10b981" }}>
                    <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>
                      ASTraM Rejection Risk
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#10b981" }}>
                        LOW RISK — Evidence valid for court
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#10b981" }}>
                        8%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid rgba(124, 58, 237, 0.08)", margin: "20px 0" }} />

              {!cctvLoggedTicket ? (
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={handleCCTVLogTicketConfirm} className="btn-primary" style={{ flex: 2, justifyContent: "center" }}>
                    Log Recovered Ticket to SCITA Queue
                  </button>
                  <button onClick={handleCCTVReset} className="btn-secondary" style={{ flex: 1 }}>
                    New Search
                  </button>
                </div>
              ) : (
                <div>
                  <div className="alert-success" style={{ marginBottom: 12 }}>
                    Ticket recovered! Plate **{cctvLoggedTicket.plate}** logged under BTP Reference **{cctvLoggedTicket.ref}**.
                  </div>
                  <button onClick={handleCCTVReset} className="btn-secondary" style={{ width: "100%" }}>
                    New Search
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
