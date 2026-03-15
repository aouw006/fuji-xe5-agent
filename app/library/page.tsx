"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { darkTheme, lightTheme } from "@/lib/theme";

interface DriveFile {
  id: string;
  name: string;
  size: number | null;
  modifiedTime: string | null;
  webViewLink: string;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function PdfIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="40" viewBox="0 0 32 40" fill="none" style={{ flexShrink: 0 }}>
      <rect x="0" y="0" width="32" height="40" rx="3" fill={color} fillOpacity="0.08" />
      <rect x="0" y="0" width="32" height="40" rx="3" stroke={color} strokeOpacity="0.2" strokeWidth="1" />
      <path d="M6 8 L20 8 L26 14 L26 34 L6 34 Z" fill={color} fillOpacity="0.12" stroke={color} strokeOpacity="0.3" strokeWidth="1" />
      <path d="M20 8 L20 14 L26 14" fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="1" />
      <text x="16" y="27" textAnchor="middle" fontSize="7" fontWeight="700" fill={color} fillOpacity="0.6" fontFamily="monospace">PDF</text>
    </svg>
  );
}

export default function LibraryPage() {
  const [isDark, setIsDark] = useState(true);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "size" | "date">("name");

  const t = isDark ? darkTheme : lightTheme;

  useEffect(() => {
    fetch("/api/library")
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setFiles(d.files || []);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = q ? files.filter(f => f.name.toLowerCase().includes(q)) : [...files];
    if (sortBy === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "size") result.sort((a, b) => (b.size || 0) - (a.size || 0));
    if (sortBy === "date") result.sort((a, b) => (b.modifiedTime || "").localeCompare(a.modifiedTime || ""));
    return result;
  }, [files, search, sortBy]);

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Inter', sans-serif", transition: "background 0.3s, color 0.3s" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${t.border}`, padding: "0.75rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: t.bgHeader, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <Link href="/" style={{ color: t.gold, textDecoration: "none", fontSize: 12 }}>← Chat</Link>
          <Link href="/dashboard" style={{ color: t.textMuted, textDecoration: "none", fontSize: 12 }}>Dashboard</Link>
          <Link href="/db" style={{ color: t.textMuted, textDecoration: "none", fontSize: 12 }}>Knowledge Base</Link>
          <Link href="/ingest" style={{ color: t.textMuted, textDecoration: "none", fontSize: 12 }}>Ingester</Link>
          <span style={{ color: t.gold, fontSize: 12 }}>Library</span>
        </div>
        <button
          onClick={() => setIsDark(d => !d)}
          style={{ background: t.bgButton, border: `1px solid ${t.border}`, color: t.textMuted, padding: "0.25rem 0.6rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.6rem", letterSpacing: "0.1em" }}
        >
          {isDark ? "LIGHT" : "DARK"}
        </button>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 2rem" }}>
        {/* Title */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: "0.55rem", letterSpacing: "0.25em", textTransform: "uppercase", color: t.textMuted, marginBottom: "0.4rem" }}>Google Drive</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 900, margin: 0, color: t.text }}>Magazine Library</h1>
          {!loading && !error && (
            <div style={{ fontSize: "0.7rem", color: t.textMuted, marginTop: "0.35rem" }}>{files.length} magazines</div>
          )}
        </div>

        {/* Search + Sort */}
        {!loading && !error && (
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", alignItems: "center" }}>
            <input
              placeholder="Search magazines..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: "3px",
                padding: "0.5rem 0.85rem", color: t.text, fontSize: "0.8rem", outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {(["name", "size", "date"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)} style={{
                  background: sortBy === s ? t.goldBg : "transparent",
                  border: `1px solid ${sortBy === s ? t.gold : t.border}`,
                  color: sortBy === s ? t.gold : t.textMuted,
                  padding: "0.35rem 0.7rem", borderRadius: "2px", cursor: "pointer",
                  fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase",
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* States */}
        {loading && (
          <div style={{ textAlign: "center", padding: "4rem", color: t.textMuted, fontSize: "0.8rem", letterSpacing: "0.1em" }}>
            Loading library…
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(200,100,100,0.08)", border: "1px solid rgba(200,100,100,0.2)", borderRadius: "4px", padding: "1.5rem", color: "#c87e7e", fontSize: "0.8rem" }}>
            {error}
          </div>
        )}

        {/* File grid */}
        {!loading && !error && (
          <>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "4rem", color: t.textMuted, fontSize: "0.8rem" }}>
                No magazines match &quot;{search}&quot;
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
              {filtered.map(file => (
                <div
                  key={file.id}
                  style={{
                    background: t.bgCard, border: `1px solid ${t.borderCard}`, borderRadius: "4px",
                    padding: "1rem 1.1rem", display: "flex", gap: "0.9rem", alignItems: "flex-start",
                    transition: "border-color 0.2s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = t.gold + "55")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = t.borderCard)}
                >
                  <PdfIcon color={t.gold} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "0.78rem", fontWeight: 600, color: t.text,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      marginBottom: "0.3rem",
                    }} title={file.name}>
                      {file.name.replace(/\.pdf$/i, "")}
                    </div>
                    <div style={{ fontSize: "0.6rem", color: t.textMuted, display: "flex", gap: "0.75rem", marginBottom: "0.6rem" }}>
                      <span>{formatSize(file.size)}</span>
                      <span>{formatDate(file.modifiedTime)}</span>
                    </div>
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block", fontSize: "0.58rem", letterSpacing: "0.1em",
                        textTransform: "uppercase", color: t.gold, textDecoration: "none",
                        border: `1px solid ${t.gold}44`, borderRadius: "2px",
                        padding: "0.2rem 0.5rem", transition: "background 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.goldBg)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      Open ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
