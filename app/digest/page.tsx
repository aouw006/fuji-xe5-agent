"use client";
import { useState, useEffect } from "react";
import { darkTheme, lightTheme } from "@/lib/theme";
import type { DigestData, DigestStory } from "@/app/api/digest/route";

const CATEGORY_LABELS: Record<string, string> = {
  news: "Firmware & News",
  recipes: "Film Recipes",
  gear: "Gear & Lenses",
  community: "Community",
};

const CATEGORY_ORDER = ["news", "recipes", "gear", "community"];

export default function DigestPage() {
  const [isDark, setIsDark] = useState(true);
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("xe5_theme");
    setIsDark(stored !== "light");
    const handler = (e: StorageEvent) => { if (e.key === "xe5_theme") setIsDark(e.newValue !== "light"); };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => { fetchDigest(); }, []);

  const fetchDigest = async (force = false) => {
    if (force) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/digest${force ? "?force=1" : ""}`);
      if (!res.ok) throw new Error("Failed to load digest");
      const data: DigestData = await res.json();
      // If cached result is empty, auto-fetch fresh
      if (!force && (!data.stories || data.stories.length === 0)) {
        const fresh = await fetch("/api/digest?force=1");
        if (fresh.ok) {
          const freshData: DigestData = await fresh.json();
          setDigest(freshData);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }
      setDigest(data);
    } catch (e) {
      setError("Could not load the digest. Please try again.");
    }
    setLoading(false);
    setRefreshing(false);
  };

  const t = isDark ? darkTheme : lightTheme;

  const grouped = digest ? CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = digest.stories.filter(s => s.category === cat);
    return acc;
  }, {} as Record<string, DigestStory[]>) : {};

  const hero = digest?.stories[0] || null;
  const midStories = digest?.stories.slice(1, 4) || [];
  const briefs = digest?.stories.slice(4) || [];

  const formattedDate = new Date().toLocaleDateString("en-AU", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, transition: "background 0.3s, color 0.3s", fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        a { color: inherit; text-decoration: none; }
        .story-card:hover { opacity: 0.88; }
        .brief-item:hover { background: ${t.bgCard} !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
      `}</style>

      {/* ── Masthead ── */}
      <header style={{ borderBottom: `3px solid ${t.text}`, padding: "1.5rem 2rem 1rem", textAlign: "center", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <a href="/" style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>← Back to Agent</a>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={() => fetchDigest(true)} disabled={refreshing}
              style={{ background: "transparent", border: `1px solid ${t.border}`, color: refreshing ? t.textFaint : t.gold, padding: "0.3rem 0.8rem", borderRadius: "2px", cursor: refreshing ? "not-allowed" : "pointer", fontSize: "0.58rem", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", transition: "all 0.2s" }}>
              {refreshing ? "Refreshing…" : "↻ Refresh"}
            </button>
          </div>
        </div>

        {/* Title */}
        <div style={{ borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: "0.4rem 0", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.55rem", letterSpacing: "0.3em", textTransform: "uppercase", color: t.textFaint, fontFamily: "'DM Mono', monospace" }}>
            The Fujifilm X-E5 Field Dispatch
          </div>
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2.5rem, 6vw, 4.5rem)", fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 0.25rem", lineHeight: 1, color: t.text }}>
          Fuji Daily
        </h1>
        <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>
          {formattedDate}
          {digest && <span style={{ marginLeft: "1.5rem", color: t.gold }}>
            {digest.stories.length} stories
          </span>}
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

            {/* ── Hero ── */}
            {hero && (
              <a href={hero.url} target="_blank" rel="noopener noreferrer" className="story-card" style={{ display: "block", marginBottom: "2rem", transition: "opacity 0.2s", cursor: "pointer" }}>
                <div style={{ borderBottom: `1px solid ${t.border}`, paddingBottom: "0.3rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "0.5rem", letterSpacing: "0.2em", textTransform: "uppercase", color: t.gold, fontFamily: "'DM Mono', monospace" }}>
                    {CATEGORY_LABELS[hero.category]}
                  </span>
                  <span style={{ fontSize: "0.5rem", color: t.textFaint, fontFamily: "'DM Mono', monospace" }}>{hero.source}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: hero.image ? "1fr 1fr" : "1fr", gap: "1.5rem", alignItems: "start" }}>
                  <div>
                    <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.4rem, 3vw, 2.2rem)", fontWeight: 700, lineHeight: 1.2, margin: "0 0 0.75rem", color: t.text }}>
                      {hero.title}
                    </h2>
                    <p style={{ fontSize: "0.9rem", color: t.textMuted, lineHeight: 1.7, margin: 0 }}>{hero.summary}</p>
                    <div style={{ marginTop: "0.75rem", fontSize: "0.55rem", color: t.gold, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>
                      Read at {hero.source} →
                    </div>
                  </div>
                  {hero.image && (
                    <div style={{ borderRadius: "3px", overflow: "hidden", aspectRatio: "16/9", background: t.bgCard }}>
                      <img src={hero.image} alt={hero.title} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={e => { e.currentTarget.parentElement!.style.display = "none"; }} />
                    </div>
                  )}
                </div>
              </a>
            )}

            {/* ── Mid stories ── */}
            {midStories.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${midStories.length}, 1fr)`, gap: "1.5rem", borderTop: `2px solid ${t.text}`, borderBottom: `1px solid ${t.border}`, padding: "1.5rem 0", marginBottom: "2rem" }}>
                {midStories.map((story, i) => (
                  <a key={story.id} href={story.url} target="_blank" rel="noopener noreferrer" className="story-card"
                    style={{ display: "block", transition: "opacity 0.2s", borderRight: i < midStories.length - 1 ? `1px solid ${t.border}` : "none", paddingRight: i < midStories.length - 1 ? "1.5rem" : 0 }}>
                    {story.image && (
                      <div style={{ borderRadius: "2px", overflow: "hidden", aspectRatio: "3/2", background: t.bgCard, marginBottom: "0.75rem" }}>
                        <img src={story.image} alt={story.title} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={e => { e.currentTarget.parentElement!.style.display = "none"; }} />
                      </div>
                    )}
                    <div style={{ fontSize: "0.48rem", letterSpacing: "0.18em", textTransform: "uppercase", color: t.gold, fontFamily: "'DM Mono', monospace", marginBottom: "0.4rem" }}>
                      {CATEGORY_LABELS[story.category]}
                    </div>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 700, lineHeight: 1.3, margin: "0 0 0.5rem", color: t.text }}>
                      {story.title}
                    </h3>
                    <p style={{ fontSize: "0.72rem", color: t.textMuted, lineHeight: 1.6, margin: "0 0 0.5rem" }}>
                      {story.summary}
                    </p>
                    <div style={{ fontSize: "0.5rem", color: t.textFaint, fontFamily: "'DM Mono', monospace" }}>{story.source}</div>
                  </a>
                ))}
              </div>
            )}

            {/* ── Briefs ── */}
            {briefs.length > 0 && (
              <div>
                <div style={{ fontSize: "0.5rem", letterSpacing: "0.25em", textTransform: "uppercase", color: t.textFaint, fontFamily: "'DM Mono', monospace", marginBottom: "0.75rem", paddingBottom: "0.3rem", borderBottom: `1px solid ${t.border}` }}>
                  Also Today
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0" }}>
                  {briefs.map((story, i) => (
                    <a key={story.id} href={story.url} target="_blank" rel="noopener noreferrer" className="brief-item"
                      style={{ display: "flex", gap: "0.75rem", padding: "0.75rem", borderBottom: `1px solid ${t.border}`, transition: "background 0.15s", alignItems: "flex-start", background: "transparent" }}>
                      {story.image && (
                        <div style={{ flexShrink: 0, width: "60px", height: "44px", borderRadius: "2px", overflow: "hidden", background: t.bgCard }}>
                          <img src={story.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={e => { e.currentTarget.parentElement!.style.display = "none"; }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.45rem", letterSpacing: "0.15em", textTransform: "uppercase", color: t.gold, fontFamily: "'DM Mono', monospace", marginBottom: "0.2rem" }}>
                          {CATEGORY_LABELS[story.category]}
                        </div>
                        <div style={{ fontSize: "0.72rem", fontFamily: "'Playfair Display', serif", lineHeight: 1.3, color: t.text, marginBottom: "0.2rem" }}>
                          {story.title}
                        </div>
                        <div style={{ fontSize: "0.5rem", color: t.textFaint, fontFamily: "'DM Mono', monospace" }}>{story.source}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* ── Footer ── */}
            <div style={{ marginTop: "3rem", paddingTop: "1rem", borderTop: `1px solid ${t.border}`, textAlign: "center" }}>
              <div style={{ fontSize: "0.5rem", color: t.textVeryFaint, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>
                Fuji Daily · Powered by XE5 Research Agent · Content sourced from the web · {digest.stories.length} stories · Cached for 24 hours
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
  );
}