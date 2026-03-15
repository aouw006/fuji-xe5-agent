"use client";
import { useState, useEffect, useMemo } from "react";
import NavBar from "@/components/NavBar";
import { darkTheme, lightTheme } from "@/lib/theme";

interface DriveFile {
  id: string;
  name: string;
  size: number | null;
  modifiedTime: string | null;
  webViewLink: string;
  thumbnailLink: string | null;
}

type Category = "FujiLove" | "Gear Talk" | "Lens Guide" | "Other";

function getCategory(name: string): Category {
  if (name.includes("FujiLove Gear Talk") || name.includes("FujiLove-Gear-Talk")) return "Gear Talk";
  if (name.includes("FujiLove-Magazine") || name.includes("FujiLove Magazine")) return "FujiLove";
  if (name.toLowerCase().includes("mm")) return "Lens Guide";
  return "Other";
}

const CATEGORIES: Category[] = ["FujiLove", "Gear Talk", "Lens Guide", "Other"];

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function parseFilenameDate(filename: string): { label: string; ts: number } | null {
  const ym = filename.match(/(\d{4})-(\d{2})/);
  if (ym) {
    const year = parseInt(ym[1]), month = parseInt(ym[2]);
    if (year >= 2000 && year <= 2035 && month >= 1 && month <= 12)
      return { label: `${MONTHS[month - 1]} ${year}`, ts: year * 100 + month };
  }
  const my = filename.match(/(\d{2})\.(\d{4})/);
  if (my) {
    const month = parseInt(my[1]), year = parseInt(my[2]);
    if (year >= 2000 && year <= 2035 && month >= 1 && month <= 12)
      return { label: `${MONTHS[month - 1]} ${year}`, ts: year * 100 + month };
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
  const [activeCategory, setActiveCategory] = useState<Category | "All">("FujiLove");
  const [sortBy, setSortBy] = useState<"name" | "size" | "date">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());
  const [failedLocalThumbs, setFailedLocalThumbs] = useState<Set<string>>(new Set());
  const [warming, setWarming] = useState(false);
  const [warmupMsg, setWarmupMsg] = useState<string | null>(null);
  const [cachedFiles, setCachedFiles] = useState<Set<string>>(new Set());
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());

  const CACHE_NAME = "fuji-library-pdfs";

  const t = isDark ? darkTheme : lightTheme;

  async function runWarmup() {
    setWarming(true);
    setWarmupMsg(null);
    try {
      const res = await fetch("/api/library/warmup", { method: "POST" });
      const data = await res.json();
      setWarmupMsg(data.message || data.error || "Done");
    } catch {
      setWarmupMsg("Failed to run warmup");
    } finally {
      setWarming(false);
    }
  }

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

  function handleSortClick(col: "name" | "size" | "date") {
    if (sortBy === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir(col === "date" ? "desc" : "asc");
    }
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

  // Scan Cache API on mount to know which files are already cached
  useEffect(() => {
    if (!("caches" in window)) return;
    caches.open(CACHE_NAME).then(async cache => {
      const keys = await cache.keys();
      const ids = keys
        .map(req => new URL(req.url).pathname.split("/").at(-1) ?? "")
        .filter(Boolean);
      setCachedFiles(new Set(ids));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cacheFile(file: DriveFile) {
    if (!("caches" in window)) return;
    setDownloadingFiles(prev => new Set(Array.from(prev).concat(file.id)));
    try {
      const cache = await caches.open(CACHE_NAME);
      const url = `/api/library/download/${file.id}?name=${encodeURIComponent(file.name)}`;
      await cache.add(url);
      setCachedFiles(prev => new Set(Array.from(prev).concat(file.id)));
    } catch { /* silent */ } finally {
      setDownloadingFiles(prev => { const n = new Set(Array.from(prev)); n.delete(file.id); return n; });
    }
  }

  async function uncacheFile(file: DriveFile) {
    if (!("caches" in window)) return;
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(`/api/library/download/${file.id}?name=${encodeURIComponent(file.name)}`);
    setCachedFiles(prev => { const n = new Set(Array.from(prev)); n.delete(file.id); return n; });
  }

  async function openFile(file: DriveFile) {
    if (cachedFiles.has(file.id) && "caches" in window) {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(
        `/api/library/download/${file.id}?name=${encodeURIComponent(file.name)}`
      );
      if (cached) {
        const blob = await cached.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        return;
      }
    }
    window.open(file.webViewLink, "_blank");
  }

  // Count per category for the filter pills
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: files.length };
    for (const f of files) {
      const c = getCategory(f.name);
      counts[c] = (counts[c] || 0) + 1;
    }
    return counts;
  }, [files]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = activeCategory === "All"
      ? [...files]
      : files.filter(f => getCategory(f.name) === activeCategory);

    if (q) result = result.filter(f => f.name.toLowerCase().includes(q));

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortBy === "size") {
        cmp = (a.size || 0) - (b.size || 0);
      } else if (sortBy === "date") {
        const da = parseFilenameDate(a.name);
        const db = parseFilenameDate(b.name);
        if (!da && !db) cmp = 0;
        else if (!da) return 1;
        else if (!db) return -1;
        else cmp = da.ts - db.ts;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [files, search, activeCategory, sortBy, sortDir]);

  // 1. Try local static file generated by scripts/generate-thumbnails.mjs
  // 2. Fall back to Drive proxy (only works for files Drive has thumbnailed, <50MB)
  // 3. Fall back to PDF icon
  function thumbSrc(file: DriveFile): string | null {
    if (!failedLocalThumbs.has(file.id)) return `/thumbnails/${file.id}.jpg`;
    if (file.thumbnailLink && !failedThumbs.has(file.id))
      return `/api/library/thumbnail?src=${encodeURIComponent(file.thumbnailLink)}`;
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Inter', sans-serif", transition: "background 0.3s, color 0.3s" }}>
      <NavBar current="library" isDark={isDark} onToggleTheme={toggleTheme} />

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 2rem" }}>
        {/* Title */}
        <div style={{ marginBottom: "1.75rem" }}>
          <div style={{ fontSize: "0.55rem", letterSpacing: "0.25em", textTransform: "uppercase", color: t.textMuted, marginBottom: "0.4rem" }}>Google Drive</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 900, margin: 0, color: t.text }}>Magazine Library</h1>
          {!loading && !error && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.7rem", color: t.textMuted }}>{files.length} magazines</span>
              <button
                onClick={runWarmup}
                disabled={warming}
                title="For large PDFs that have never been opened in Drive, this triggers Drive to generate their thumbnails in the background. Reload the page after a minute."
                style={{
                  background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted,
                  padding: "0.2rem 0.55rem", borderRadius: "2px", cursor: warming ? "default" : "pointer",
                  fontSize: "0.55rem", letterSpacing: "0.08em", opacity: warming ? 0.5 : 1,
                }}>
                {warming ? "Generating…" : "Generate thumbnails"}
              </button>
              {warmupMsg && <span style={{ fontSize: "0.6rem", color: t.textMuted, fontStyle: "italic" }}>{warmupMsg}</span>}
            </div>
          )}
        </div>

        {!loading && !error && (
          <>
            {/* Search + Sort */}
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.85rem", alignItems: "center" }}>
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
                  <button key={s} onClick={() => handleSortClick(s)} style={{
                    background: sortBy === s ? t.goldBg : "transparent",
                    border: `1px solid ${sortBy === s ? t.gold : t.border}`,
                    color: sortBy === s ? t.gold : t.textMuted,
                    padding: "0.35rem 0.7rem", borderRadius: "2px", cursor: "pointer",
                    fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase",
                    display: "flex", alignItems: "center", gap: "0.3rem",
                  }}>
                    {s}
                    {sortBy === s && <span style={{ fontSize: "0.6rem" }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Category filter pills */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              {(["All", ...CATEGORIES] as const).map(cat => {
                const active = activeCategory === cat;
                const count = categoryCounts[cat] || 0;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      background: active ? t.goldBg : "transparent",
                      border: `1px solid ${active ? t.gold : t.border}`,
                      color: active ? t.gold : t.textMuted,
                      padding: "0.3rem 0.75rem", borderRadius: "20px", cursor: "pointer",
                      fontSize: "0.62rem", letterSpacing: "0.06em",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = t.gold + "88"; (e.currentTarget as HTMLElement).style.color = t.text; } }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = t.border; (e.currentTarget as HTMLElement).style.color = t.textMuted; } }}
                  >
                    {cat} <span style={{ opacity: 0.6, fontSize: "0.55rem" }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </>
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
                No magazines found{search ? ` matching "${search}"` : ""}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: "1rem" }}>
              {filtered.map(file => {
                const category = getCategory(file.name);
                const displayName = file.name.replace(/\.pdf$/i, "");
                const parsedDate = parseFilenameDate(file.name);
                const thumb = thumbSrc(file);
                const localFailed = failedLocalThumbs.has(file.id);
                const driveFailed = failedThumbs.has(file.id);
                const thumbFailed = localFailed && driveFailed;

                const isCached = cachedFiles.has(file.id);
                const isDownloading = downloadingFiles.has(file.id);

                return (
                  <a
                    key={file.id}
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none", display: "flex", flexDirection: "column" }}
                    onClick={async e => {
                      if (isCached) { e.preventDefault(); await openFile(file); }
                    }}
                  >
                    <div
                      style={{
                        background: t.bgCard, border: `1px solid ${t.borderCard}`, borderRadius: "4px",
                        overflow: "hidden", transition: "border-color 0.2s, transform 0.15s",
                        cursor: "pointer", height: "100%",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = t.gold + "66"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = t.borderCard; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                    >
                      {/* Thumbnail */}
                      <div style={{ width: "100%", aspectRatio: "3/4", background: t.bgInput, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                        {/* Cache button */}
                        <button
                          title={isCached ? "Remove from local cache" : "Save locally for offline access"}
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            isCached ? uncacheFile(file) : cacheFile(file);
                          }}
                          style={{
                            position: "absolute", top: "0.4rem", right: "0.4rem", zIndex: 2,
                            width: "1.6rem", height: "1.6rem", borderRadius: "50%",
                            border: `1px solid ${isCached ? t.gold : "rgba(255,255,255,0.3)"}`,
                            background: isCached ? t.gold + "22" : "rgba(0,0,0,0.35)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", backdropFilter: "blur(4px)",
                            color: isCached ? t.gold : "rgba(255,255,255,0.7)",
                            fontSize: "0.65rem", transition: "all 0.15s",
                          }}
                        >
                          {isDownloading ? "⟳" : isCached ? "✓" : "↓"}
                        </button>
                        {thumb && !thumbFailed ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt={displayName}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={() => {
                              if (!localFailed) {
                                // local static file failed → try Drive proxy next
                                setFailedLocalThumbs(prev => new Set(Array.from(prev).concat(file.id)));
                              } else {
                                // Drive proxy also failed → show PDF icon
                                setFailedThumbs(prev => new Set(Array.from(prev).concat(file.id)));
                              }
                            }}
                          />
                        ) : (
                          <div style={{ width: "55%", height: "70%" }}>
                            <PdfIcon color={t.gold} />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: "0.7rem 0.75rem" }}>
                        {/* Category as title */}
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: t.text, marginBottom: "0.2rem" }}>
                          {category}
                        </div>
                        {/* Parsed date */}
                        {parsedDate && (
                          <div style={{ fontSize: "0.62rem", color: t.gold, marginBottom: "0.25rem" }}>
                            {parsedDate.label}
                          </div>
                        )}
                        {/* Filename small */}
                        <div style={{
                          fontSize: "0.55rem", color: t.textMuted, lineHeight: 1.3,
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }} title={displayName}>
                          {displayName}
                        </div>
                        {/* Size + cache status */}
                        <div style={{ fontSize: "0.52rem", color: t.textFaint, marginTop: "0.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>{formatSize(file.size)}</span>
                          {isCached && <span style={{ color: t.gold, fontSize: "0.5rem" }}>● local</span>}
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
