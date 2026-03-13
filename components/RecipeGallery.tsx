"use client";
import React, { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import RecipeCard, { RecipeData } from "./RecipeCard";
import RecipeSimulator from "./RecipeSimulator";
import { darkTheme, lightTheme, Theme } from "@/lib/theme";

interface SavedRecipe extends RecipeData {
  id: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  isDark: boolean;
  onCompare: () => void;
}

export default function RecipeGallery({ open, onClose, sessionId, isDark, onCompare }: Props) {
  const t = isDark ? darkTheme : lightTheme;
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editedSettings, setEditedSettings] = useState<{ label: string; value: string }[]>([]);

  // Sync editedSettings when selected recipe changes
  const selectRecipe = (id: string) => {
    setSelected(id);
    const r = recipes.find((r: SavedRecipe) => r.id === id);
    if (r) setEditedSettings(r.settings ? [...r.settings] : []);
  };

  function updateSetting(label: string, value: string) {
    setEditedSettings(prev => prev.map((s: { label: string; value: string }) => s.label === label ? { ...s, value } : s));
  }

  useEffect(() => {
    if (open) fetchRecipes();
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recipes");
      const data = await res.json();
      setRecipes(data.recipes || []);
      if (data.recipes?.length > 0) {
        setSelected(data.recipes[0].id);
        setEditedSettings(data.recipes[0].settings ? [...data.recipes[0].settings] : []);
      }
    } catch {}
    setLoading(false);
  };

  const handleDeleted = (id: string) => {
    const remaining = recipes.filter(r => r.id !== id);
    setRecipes(remaining);
    const next = remaining[0]; setSelected(next?.id || null); if (next) setEditedSettings(next.settings ? [...next.settings] : []);;
  };

  const selectedRecipe = recipes.find(r => r.id === selected);
  const selectedIdx = recipes.findIndex(r => r.id === selected);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 40, backdropFilter: "blur(4px)" }} />

      <div style={{
        position: "fixed", inset: "2%", zIndex: 50,
        background: t.bgSidebar,
        border: `1px solid ${t.borderSidebar}`,
        borderRadius: "8px",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "fadeIn 0.2s ease",
        transition: "background 0.3s",
      }}>

        {/* Header */}
        <div style={{ padding: "1rem 1.5rem", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: t.text }}>
              Recipe Gallery
            </div>
            <div style={{ fontSize: "0.58rem", color: t.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "0.1rem" }}>
              {recipes.length} saved {recipes.length === 1 ? "recipe" : "recipes"}
            </div>
          </div>
<div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button onClick={onCompare}
              style={{ background: "transparent", border: `1px solid ${t.borderSidebar}`, color: t.textFaint, height: "32px", padding: "0 0.65rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.3rem", transition: "all 0.2s", whiteSpace: "nowrap" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.borderSidebar; e.currentTarget.style.color = t.textFaint; }}>
              ⇄ Compare
            </button>
            <button onClick={onClose}
              style={{ background: "transparent", border: `1px solid ${t.borderSidebar}`, color: t.textFaint, width: "32px", height: "32px", borderRadius: "2px", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.borderSidebar; e.currentTarget.style.color = t.textFaint; }}>
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Left: recipe list */}
          <div style={{ width: "240px", borderRight: `1px solid ${t.border}`, overflowY: "auto", flexShrink: 0 }}>
            {loading && (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                  {[0,1,2].map(n => <div key={n} style={{ width: "4px", height: "4px", borderRadius: "50%", background: t.gold, animation: `pulse 1.2s ease-in-out ${n*0.2}s infinite` }} />)}
                </div>
              </div>
            )}

            {!loading && recipes.length === 0 && (
              <div style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem", color: "#c8a96e" }}><Icon name="film" size={32} /></div>
                <div style={{ fontSize: "0.72rem", color: t.textVeryFaint, lineHeight: 1.7 }}>
                  No saved recipes yet.<br />Star a recipe to save it here.
                </div>
              </div>
            )}

            {!loading && recipes.map((recipe, i) => {
              const isSelected = selected === recipe.id;
              const filmSim = recipe.settings?.find((s: { label: string }) => /film simulation/i.test(s.label));
              return (
                <button key={recipe.id} onClick={() => selectRecipe(recipe.id)}
                  style={{
                    width: "100%", textAlign: "left", padding: "0",
                    background: isSelected ? (isDark ? "rgba(200,169,110,0.1)" : "rgba(176,136,64,0.12)") : "transparent",
                    border: "none",
                    borderLeft: `3px solid ${isSelected ? t.gold : "transparent"}`,
                    borderBottom: `1px solid ${t.border}`,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = isDark ? "rgba(200,169,110,0.04)" : "rgba(176,136,64,0.06)"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                  {/* Thumbnail */}
                  {previewImage && (
                    <RecipeSimulator
                      settings={recipe.settings || []}
                      recipeName={recipe.name}
                      t={t}
                      isDark={isDark}
                      previewImage={previewImage}
                      onImageUpload={setPreviewImage}
                      compact
                    />
                  )}
                  <div style={{ padding: "0.65rem 1.1rem" }}>
                    <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.08em", marginBottom: "0.2rem", textTransform: "uppercase" }}>
                      {i + 1} of {recipes.length}
                    </div>
                    <div style={{ fontSize: "0.82rem", fontFamily: "'Playfair Display', serif", color: isSelected ? t.text : t.textMuted, lineHeight: 1.3, marginBottom: "0.25rem" }}>
                      {recipe.name}
                    </div>
                    {filmSim && (
                      <div style={{ fontSize: "0.62rem", color: isSelected ? t.gold : t.textFaint, fontFamily: "'DM Mono', monospace" }}>
                        {filmSim.value}
                      </div>
                    )}
                    <div style={{ fontSize: "0.55rem", color: t.textVeryFaint, marginTop: "0.3rem" }}>
                      {new Date(recipe.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: recipe detail */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", background: t.bg, transition: "background 0.3s" }}>
            {selectedRecipe ? (
              <div style={{ maxWidth: "560px", margin: "0 auto" }}>
                <RecipeCard
                  recipe={selectedRecipe}
                  sessionId={sessionId}
                  alreadySaved={true}
                  savedId={selectedRecipe.id}
                  onDeleted={() => handleDeleted(selectedRecipe.id)}
                />

                <RecipeSimulator
                  settings={editedSettings}
                  recipeName={selectedRecipe.name}
                  t={t}
                  isDark={isDark}
                  previewImage={previewImage}
                  onImageUpload={setPreviewImage}
                />

                {/* Editable settings — only shown when preview image is loaded */}
                {previewImage && editedSettings.length > 0 && (
                  <div style={{ marginTop: "1.25rem" }}>
                    <div style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.6rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>Tweak settings — filter updates live</span>
                      <button
                        onClick={() => setEditedSettings(selectedRecipe.settings ? [...selectedRecipe.settings] : [])}
                        style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint, padding: "0.15rem 0.5rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.52rem", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textFaint; }}>
                        Reset
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
                      {editedSettings.map((s: { label: string; value: string }, i: number) => (
                        <EditableSetting key={i} label={s.label} value={s.value} onChange={v => updateSetting(s.label, v)} t={t} isDark={isDark} />
                      ))}
                    </div>
                  </div>
                )}

                {recipes.length > 1 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.25rem" }}>
                    <button
                      onClick={() => { if (selectedIdx > 0) selectRecipe(recipes[selectedIdx - 1].id); }}
                      disabled={selectedIdx === 0}
                      style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint, padding: "0.4rem 1rem", borderRadius: "2px", cursor: selectedIdx === 0 ? "not-allowed" : "pointer", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s", opacity: selectedIdx === 0 ? 0.3 : 1 }}
                      onMouseEnter={e => { if (selectedIdx > 0) { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textFaint; }}>
                      ← Prev
                    </button>
                    <span style={{ fontSize: "0.6rem", color: t.textVeryFaint, alignSelf: "center" }}>
                      {selectedIdx + 1} / {recipes.length}
                    </span>
                    <button
                      onClick={() => { if (selectedIdx < recipes.length - 1) selectRecipe(recipes[selectedIdx + 1].id); }}
                      disabled={selectedIdx === recipes.length - 1}
                      style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint, padding: "0.4rem 1rem", borderRadius: "2px", cursor: selectedIdx === recipes.length - 1 ? "not-allowed" : "pointer", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s", opacity: selectedIdx === recipes.length - 1 ? 0.3 : 1 }}
                      onMouseEnter={e => { if (selectedIdx < recipes.length - 1) { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textFaint; }}>
                      Next →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              !loading && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ color: "#c8a96e" }}><Icon name="film" size={40} /></div>
                  <div style={{ fontSize: "0.8rem", color: t.textVeryFaint }}>Select a recipe from the list</div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Editable Setting Cell ────────────────────────────────────────────────────

function EditableSetting({ label, value, onChange, t, isDark }: {
  label: string; value: string; onChange: (v: string) => void; t: Theme; isDark: boolean; key?: React.Key;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const isFilmSim = /film simulation/i.test(label);

  const commit = () => { setEditing(false); onChange(draft); };

  return (
    <div
      style={{ padding: "0.4rem 0.6rem", background: editing ? (isDark ? "rgba(200,169,110,0.06)" : "rgba(176,136,64,0.08)") : t.bgInput, border: `1px solid ${editing ? (isDark ? "rgba(200,169,110,0.3)" : "rgba(176,136,64,0.35)") : t.borderCard}`, borderRadius: "3px", cursor: editing ? "default" : "pointer", transition: "all 0.15s" }}
      onClick={() => { if (!editing) { setDraft(value); setEditing(true); } }}>
      <div style={{ fontSize: "0.5rem", color: t.textVeryFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.12rem" }}>{label}</div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={e => { setDraft(e.target.value); onChange(e.target.value); }}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: isFilmSim ? "0.85rem" : "0.75rem", color: isFilmSim ? t.gold : t.text, fontFamily: "'DM Mono', monospace", padding: 0 }}
        />
      ) : (
        <div style={{ fontSize: isFilmSim ? "0.85rem" : "0.75rem", color: isFilmSim ? t.gold : t.text, fontFamily: "'DM Mono', monospace" }}>{value}</div>
      )}
    </div>
  );
}
