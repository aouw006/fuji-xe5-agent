"use client";
import Icon from "@/components/Icon";

import { useState, useEffect } from "react";
import { darkTheme, lightTheme } from "@/lib/theme";

interface Props {
  isDark: boolean;
  onPrompt: (prompt: string) => void;
}

interface DailyShot {
  imageUrl: string;
  thumbUrl: string;
  photographerName: string;
  photographerUrl: string;
  unsplashLink: string;
  description: string;
  recipe: DailyRecipe;
}

interface DailyRecipe {
  name: string;
  filmSim: string;
  grain: string;
  colorChrome: string;
  highlights: string;
  shadows: string;
  color: string;
  sharpness: string;
  nr: string;
  wb: string;
  mood: string;
  bestFor: string;
}

// Deterministic recipe pool — one per day based on day-of-year
const DAILY_RECIPES: DailyRecipe[] = [
  { name: "Tokyo Dusk", filmSim: "Classic Chrome", grain: "Weak / Large", colorChrome: "Strong", highlights: "-1", shadows: "+1", color: "-1", sharpness: "-1", nr: "-2", wb: "Daylight", mood: "Muted, cinematic, slightly melancholic", bestFor: "Street, urban" },
  { name: "Golden Velvia", filmSim: "Velvia", grain: "Off", colorChrome: "Off", highlights: "-2", shadows: "0", color: "+3", sharpness: "+1", nr: "-2", wb: "Auto (R+1 B-1)", mood: "Rich, saturated, golden hour magic", bestFor: "Landscape, travel" },
  { name: "Soft Skin", filmSim: "Pro Neg Std", grain: "Weak / Small", colorChrome: "Off", highlights: "0", shadows: "+1", color: "+1", sharpness: "-2", nr: "0", wb: "Cloudy", mood: "Flattering, gentle, timeless", bestFor: "Portrait, people" },
  { name: "Eterna Streets", filmSim: "Eterna", grain: "Strong / Large", colorChrome: "Weak", highlights: "-2", shadows: "0", color: "0", sharpness: "-1", nr: "-3", wb: "Fluorescent 3", mood: "Filmic, moody, cinematic grain", bestFor: "Street, documentary" },
  { name: "Acros Pull", filmSim: "Acros (Green)", grain: "Strong / Large", colorChrome: "N/A", highlights: "-1", shadows: "+1", color: "N/A", sharpness: "0", nr: "-4", wb: "Daylight", mood: "High-contrast B&W with green filter warmth", bestFor: "Architecture, landscape" },
  { name: "Coastal Chrome", filmSim: "Classic Neg", grain: "Weak / Large", colorChrome: "Weak", highlights: "-1", shadows: "+2", color: "-2", sharpness: "-1", nr: "-2", wb: "Auto (R+1 B+1)", mood: "Faded, beachy, nostalgic", bestFor: "Travel, lifestyle" },
  { name: "Reala Morning", filmSim: "Reala Ace", grain: "Weak / Small", colorChrome: "Off", highlights: "0", shadows: "0", color: "+1", sharpness: "0", nr: "-1", wb: "Auto", mood: "Clean, natural, true-to-life colours", bestFor: "Every day, street" },
  { name: "Bleach Drama", filmSim: "Eterna Bleach Bypass", grain: "Strong / Large", colorChrome: "Strong", highlights: "-2", shadows: "+1", color: "0", sharpness: "+1", nr: "-4", wb: "Daylight", mood: "Desaturated, contrasty, otherworldly", bestFor: "Architecture, dark themes" },
];

// Unsplash queries that tend to return beautiful Fuji-style photography
const PHOTO_QUERIES = [
  "fujifilm street photography",
  "film photography japan",
  "analog photography street",
  "fujifilm travel photography",
  "rangefinder film street",
  "kodak film photography street",
  "film photography portrait",
  "street photography tokyo",
];

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getTodayKey(): string {
  const d = new Date();
  return `xe5_sotd_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`;
}

export default function ShotOfTheDay({ isDark, onPrompt }: Props) {
  const t = isDark ? darkTheme : lightTheme;
  const [shot, setShot] = useState<DailyShot | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    loadShot();
  }, []);

  const loadShot = async () => {
    const key = getTodayKey();
    const cached = localStorage.getItem(key);

    if (cached) {
      try {
        setShot(JSON.parse(cached));
        setLoading(false);
        return;
      } catch {}
    }

    await fetchShot(key);
  };

  const fetchShot = async (cacheKey: string) => {
    setLoading(true);
    const day = getDayOfYear();
    const recipe = DAILY_RECIPES[day % DAILY_RECIPES.length];
    const query = PHOTO_QUERIES[day % PHOTO_QUERIES.length];

    try {
      const res = await fetch(
        `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
        {
          headers: {
            Authorization: `Client-ID ${process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY}`,
          },
        }
      );

      if (!res.ok) throw new Error("Unsplash unavailable");

      const data = await res.json();

      const newShot: DailyShot = {
        imageUrl: data.urls.regular,
        thumbUrl: data.urls.small,
        photographerName: data.user.name,
        photographerUrl: data.user.links.html,
        unsplashLink: data.links.html,
        description: data.description || data.alt_description || "Untitled",
        recipe,
      };

      localStorage.setItem(cacheKey, JSON.stringify(newShot));
      setShot(newShot);
    } catch {
      // Fallback: still show recipe without image
      const fallback: DailyShot = {
        imageUrl: "",
        thumbUrl: "",
        photographerName: "",
        photographerUrl: "",
        unsplashLink: "",
        description: "Today's featured recipe",
        recipe,
      };
      setShot(fallback);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ borderRadius: "6px", border: `1px solid ${t.borderCard}`, overflow: "hidden", background: t.bgCard, marginBottom: "1.5rem" }}>
        <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", gap: "5px" }}>
            {[0,1,2].map(n => (
              <div key={n} style={{ width: "5px", height: "5px", borderRadius: "50%", background: t.gold, animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!shot) return null;

  const recipe = shot.recipe;

  return (
    <div style={{ borderRadius: "6px", border: `1px solid ${isDark ? "rgba(200,169,110,0.15)" : "rgba(176,136,64,0.2)"}`, overflow: "hidden", background: t.bgCard, marginBottom: "1.5rem", transition: "all 0.3s" }}>

      {/* Image */}
      {shot.imageUrl && (
        <div style={{ position: "relative", height: "200px", overflow: "hidden", background: t.bgButton }}>
          <img
            src={shot.imageUrl}
            alt={shot.description}
            onLoad={() => setImageLoaded(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: imageLoaded ? 1 : 0, transition: "opacity 0.5s" }}
          />
          {/* Gradient overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.75) 100%)" }} />

          {/* Badge */}
          <div style={{ position: "absolute", top: "0.75rem", left: "0.75rem", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(200,169,110,0.3)", borderRadius: "3px", padding: "0.2rem 0.55rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.6rem", color: "#c8a96e", letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>📸 Shot of the Day</span>
          </div>

          {/* Recipe name overlay */}
          <div style={{ position: "absolute", bottom: "0.75rem", left: "0.75rem", right: "0.75rem" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              {recipe.name}
            </div>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.75)", marginTop: "0.1rem" }}>
              {recipe.filmSim} · {recipe.mood}
            </div>
          </div>

          {/* Photo credit */}
          {shot.photographerName && (
            <a href={shot.unsplashLink} target="_blank" rel="noopener noreferrer"
              style={{ position: "absolute", bottom: "0.5rem", right: "0.75rem", fontSize: "0.5rem", color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>
              📷 {shot.photographerName} / Unsplash
            </a>
          )}
        </div>
      )}

      {/* Recipe summary */}
      <div style={{ padding: "0.85rem 1rem" }}>
        {!shot.imageUrl && (
          <div style={{ fontSize: "0.6rem", color: t.gold, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.5rem", fontFamily: "'DM Mono', monospace" }}>
            📸 Shot of the Day
          </div>
        )}

        {/* Key settings row */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          {[
            ["Film Sim", recipe.filmSim],
            ["Highlights", recipe.highlights],
            ["Shadows", recipe.shadows],
            ["Colour", recipe.color],
          ].map(([label, value]) => (
            <div key={label} style={{ background: t.bgButton, border: `1px solid ${isDark ? "rgba(200,169,110,0.1)" : "rgba(176,136,64,0.15)"}`, borderRadius: "3px", padding: "0.25rem 0.5rem" }}>
              <div style={{ fontSize: "0.48rem", color: t.textVeryFaint, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
              <div style={{ fontSize: "0.7rem", color: t.text, fontFamily: "'DM Mono', monospace", marginTop: "0.1rem" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Expand / collapse full recipe */}
        <button onClick={() => setExpanded(!expanded)}
          style={{ background: "transparent", border: "none", color: t.gold, cursor: "pointer", fontSize: "0.65rem", letterSpacing: "0.08em", padding: 0, display: "flex", alignItems: "center", gap: "0.3rem", transition: "opacity 0.2s" }}>
          {expanded ? "▲ Hide full recipe" : "▼ Show full recipe"}
        </button>

        {expanded && (
          <div style={{ marginTop: "0.75rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem 1rem" }}>
            {[
              ["Film Simulation", recipe.filmSim],
              ["Grain", recipe.grain],
              ["Colour Chrome", recipe.colorChrome],
              ["White Balance", recipe.wb],
              ["Highlight Tone", recipe.highlights],
              ["Shadow Tone", recipe.shadows],
              ["Colour", recipe.color],
              ["Sharpness", recipe.sharpness],
              ["Noise Reduction", recipe.nr],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", paddingBottom: "0.2rem", borderBottom: `1px solid ${t.border}` }}>
                <span style={{ color: t.textFaint }}>{label}</span>
                <span style={{ color: t.text, fontFamily: "'DM Mono', monospace" }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: "0.85rem", display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => onPrompt(`Tell me more about the ${recipe.name} recipe using ${recipe.filmSim}`)}
            style={{ flex: 1, background: isDark ? "rgba(200,169,110,0.08)" : "rgba(176,136,64,0.1)", border: `1px solid ${isDark ? "rgba(200,169,110,0.2)" : "rgba(176,136,64,0.25)"}`, color: t.gold, padding: "0.45rem 0.75rem", borderRadius: "3px", cursor: "pointer", fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(200,169,110,0.14)" : "rgba(176,136,64,0.16)"}
            onMouseLeave={e => e.currentTarget.style.background = isDark ? "rgba(200,169,110,0.08)" : "rgba(176,136,64,0.1)"}>
            <>Ask about this recipe <Icon name="arrowRight" size={12} /></>
          </button>
          <button
            onClick={() => fetchShot(getTodayKey() + "_refresh_" + Date.now())}
            title="New photo"
            style={{ background: "transparent", border: `1px solid ${t.borderCard}`, color: t.textVeryFaint, padding: "0.45rem 0.6rem", borderRadius: "3px", cursor: "pointer", fontSize: "0.75rem", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.borderCard; e.currentTarget.style.color = t.textVeryFaint; }}>
            <Icon name="reset" size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
