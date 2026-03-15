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
  thumbnailLink: string | null;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function parseFilenameDate(filename: string): string | null {
  // yyyy-mm  e.g. 2024-03
  const ym = filename.match(/(\d{4})-(\d{2})/);
  if (ym) {
    const year = parseInt(ym[1]), month = parseInt(ym[2]);
    if (year >= 2000 && year <= 2035 && month >= 1 && month <= 12)
      return `${MONTHS[month - 1]} ${year}`;
  }
  // mm.yyyy  e.g. 03.2024
  const my = filename.match(/(\d{2})\.(\d{4})/);
  if (my) {
    const month = parseInt(my[1]), year = parseInt(my[2]);
    if (year >= 2000 && year <= 2035 && month >= 1 && month <= 12)
      return `${MONTHS[month - 1]} ${year}`;
  }
  return null;
}

function PdfIcon({ color }: { color: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 80 100" fill="none">
      <rect x="0" y="0" width="80" height="100" rx="4" fill={color} fillOpacity="0.06" />
      <rect x="0" y="0" width="80" height="100" rx="4" stroke={color} strokeOpacity="0.15" strokeWidth="1.5" />
      <path d="M16 20 L50 20 L64 34 L64 84 L16 84 Z" fill={color} fillOpacity="0.1" stroke={color} strokeOpacity="0.2" strokeWidth="1.5" />
      <path d="M50 20 L50 34 L64 34" fill="none" stroke={color} strokeOpacity="0.2" strokeWidth="1.5" />
      <text x="40" y="64" textAnchor="middle" fontSize="14" fontWeight="700" fill={color} fillOpacity="0.5" fontFamily="monospace">PDF</text>
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

  // Sync theme with localStorage — same pattern as all other pages
  useEffect(() => {
    const saved = localStorage.getItem("xe5_theme");
    setIsDark(saved !== "light");
    const handler = (e: StorageEvent) => { if (e.key === "xe5_theme") setIsDark(e.newValue !== "light"); };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("xe5_theme", next ? "dark" : "light");
  }

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
          onClick={toggleTheme}
          style={{ background: t.bgButton, border: `1px solid ${t.border}`, color: t.textMuted, padding: "0.25rem 0.6rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.6rem", letterSpacing: "0.1em" }}
        >
          {isDark ? "LIGHT" : "DARK"}
        </button>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 2rem" }}>
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

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "4rem", color: t.textMuted, fontSize: "0.8rem", letterSpacing: "0.1em" }}>
            Loading library…
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(200,100,100,0.08)", border: "1px solid rgba(200,100,100,0.2)", borderRadius: "4px", padding: "1.5rem", color: "#c87e7e", fontSize: "0.8rem" }}>
            {error}
          </div>
        )}

        {/* Grid */}
        {!loading && !error && (
          <>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "4rem", color: t.textMuted, fontSize: "0.8rem" }}>
                No magazines match &quot;{search}&quot;
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
              {filtered.map(file => {
                const displayName = file.name.replace(/\.pdf$/i, "");
                const parsedDate = parseFilenameDate(file.name);
                return (
                  <a
                    key={file.id}
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none", display: "flex", flexDirection: "column" }}
                  >
                    <div
                      style={{
                        background: t.bgCard, border: `1px solid ${t.borderCard}`, borderRadius: "4px",
                        overflow: "hidden", transition: "border-color 0.2s, transform 0.15s",
                        cursor: "pointer",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = t.gold + "66"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = t.borderCard; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                    >
                      {/* Thumbnail */}
                      <div style={{ width: "100%", aspectRatio: "3/4", background: t.bgInput, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        {file.thumbnailLink ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={file.thumbnailLink}
                            alt={displayName}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={e => {
                              // Fallback to PDF icon if thumbnail fails to load
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                              const parent = (e.currentTarget as HTMLImageElement).parentElement;
                              if (parent) parent.setAttribute("data-fallback", "true");
                            }}
                          />
                        ) : (
                          <div style={{ width: "60%", height: "75%" }}>
                            <PdfIcon color={t.gold} />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: "0.65rem 0.75rem" }}>
                        <div style={{
                          fontSize: "0.72rem", fontWeight: 600, color: t.text,
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                          overflow: "hidden", lineHeight: 1.35, marginBottom: "0.3rem",
                        }} title={displayName}>
                          {displayName}
                        </div>
                        <div style={{ fontSize: "0.58rem", color: t.textMuted, display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                          {parsedDate && <span style={{ color: t.gold }}>{parsedDate}</span>}
                          <span>{formatSize(file.size)}</span>
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
