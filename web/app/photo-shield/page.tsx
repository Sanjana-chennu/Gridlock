"use client";

import { useState } from "react";
import { uploadAndDetectPlate } from "@/lib/api";

export default function PhotoShieldPage() {
  // ASTraM Instant Shield Photo Uploader state
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
    photo_audit?: {
      blur_score: number;
      blur_passed: boolean;
      contrast_score: number;
      contrast_passed: boolean;
      focus_ratio: number;
      focus_passed: boolean;
    } | null;
  } | null>(null);

  const handleUploadDetect = async () => {
    if (!uploadFile) return;
    setDetecting(true);
    setDetectionError(null);
    setLastDetResult(null);

    try {
      const res = await uploadAndDetectPlate(uploadFile);
      setLastDetResult(res.data);
    } catch (e: unknown) {
      const err = e as Error;
      setDetectionError(err.message || "Plate detection & quality audit failed.");
    } finally {
      setDetecting(false);
    }
  };

  const handleUploaderReset = () => {
    setUploadFile(null);
    setUploadPreview(null);
    setLastDetResult(null);
    setDetectionError(null);
  };

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Title Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          Photo Shield Auditor
        </h1>
        <p style={{ fontSize: 14, color: "#475569" }}>
          Real-time edge compliance gatekeeper checking evidence photo quality prior to court submission
        </p>
      </div>

      <div
        className="card"
        style={{
          background: "#ffffff",
          border: "1px solid rgba(124, 58, 237, 0.08)",
          padding: "24px",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 16
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, color: "#7c3aed", fontSize: 16 }}>
            ASTraM Instant Shield — Live Photo Auditor
          </span>
          <span style={{ background: "#f5f3ff", color: "#7c3aed", fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
            EDGE AI GATEKEEPER
          </span>
        </div>
        <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>
          Upload any evidence photograph to verify compliance before submission. The system runs real-time blur metrics, lighting/contrast checks, and plate frame ratio algorithms locally to audit the ticket.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 12 }}>
          {/* Uploader Left Column */}
          <div>
            <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600, display: "block", marginBottom: 6 }}>
              Upload Vehicle Evidence Photo (JPG / PNG)
            </label>
            <div
              style={{
                border: "2px dashed rgba(124, 58, 237, 0.25)",
                borderRadius: 10,
                padding: "32px 16px",
                textAlign: "center",
                background: "#fbf9fc",
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
                {uploadFile ? uploadFile.name : "Select or drag violation photo"}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                Supports JPG, JPEG, PNG, WEBP
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button
                onClick={handleUploadDetect}
                disabled={!uploadFile || detecting}
                className="btn-primary"
                style={{ flex: 1, justifyContent: "center" }}
              >
                {detecting ? "Auditing Evidence..." : "Audit Compliance Shield"}
              </button>
              {(uploadFile || lastDetResult) && (
                <button
                  onClick={handleUploaderReset}
                  className="btn-secondary"
                  style={{ padding: "0 16px" }}
                >
                  Reset
                </button>
              )}
            </div>

            {detectionError && (
              <div style={{ background: "#fef2f2", border: "1px solid #f87171", borderRadius: 8, padding: "10px 14px", marginTop: 16, color: "#b91c1c", fontSize: 12 }}>
                {detectionError}
              </div>
            )}
          </div>

          {/* Results Right Column */}
          <div style={{ display: "flex", flexDirection: "column", background: "#faf9fc", border: "1px solid rgba(124, 58, 237, 0.08)", borderRadius: 8, padding: 18 }}>
            {uploadPreview && !lastDetResult && (
              <div style={{ textAlign: "center", width: "100%", margin: "auto" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadPreview}
                  alt="Upload Preview"
                  style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8, objectFit: "contain", border: "1px solid rgba(124, 58, 237, 0.2)" }}
                />
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
                  Uploaded photo — click the button to audit compliance
                </div>
              </div>
            )}

            {!uploadPreview && !lastDetResult && (
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 180, color: "#64748b", fontSize: 13, textAlign: "center" }}>
                <span>Waiting for compliance shield upload...</span>
                <span style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>Audit checklist, detected frames, and plate transcription details will render here.</span>
              </div>
            )}

            {lastDetResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
                {/* BBox Frame Render */}
                {lastDetResult.annotated_image && (
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lastDetResult.annotated_image}
                      alt="Audited Bounding Box Frame"
                      style={{ maxWidth: "100%", maxHeight: 150, borderRadius: 6, objectFit: "contain", border: "1px solid rgba(124, 58, 237, 0.1)" }}
                    />
                  </div>
                )}

                {/* Monospace BTP Plate badge */}
                {lastDetResult.plate_text ? (
                  <div style={{ background: "#fef08a", border: "3px solid #000", padding: "6px 12px", borderRadius: 4, width: "fit-content", alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: "#451a03", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.1em" }}>BTP DETECTED PLATE</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 900, color: "#000", fontSize: 18, letterSpacing: "0.08em" }}>{lastDetResult.plate_text}</span>
                  </div>
                ) : (
                  <div style={{ background: "#fef2f2", border: "1px solid #f87171", padding: "8px 12px", borderRadius: 6, width: "100%", alignSelf: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>
                      {lastDetResult.error || "No license plate detected"}
                    </span>
                  </div>
                )}

                {/* Audit Scorecard */}
                {lastDetResult.photo_audit && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", borderBottom: "1px solid rgba(124, 58, 237, 0.1)", paddingBottom: 6 }}>
                      ASTRAM COMPLIANCE SHIELD SCORECARD
                    </div>
                    
                    {/* Blur Check */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                      <span style={{ color: "#475569" }}>Image Clarity (Blur check):</span>
                      <span style={{ fontWeight: 700, color: lastDetResult.photo_audit.blur_passed ? "#16a34a" : "#dc2626" }}>
                        {lastDetResult.photo_audit.blur_score.toFixed(1)} {lastDetResult.photo_audit.blur_passed ? "PASSED" : "FAILED (Blurry)"}
                      </span>
                    </div>

                    {/* Contrast Check */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                      <span style={{ color: "#475569" }}>Lighting/Contrast:</span>
                      <span style={{ fontWeight: 700, color: lastDetResult.photo_audit.contrast_passed ? "#16a34a" : "#dc2626" }}>
                        {lastDetResult.photo_audit.contrast_score.toFixed(1)} {lastDetResult.photo_audit.contrast_passed ? "PASSED" : "FAILED (Low lighting)"}
                      </span>
                    </div>

                    {/* Plate Focus Check */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                      <span style={{ color: "#475569" }}>Plate Focus Ratio:</span>
                      <span style={{ fontWeight: 700, color: lastDetResult.photo_audit.focus_passed ? "#16a34a" : "#dc2626" }}>
                        {lastDetResult.photo_audit.focus_ratio.toFixed(2)}% {lastDetResult.photo_audit.focus_passed ? "PASSED" : "FAILED (Too far)"}
                      </span>
                    </div>

                    {/* Submission Verdict */}
                    {(() => {
                      const hasNoPlate = !lastDetResult.plate_text;
                      const passedCount = (lastDetResult.photo_audit.blur_passed ? 1 : 0) + 
                                          (lastDetResult.photo_audit.contrast_passed ? 1 : 0) + 
                                          (lastDetResult.photo_audit.focus_passed ? 1 : 0);
                      
                      const rating = hasNoPlate
                        ? { text: "CRITICAL REJECTION RISK — NO PLATE READABLE", color: "#dc2626", bg: "#fef2f2", border: "rgba(220, 38, 38, 0.2)" }
                        : passedCount === 3
                        ? { text: "SAFE TO SUBMIT", color: "#16a34a", bg: "#f0fdf4", border: "rgba(22, 163, 74, 0.2)" }
                        : passedCount === 2
                        ? { text: "WARNING: MODERATE REJECTION RISK", color: "#b45309", bg: "#fffbeb", border: "rgba(180, 83, 9, 0.2)" }
                        : { text: "CRITICAL REJECTION RISK — DO NOT SUBMIT", color: "#dc2626", bg: "#fef2f2", border: "rgba(220, 38, 38, 0.2)" };
                      
                      return (
                        <div style={{ background: rating.bg, border: `1px solid ${rating.border}`, color: rating.color, borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: 8 }}>
                          {rating.text}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
