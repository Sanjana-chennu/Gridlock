"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  {
    title: "Tactical Enforcement",
    items: [
      { href: "/resource-optimizer", label: "Patrol Beat Optimizer" },
      { href: "/chronic-offenders", label: "Chronic Offenders" },
      { href: "/cctv-scanner", label: "CCTV Scanner & Portal" },
    ]
  },
  {
    title: "Civic & Structural",
    items: [
      { href: "/deterrence-inspector", label: "Deterrence Inspector" },
      { href: "/civic-brief", label: "Civic Brief Generator" },
      { href: "/scita-queue", label: "SCITA Queue Tracker" },
    ]
  },
  {
    title: "Audit & Compliance",
    items: [
      { href: "/rejection-map", label: "Rejection Hotspots" },
      { href: "/rejection-classifier", label: "Rejection Risk Model" },
      { href: "/photo-shield", label: "Photo Shield Auditor" },
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Logo Area */}
      <div className="sidebar-logo">
        <Link href="/resource-optimizer" style={{ textDecoration: "none", display: "block" }}>
          <div
            style={{
              fontSize: "1.6rem",
              fontWeight: 900,
              background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            VYUHA
          </div>
          <div
            style={{
              color: "#64748b",
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginTop: 2,
              fontWeight: 700,
            }}
          >
            BTP Parking Intelligence
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "0.68rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                  paddingLeft: 16,
                  fontWeight: 700,
                }}
              >
                {section.title}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`sidebar-link ${isActive ? "active" : ""}`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Live Status Widget */}
        <div style={{ padding: "0 4px", marginTop: 24 }}>
          <div
            className="card"
            style={{
              padding: "14px 16px",
              background: "#fbfaff",
              border: "1px solid rgba(124, 58, 237, 0.08)",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                fontSize: "0.68rem",
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
              }}
            >
              System Status
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#10b981", fontSize: "0.85rem" }}>● </span>
              <span style={{ fontSize: "0.78rem", color: "#334155", fontWeight: 500 }}>
                Data: Loaded
              </span>
            </div>
            <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#10b981", fontSize: "0.85rem" }}>● </span>
              <span style={{ fontSize: "0.78rem", color: "#334155", fontWeight: 500 }}>
                ASTraM: Ready
              </span>
            </div>
            <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#8b5cf6", fontSize: "0.85rem" }}>● </span>
              <span style={{ fontSize: "0.78rem", color: "#334155", fontWeight: 500 }}>
                BBMP Agent: Standby
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        Vyuha v1.0 · Built for BTP · 2024
      </div>
    </aside>
  );
}
