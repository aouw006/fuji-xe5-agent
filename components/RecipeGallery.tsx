"use client";
import React, { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import RecipeCard, { RecipeData } from "./RecipeCard";
import RecipeSimulator from "./RecipeSimulator";
import RecipeTweakModal from "./RecipeTweakModal";
import { RecipeValues, DEFAULT_VALUES, settingsToValues } from "./RecipeControls";
import { darkTheme, lightTheme } from "@/lib/theme";

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
  const [values, setValues] = useState<RecipeValues>(DEFAULT_VALUES);
  const [baseValues, setBaseValues] = useState<RecipeValues>(DEFAULT_VALUES); // for reset
  const [tweakOpen, setTweakOpen] = useState(false);

  const selectRecipe = (id: string, recipeList?: SavedRecipe[]) => {
    const list = recipeList || recipes;
    setSelected(id);
    const r = list.find(r => r.id === id);
    if (r) {
      const v = settingsToValues(r.settings || []);
      setValues(v);
      setBaseValues(v);
    }
  };

  useEffect(() => { if (open) fetchRecipes(); }, [open]);
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
      const list: SavedRecipe[] = data.recipes || [];
      setRecipes(list);
      if (list.length > 0) selectRecipe(list[0].id, list);
    } catch {}
    setLoading(false);
  };

  const handleDeleted = (id: string) => {
    const remaining = recipes.filter(r => r.id !== id);
    setRecipes(remaining);
    if (remaining.length > 0) selectRecipe(remaining[0].id, remaining);
    else { setSelected(null); setValues(DEFAULT_VALUES); setBaseValues(DEFAULT_VALUES); }
  };

  const selectedRecipe = recipes.find(r => r.id === selected);
  const selectedIdx = recipes.findIndex(r => r.id === selected);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 40, backdropFilter: "blur(4px)" }} />

      <div style={{ position: "fixed", inset: "2%", zIndex: 50, background: t.bgSidebar, border: `1px solid ${t.borderSidebar}`, borderRadius: "8px", display: "flex", flexDirection: "column", overflow: "hidden", animation: "fadeIn 0.2s ease", transition: "background 0.3s" }}>

        {/* Header */}
        <div style={{ padding: "1rem 1.5rem", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: t.text }}>Recipe Gallery</div>
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
                <div style={{ fontSize: "0.72rem", color: t.textVeryFaint, lineHeight: 1.7 }}>No saved recipes yet.<br />Star a recipe to save it here.</div>
              </div>
            )}
            {!loading && recipes.map((recipe, i) => {
              const isSelected = selected === recipe.id;
              const filmSim = recipe.settings?.find((s: { label: string }) => /film simulation/i.test(s.label));
              const recipeValues = settingsToValues(recipe.settings || []);
              return (
                <button key={recipe.id} onClick={() => selectRecipe(recipe.id)}
                  style={{ width: "100%", textAlign: "left", padding: "0", background: isSelected ? (isDark ? "rgba(200,169,110,0.1)" : "rgba(176,136,64,0.12)") : "transparent", border: "none", borderLeft: `3px solid ${isSelected ? t.gold : "transparent"}`, borderBottom: `1px solid ${t.border}`, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = isDark ? "rgba(200,169,110,0.04)" : "rgba(176,136,64,0.06)"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                  {previewImage && (
                    <RecipeSimulator values={isSelected ? values : recipeValues} recipeName={recipe.name} t={t} isDark={isDark} previewImage={previewImage} onImageUpload={setPreviewImage} compact />
                  )}
                  <div style={{ padding: "0.65rem 1.1rem" }}>
                    <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.08em", marginBottom: "0.2rem", textTransform: "uppercase" }}>{i + 1} of {recipes.length}</div>
                    <div style={{ fontSize: "0.82rem", fontFamily: "'Playfair Display', serif", color: isSelected ? t.text : t.textMuted, lineHeight: 1.3, marginBottom: "0.25rem" }}>{recipe.name}</div>
                    {filmSim && <div style={{ fontSize: "0.62rem", color: isSelected ? t.gold : t.textFaint, fontFamily: "'DM Mono', monospace" }}>{filmSim.value}</div>}
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
                <RecipeCard recipe={selectedRecipe} sessionId={sessionId} alreadySaved={true} savedId={selectedRecipe.id} onDeleted={() => handleDeleted(selectedRecipe.id)} />

                <RecipeSimulator values={values} recipeName={selectedRecipe.name} t={t} isDark={isDark} previewImage={previewImage} onImageUpload={setPreviewImage} />

                {previewImage && (
                  <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => setTweakOpen(true)}
                      style={{ background: "transparent", border: `1px solid ${isDark ? "rgba(200,169,110,0.3)" : "rgba(176,136,64,0.35)"}`, color: isDark ? "#c8a96e" : "#b08840", padding: "0.35rem 1rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.6rem", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = isDark ? "rgba(200,169,110,0.1)" : "rgba(176,136,64,0.12)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                      ✦ Tweak
                    </button>
                  </div>
                )}

                {recipes.length > 1 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.25rem" }}>
                    <button onClick={() => { if (selectedIdx > 0) selectRecipe(recipes[selectedIdx - 1].id); }} disabled={selectedIdx === 0}
                      style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint, padding: "0.4rem 1rem", borderRadius: "2px", cursor: selectedIdx === 0 ? "not-allowed" : "pointer", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s", opacity: selectedIdx === 0 ? 0.3 : 1 }}
                      onMouseEnter={e => { if (selectedIdx > 0) { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textFaint; }}>
                      ← Prev
                    </button>
                    <span style={{ fontSize: "0.6rem", color: t.textVeryFaint, alignSelf: "center" }}>{selectedIdx + 1} / {recipes.length}</span>
                    <button onClick={() => { if (selectedIdx < recipes.length - 1) selectRecipe(recipes[selectedIdx + 1].id); }} disabled={selectedIdx === recipes.length - 1}
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

      {tweakOpen && previewImage && selectedRecipe && (
        <RecipeTweakModal
          open={tweakOpen}
          onClose={() => setTweakOpen(false)}
          values={values}
          baseValues={baseValues}
          onChange={setValues}
          onReset={() => setValues(baseValues)}
          previewImage={previewImage}
          recipeName={selectedRecipe.name}
          t={t}
          isDark={isDark}
        />
      )}
    </>
  );
}
