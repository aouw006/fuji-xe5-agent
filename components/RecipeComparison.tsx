"use client";

import { useState, useEffect } from "react";
import { darkTheme, lightTheme } from "@/lib/theme";
import { RecipeData } from "./RecipeCard";

interface SavedRecipe extends RecipeData {
  id: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  isDark: boolean;
}

const SETTINGS_ORDER = [
  "Film Simulation",
  "Grain",
  "Color Chrome Effect",
  "Color Chrome FX Blue",
  "White Balance",
  "Highlight Tone",
  "Shadow Tone",
  "Color",
  "Sharpness",
  "Noise Reduction",
  "Clarity",
];

function normaliseLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getSettingValue(recipe: SavedRecipe | null, label: string): string {
  if (!recipe?.settings) return "—";
  const norm = normaliseLabel(label);
  const match = recipe.settings.find((s: { label: string; value: string }) =>
    normaliseLabel(s.label).includes(norm) || norm.includes(normaliseLabel(s.label))
  );
  return match?.value || "—";
}

export default function RecipeComparison({ open, onClose, isDark }: Props) {
  const t = isDark ? darkTheme : lightTheme;
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (open) fetchRecipes();
  }, [open]);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recipes");
      const data = await res.json();
      const r = data.recipes || [];
      setRecipes(r);
      if (r.length >= 1) setLeftId(r[0].id);
      if (r.length >= 2) setRightId(r[1].id);
    } catch {}
    setLoading(false);
  };

  const leftRecipe = recipes.find(r => r.id === leftId) || null;
  const rightRecipe = recipes.find(r => r.id === rightId) || null;

  if (!open) return null;

  const selectStyle = {
    background: t.bgInput,
    border: `1px solid ${t.borderMid}`,
    borderRadius: "3px",
    color: t.text,
    padding: "0.4rem 0.6rem",
    fontSize: "0.72rem",
    outline: "none",
    width: "100%",
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
  };

  function isDifferent(label: string): boolean {
    if (!leftRecipe || !rightRecipe) return false;
    return getSettingValue(leftRecipe, label) !== getSettingValue(rightRecipe, label);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 40, backdropFilter: "blur(4px)" }} />

      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(720px, 96vw)",
        maxHeight: "90vh",
        zIndex: 50,
        background: t.bgSidebar,
        border: `1px solid ${t.borderSidebar}`,
        borderRadius: "8px",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "fadeIn 0.2s ease",
      }}>

        {/* Header */}
        <div style={{ padding: "1.1rem 1.5rem", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.05rem", fontWeight: 700, color: t.text }}>Recipe Comparison</div>
            <div style={{ fontSize: "0.57rem", color: t.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "0.1rem" }}>Compare two saved recipes side by side</div>
          </div>
          <button onClick={onClose}
            style={{ background: "transparent", border: `1px solid ${t.borderSidebar}`, color: t.textFaint, width: "30px", height: "30px", borderRadius: "2px", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.borderSidebar; e.currentTarget.style.color = t.textFaint; }}>
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "1.25rem 1.5rem" }}>

          {loading && (
            <div style={{ textAlign: "center", padding: "3rem", color: t.textVeryFaint, fontSize: "0.75rem" }}>Loading recipes…</div>
          )}

          {!loading && recipes.length < 2 && (
            <div style={{ textAlign: "center", padding: "3rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🎞️</div>
              <div style={{ fontSize: "0.78rem", color: t.textMuted, lineHeight: 1.7 }}>
                You need at least 2 saved recipes to compare.<br />
                Star recipes from the chat to save them.
              </div>
            </div>
          )}

          {!loading && recipes.length >= 2 && (
            <>
              {/* Selectors */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "0.75rem", alignItems: "center", marginBottom: "1.25rem" }}>
                <div>
                  <div style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.35rem" }}>Recipe A</div>
                  <select value={leftId} onChange={e => setLeftId(e.target.value)} style={selectStyle}>
                    {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div style={{ fontSize: "1.2rem", color: t.textVeryFaint, paddingTop: "1.2rem" }}>⇄</div>
                <div>
                  <div style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.35rem" }}>Recipe B</div>
                  <select value={rightId} onChange={e => setRightId(e.target.value)} style={selectStyle}>
                    {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Recipe names + meta */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: "0", marginBottom: "0.75rem" }}>
                {[leftRecipe, null, rightRecipe].map((recipe, i) => {
                  if (i === 1) return <div key="mid" />;
                  return (
                    <div key={i} style={{ padding: "0.75rem", background: isDark ? "rgba(200,169,110,0.05)" : "rgba(176,136,64,0.07)", borderRadius: "4px", border: `1px solid ${isDark ? "rgba(200,169,110,0.12)" : "rgba(176,136,64,0.18)"}` }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.95rem", fontWeight: 700, color: t.text, marginBottom: "0.2rem" }}>{recipe?.name || "—"}</div>
                      {recipe?.mood && <div style={{ fontSize: "0.62rem", color: t.textFaint, fontStyle: "italic" }}>{recipe.mood}</div>}
                      {recipe?.bestFor && <div style={{ fontSize: "0.6rem", color: t.gold, marginTop: "0.2rem" }}>Best for: {recipe.bestFor}</div>}
                    </div>
                  );
                })}
              </div>

              {/* Diff table */}
              <div style={{ borderRadius: "4px", overflow: "hidden", border: `1px solid ${t.borderCard}` }}>
                {/* Header row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)" }}>
                  <div style={{ padding: "0.4rem 0.75rem", fontSize: "0.55rem", color: t.gold, letterSpacing: "0.12em", textTransform: "uppercase" }}>Recipe A</div>
                  <div style={{ padding: "0.4rem 0", fontSize: "0.55rem", color: t.textVeryFaint, textAlign: "center" }}>≠</div>
                  <div style={{ padding: "0.4rem 0.75rem", fontSize: "0.55rem", color: t.gold, letterSpacing: "0.12em", textTransform: "uppercase" }}>Recipe B</div>
                </div>

                {SETTINGS_ORDER.map((label, idx) => {
                  const diff = isDifferent(label);
                  const leftVal = getSettingValue(leftRecipe, label);
                  const rightVal = getSettingValue(rightRecipe, label);
                  const rowBg = diff
                    ? (isDark ? "rgba(200,169,110,0.07)" : "rgba(176,136,64,0.09)")
                    : (idx % 2 === 0 ? "transparent" : (isDark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.02)"));

                  return (
                    <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", background: rowBg, borderTop: `1px solid ${t.borderCard}` }}>
                      {/* Left value */}
                      <div style={{ padding: "0.55rem 0.75rem" }}>
                        <div style={{ fontSize: "0.52rem", color: t.textVeryFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.1rem" }}>{label}</div>
                        <div style={{ fontSize: "0.75rem", color: diff ? t.gold : t.textMuted, fontFamily: "'DM Mono', monospace", fontWeight: diff ? 600 : 400 }}>{leftVal}</div>
                      </div>

                      {/* Diff indicator */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {diff && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: t.gold, opacity: 0.8 }} />}
                      </div>

                      {/* Right value */}
                      <div style={{ padding: "0.55rem 0.75rem" }}>
                        <div style={{ fontSize: "0.52rem", color: t.textVeryFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.1rem" }}>{label}</div>
                        <div style={{ fontSize: "0.75rem", color: diff ? t.gold : t.textMuted, fontFamily: "'DM Mono', monospace", fontWeight: diff ? 600 : 400 }}>{rightVal}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Diff summary */}
              {leftRecipe && rightRecipe && (
                <div style={{ marginTop: "0.85rem", padding: "0.65rem 0.85rem", background: t.bgCard, borderRadius: "3px", border: `1px solid ${t.borderCard}` }}>
                  <span style={{ fontSize: "0.62rem", color: t.textFaint }}>
                    {SETTINGS_ORDER.filter(l => isDifferent(l)).length} of {SETTINGS_ORDER.length} settings differ
                    {SETTINGS_ORDER.filter(l => isDifferent(l)).length === 0 && " — these recipes are identical!"}
                  </span>
                  {SETTINGS_ORDER.filter(l => isDifferent(l)).length > 0 && (
                    <span style={{ fontSize: "0.62rem", color: t.gold, marginLeft: "0.5rem" }}>
                      · Differences highlighted in gold
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: "0.85rem 1.5rem", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ background: isDark ? "rgba(200,169,110,0.1)" : "rgba(176,136,64,0.12)", border: `1px solid ${isDark ? "rgba(200,169,110,0.2)" : "rgba(176,136,64,0.25)"}`, color: t.gold, padding: "0.35rem 1rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}
