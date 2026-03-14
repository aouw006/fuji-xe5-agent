"use client";
import { useState, useEffect, useCallback } from "react";
import { darkTheme, lightTheme } from "@/lib/theme";
import Icon from "@/components/Icon";
import type { DigestData } from "@/app/api/digest/route";

const CATEGORY_LABELS: Record<string, string> = {
  news: "Firmware & News",
  recipes: "Film Recipes",
  gear: "Gear & Lenses",
  community: "Community",
};
const CATEGORY_ORDER = ["news", "recipes", "gear", "community"];

interface SavedEditionMeta {
  id: string;
  date_label: string;
  generated_at: string;
  created_at: string;
}

interface SavedEditionFull extends SavedEditionMeta {
  data: DigestData;
}

export default function DigestPage() {
  const [isDark, setIsDark] = useState(true);
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPinned, setDrawerPinned] = useState(false);
  const [editions, setEditions] = useState<SavedEditionMeta[]>([]);
  const [activeEdition, setActiveEdition] = useState<SavedEditionFull | null>(null);
  const [loadingEdition, setLoadingEdition] = useState<string | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("xe5_theme");
    setIsDark(stored !== "light");
    const handler = (e: StorageEvent) => { if (e.key === "xe5_theme") setIsDark(e.newValue !== "light"); };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    fetchDigest();
    fetchEditions();
  }, []);

  const fetchDigest = async (force = false) => {
    if (force) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/digest${force ? "?force=1" : ""}`);
      if (!res.ok) throw new Error("Failed");
      const data: DigestData = await res.json();
      if (!force && (!data.stories || data.stories.length === 0)) {
        const fresh = await fetch("/api/digest?force=1");
        if (fresh.ok) { setDigest(await fresh.json()); setLoading(false); setRefreshing(false); return; }
      }
      setDigest(data);
      setActiveEdition(null);
    } catch { setError("Could not load the digest. Please try again."); }
    setLoading(false);
    setRefreshing(false);
  };

  const fetchEditions = async () => {
    try {
      const res = await fetch("/api/digest/saved");
      const data = await res.json();
      setEditions(data.editions || []);
    } catch {}
  };

  const handleSave = useCallback(async () => {
    if (!digest || saving) return;
    setSaving(true);
    try {
      const dateLabel = new Date().toLocaleDateString("en-AU", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      });
      const res = await fetch("/api/digest/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: digest, dateLabel }),
      });
      const result = await res.json();
      if (result.saved || result.duplicate) {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
        await fetchEditions();
        if (!drawerOpen) setDrawerOpen(true);
      }
    } catch {}
    setSaving(false);
  }, [digest, saving, drawerOpen]);

  const handleLoadEdition = async (edition: SavedEditionMeta) => {
    setLoadingEdition(edition.id);
    try {
      const res = await fetch("/api/digest/saved", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: edition.id }),
      });
      const full: SavedEditionFull = await res.json();
      setDigest(full.data);
      setActiveEdition(full);
      if (!drawerPinned) setDrawerOpen(false);
    } catch {}
    setLoadingEdition(null);
  };

  const handleDeleteEdition = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditions(prev => prev.filter(ed => ed.id !== id));
    if (activeEdition?.id === id) { setActiveEdition(null); fetchDigest(); }
    try {
      await fetch("/api/digest/saved", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {}
  };

  const t = isDark ? darkTheme : lightTheme;
  const hero = digest?.stories[0] || null;
  const midStories = digest?.stories.slice(1, 4) || [];
  const briefs = digest?.stories.slice(4) || [];

  const isSavedAlready = digest
    ? editions.some(e => e.generated_at === digest.generatedAt)
    : false;

  // When viewing a past edition, show its original date
  const displayDate = activeEdition
    ? activeEdition.date_label
    : new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "Georgia, 'Times New Roman', serif", display: "flex" }}>
      <style>{`
        * { box-sizing: border-box; }
        a { color: inherit; text-decoration: none; }
        .story-card:hover { opacity: 0.88; }
        .brief-item:hover { background: ${t.bgCard} !important; }
        .edition-row:hover { background: ${isDark ? "rgba(200,169,110,0.06)" : "rgba(176,136,64,0.08)"} !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 2px; }
      `}</style>

      {/* ── Saved Editions Drawer ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 30,
        width: drawerOpen || drawerPinned ? "220px" : "0",
        overflow: "hidden",
        transition: "width 0.25s ease",
        background: t.bgSidebar,
        borderRight: `1px solid ${t.border}`,
        boxShadow: drawerOpen || drawerPinned ? "4px 0 20px rgba(0,0,0,0.25)" : "none",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ width: "220px", height: "100%", display: "flex", flexDirection: "column" }}>

          {/* Drawer header */}
          <div style={{ padding: "1rem", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: t.gold, fontFamily: "'DM Mono', monospace" }}>
              Saved Editions
            </div>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <button onClick={() => setDrawerPinned(p => !p)} title={drawerPinned ? "Unpin drawer" : "Pin drawer open"}
                style={{ background: "transparent", border: `1px solid ${drawerPinned ? t.gold : t.borderCard}`, color: drawerPinned ? t.gold : t.textFaint, width: "22px", height: "22px", borderRadius: "2px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                <Icon name="pin" size={11} />
              </button>
              {!drawerPinned && (
                <button onClick={() => setDrawerOpen(false)}
                  style={{ background: "transparent", border: `1px solid ${t.borderCard}`, color: t.textFaint, width: "22px", height: "22px", borderRadius: "2px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="close" size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Edition list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0.4rem 0" }}>
            {editions.length === 0 ? (
              <div style={{ padding: "1.5rem 1rem", fontSize: "0.62rem", color: t.textVeryFaint, fontFamily: "'DM Mono', monospace", lineHeight: 1.8, textAlign: "center" }}>
                No saved editions yet.<br />Press ♡ to save today's.
              </div>
            ) : (
              editions.map(edition => {
                const isActive = activeEdition?.id === edition.id;
                const isLoading = loadingEdition === edition.id;
                return (
                  <div key={edition.id} className="edition-row" onClick={() => handleLoadEdition(edition)}
                    style={{ padding: "0.65rem 1rem", cursor: "pointer", transition: "background 0.15s", background: isActive ? (isDark ? "rgba(200,169,110,0.1)" : "rgba(176,136,64,0.12)") : "transparent", borderLeft: `2px solid ${isActive ? t.gold : "transparent"}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.65rem", color: isActive ? t.gold : t.text, fontFamily: "'DM Mono', monospace", lineHeight: 1.4 }}>
                        {isLoading ? "Loading…" : edition.date_label}
                      </div>
                      <div style={{ fontSize: "0.5rem", color: t.textVeryFaint, marginTop: "0.1rem" }}>
                        {new Date(edition.created_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <button onClick={e => handleDeleteEdition(edition.id, e)}
                      style={{ background: "transparent", border: "none", color: t.textVeryFaint, cursor: "pointer", padding: "0.1rem", flexShrink: 0, transition: "color 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#e05555"}
                      onMouseLeave={e => e.currentTarget.style.color = t.textVeryFaint}>
                      <Icon name="close" size={10} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Back to today */}
          {activeEdition && (
            <div style={{ padding: "0.75rem 1rem", borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
              <button onClick={() => { fetchDigest(); if (!drawerPinned) setDrawerOpen(false); }}
                style={{ width: "100%", background: "transparent", border: `1px solid ${t.borderCard}`, color: t.gold, padding: "0.4rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.58rem", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", transition: "all 0.2s" }}>
                ↺ Today's Edition
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {drawerOpen && !drawerPinned && (
        <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 29, background: "rgba(0,0,0,0.4)" }} />
      )}

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0, marginLeft: drawerPinned ? "220px" : "0", transition: "margin-left 0.25s ease" }}>

        {/* ── Masthead ── */}
        <header style={{ borderBottom: `3px solid ${t.text}`, padding: "1.5rem 2rem 1rem", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>

            {/* Left — drawer toggle + back link */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <button onClick={() => setDrawerOpen(o => !o)} title="Saved editions"
                style={{ background: "transparent", border: `1px solid ${editions.length > 0 ? t.gold : t.border}`, color: editions.length > 0 ? t.gold : t.textFaint, padding: "0.3rem 0.6rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.58rem", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: "0.35rem", transition: "all 0.2s" }}>
                <Icon name="menu" size={12} />
                {editions.length > 0 && <span>{editions.length}</span>}
              </button>
              <a href="/" style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
                ← Back to Agent
              </a>
            </div>

            {/* Right — save heart + refresh */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button onClick={handleSave} disabled={!digest || loading || saving}
                title={isSavedAlready ? "Already saved" : "Save this edition"}
                style={{
                  background: justSaved ? (isDark ? "rgba(200,169,110,0.15)" : "rgba(176,136,64,0.18)") : "transparent",
                  border: `1px solid ${isSavedAlready || justSaved ? t.gold : t.border}`,
                  color: isSavedAlready || justSaved ? t.gold : t.textFaint,
                  padding: "0.3rem 0.8rem", borderRadius: "2px",
                  cursor: !digest || loading || saving ? "not-allowed" : "pointer",
                  fontSize: "0.58rem", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
                  transition: "all 0.2s", display: "flex", alignItems: "center", gap: "0.35rem",
                  height: "28px",
                }}>
                <span>{isSavedAlready ? "♥" : "♡"}</span>
                <span>{saving ? "Saving…" : justSaved ? "Saved!" : "Save"}</span>
              </button>
              <button onClick={() => fetchDigest(true)} disabled={refreshing}
                style={{ background: "transparent", border: `1px solid ${t.border}`, color: refreshing ? t.textFaint : t.gold, padding: "0.3rem 0.8rem", borderRadius: "2px", cursor: refreshing ? "not-allowed" : "pointer", fontSize: "0.58rem", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", transition: "all 0.2s", height: "28px" }}>
                {refreshing ? "Refreshing…" : "↻ Refresh"}
              </button>
            </div>
          </div>

          {/* Past edition banner */}
          {activeEdition && (
            <div style={{ background: isDark ? "rgba(200,169,110,0.07)" : "rgba(176,136,64,0.09)", border: `1px solid ${isDark ? "rgba(200,169,110,0.3)" : "rgba(176,136,64,0.35)"}`, borderRadius: "2px", padding: "0.4rem 1rem", marginBottom: "0.75rem", fontSize: "0.6rem", color: t.gold, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
              <span>📰</span>
              <span style={{ textTransform: "uppercase" }}>Past Edition</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{activeEdition.date_label}</span>
            </div>
          )}

          <div style={{ borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: "0.4rem 0", marginBottom: "0.5rem" }}>
            <div style={{ fontSize: "0.55rem", letterSpacing: "0.3em", textTransform: "uppercase", color: t.textFaint, fontFamily: "'DM Mono', monospace" }}>
              The Fujifilm X-E5 Field Dispatch
            </div>
          </div>

          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2.5rem, 6vw, 4.5rem)", fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 0.25rem", lineHeight: 1, color: t.text }}>
            Fuji Daily
          </h1>
          <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
            {displayDate}
            {digest && <span style={{ marginLeft: "1.5rem", color: t.gold }}>{digest.stories.length} stories</span>}
          </div>
        </header>

        {/* ── Category nav ── */}
        <nav style={{ borderBottom: `1px solid ${t.border}`, padding: "0.5rem 2rem", display: "flex", gap: "2rem", overflowX: "auto" }}>
          {CATEGORY_ORDER.map(cat => (
            <a key={cat} href={`#${cat}`}
              style={{ fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", color: t.textFaint, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = t.gold}
              onMouseLeave={e => e.currentTarget.style.color = t.textFaint}>
              {CATEGORY_LABELS[cat]}
            </a>
          ))}
        </nav>

        {/* ── Content ── */}
        <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>

          {loading && (
            <div style={{ textAlign: "center", padding: "6rem 0" }}>
              <div style={{ width: "32px", height: "32px", border: `2px solid ${t.border}`, borderTopColor: t.gold, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 1.5rem" }} />
              <div style={{ fontSize: "0.7rem", color: t.textFaint, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>Assembling today's digest…</div>
            </div>
          )}

          {error && (
            <div style={{ textAlign: "center", padding: "4rem 0", color: t.textFaint }}>
              <div style={{ marginBottom: "1rem" }}>{error}</div>
              <button onClick={() => fetchDigest()} style={{ background: "transparent", border: `1px solid ${t.gold}`, color: t.gold, padding: "0.5rem 1.5rem", cursor: "pointer", fontSize: "0.65rem", fontFamily: "'DM Mono', monospace", borderRadius: "2px" }}>Try Again</button>
            </div>
          )}

          {!loading && !error && digest && (
            <div className="fade-in">

              {/* Hero */}
              {hero && (
                <a href={hero.url} target="_blank" rel="noopener noreferrer" className="story-card" style={{ display: "block", marginBottom: "2rem", transition: "opacity 0.2s" }}>
                  <div style={{ borderBottom: `1px solid ${t.border}`, paddingBottom: "0.3rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: "0.5rem", letterSpacing: "0.2em", textTransform: "uppercase", color: t.gold, fontFamily: "'DM Mono', monospace" }}>{CATEGORY_LABELS[hero.category]}</span>
                    <span style={{ fontSize: "0.5rem", color: t.textFaint, fontFamily: "'DM Mono', monospace" }}>{hero.source}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: hero.image ? "1fr 1fr" : "1fr", gap: "1.5rem", alignItems: "start" }}>
                    <div>
                      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.4rem, 3vw, 2.2rem)", fontWeight: 700, lineHeight: 1.2, margin: "0 0 0.75rem", color: t.text }}>{hero.title}</h2>
                      <p style={{ fontSize: "0.9rem", color: t.textMuted, lineHeight: 1.7, margin: 0 }}>{hero.summary}</p>
                      <div style={{ marginTop: "0.75rem", fontSize: "0.55rem", color: t.gold, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>Read at {hero.source} →</div>
                    </div>
                    {hero.image && (
                      <div style={{ borderRadius: "3px", overflow: "hidden", aspectRatio: "16/9", background: t.bgCard }}>
                        <img src={hero.image} alt={hero.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.parentElement!.style.display = "none"; }} />
                      </div>
                    )}
                  </div>
                </a>
              )}

              {/* Mid stories */}
              {midStories.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${midStories.length}, 1fr)`, gap: "1.5rem", borderTop: `2px solid ${t.text}`, borderBottom: `1px solid ${t.border}`, padding: "1.5rem 0", marginBottom: "2rem" }}>
                  {midStories.map((story, i) => (
                    <a key={story.id} href={story.url} target="_blank" rel="noopener noreferrer" className="story-card"
                      style={{ display: "block", transition: "opacity 0.2s", borderRight: i < midStories.length - 1 ? `1px solid ${t.border}` : "none", paddingRight: i < midStories.length - 1 ? "1.5rem" : 0 }}>
                      {story.image && (
                        <div style={{ borderRadius: "2px", overflow: "hidden", aspectRatio: "3/2", background: t.bgCard, marginBottom: "0.75rem" }}>
                          <img src={story.image} alt={story.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.parentElement!.style.display = "none"; }} />
                        </div>
                      )}
                      <div style={{ fontSize: "0.48rem", letterSpacing: "0.18em", textTransform: "uppercase", color: t.gold, fontFamily: "'DM Mono', monospace", marginBottom: "0.4rem" }}>{CATEGORY_LABELS[story.category]}</div>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 700, lineHeight: 1.3, margin: "0 0 0.5rem", color: t.text }}>{story.title}</h3>
                      <p style={{ fontSize: "0.72rem", color: t.textMuted, lineHeight: 1.6, margin: "0 0 0.5rem" }}>{story.summary}</p>
                      <div style={{ fontSize: "0.5rem", color: t.textFaint, fontFamily: "'DM Mono', monospace" }}>{story.source}</div>
                    </a>
                  ))}
                </div>
              )}

              {/* Briefs */}
              {briefs.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.5rem", letterSpacing: "0.25em", textTransform: "uppercase", color: t.textFaint, fontFamily: "'DM Mono', monospace", marginBottom: "0.75rem", paddingBottom: "0.3rem", borderBottom: `1px solid ${t.border}` }}>Also Today</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                    {briefs.map(story => (
                      <a key={story.id} href={story.url} target="_blank" rel="noopener noreferrer" className="brief-item"
                        style={{ display: "flex", gap: "0.75rem", padding: "0.75rem", borderBottom: `1px solid ${t.border}`, transition: "background 0.15s", alignItems: "flex-start", background: "transparent" }}>
                        {story.image && (
                          <div style={{ flexShrink: 0, width: "60px", height: "44px", borderRadius: "2px", overflow: "hidden", background: t.bgCard }}>
                            <img src={story.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.parentElement!.style.display = "none"; }} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.45rem", letterSpacing: "0.15em", textTransform: "uppercase", color: t.gold, fontFamily: "'DM Mono', monospace", marginBottom: "0.2rem" }}>{CATEGORY_LABELS[story.category]}</div>
                          <div style={{ fontSize: "0.72rem", fontFamily: "'Playfair Display', serif", lineHeight: 1.3, color: t.text, marginBottom: "0.2rem" }}>{story.title}</div>
                          <div style={{ fontSize: "0.5rem", color: t.textFaint, fontFamily: "'DM Mono', monospace" }}>{story.source}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div style={{ marginTop: "3rem", paddingTop: "1rem", borderTop: `1px solid ${t.border}`, textAlign: "center" }}>
                <div style={{ fontSize: "0.5rem", color: t.textVeryFaint, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>
                  Fuji Daily · Powered by XE5 Research Agent · {digest.stories.length} stories · Cached for 24 hours
                </div>
                {digest.generatedAt && (
                  <div style={{ fontSize: "0.45rem", color: t.textVeryFaint, fontFamily: "'DM Mono', monospace", marginTop: "0.25rem" }}>
                    Generated {new Date(digest.generatedAt).toLocaleString("en-AU")}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
