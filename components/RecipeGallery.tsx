"use client";

import { useState, useEffect } from "react";
import RecipeCard, { RecipeData } from "./RecipeCard";

interface SavedRecipe extends RecipeData {
  id: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
}

export default function RecipeGallery({ open, onClose, sessionId }: Props) {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) fetchRecipes();
  }, [open]);

  // Close on escape key
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
      if (data.recipes?.length > 0) setSelected(data.recipes[0].id);
    } catch {}
    setLoading(false);
  };

  const handleDeleted = (id: string) => {
    const remaining = recipes.filter(r => r.id !== id);
    setRecipes(remaining);
    setSelected(remaining.length > 0 ? remaining[0].id : null);
  };

  const selectedRecipe = recipes.find(r => r.id === selected);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 40, backdropFilter: "blur(4px)" }} />

      {/* Gallery panel */}
      <div style={{
        position: "fixed", inset: "2%", zIndex: 50,
        background: "#0f0d09",
        border: "1px solid #1e1a12",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "fadeIn 0.2s ease",
      }}>

        {/* Header */}
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #1a1610", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: "#e8d5b0" }}>
              Recipe Gallery
            </div>
            <div style={{ fontSize: "0.58rem", color: "#4a3e2a", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "0.1rem" }}>
              {recipes.length} saved {recipes.length === 1 ? "recipe" : "recipes"}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: "transparent", border: "1px solid #1e1a12", color: "#4a3e2a", width: "32px", height: "32px", borderRadius: "2px", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.color = "#c8a96e"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1a12"; e.currentTarget.style.color = "#4a3e2a"; }}>
            ✕
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Left: recipe list */}
          <div style={{ width: "240px", borderRight: "1px solid #1a1610", overflowY: "auto", flexShrink: 0 }}>
            {loading && (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                  {[0,1,2].map(n => <div key={n} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#c8a96e", animation: `pulse 1.2s ease-in-out ${n*0.2}s infinite` }} />)}
                </div>
              </div>
            )}

            {!loading && recipes.length === 0 && (
              <div style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🎞️</div>
                <div style={{ fontSize: "0.72rem", color: "#3a3020", lineHeight: 1.7 }}>
                  No saved recipes yet.<br />Star a recipe to save it here.
                </div>
              </div>
            )}

            {!loading && recipes.map((recipe, i) => {
              const isSelected = selected === recipe.id;
              const filmSim = recipe.settings?.find((s: { label: string }) => /film simulation/i.test(s.label));
              return (
                <button key={recipe.id} onClick={() => setSelected(recipe.id)}
                  style={{
                    width: "100%", textAlign: "left", padding: "0.85rem 1.1rem",
                    background: isSelected ? "rgba(200,169,110,0.1)" : "transparent",
                    border: "none",
                    borderLeft: `3px solid ${isSelected ? "#c8a96e" : "transparent"}`,
                    borderBottom: "1px solid #1a1610",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(200,169,110,0.04)"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ fontSize: "0.6rem", color: "#4a3e2a", letterSpacing: "0.08em", marginBottom: "0.2rem", textTransform: "uppercase" }}>
                    🎞️ {i + 1} of {recipes.length}
                  </div>
                  <div style={{ fontSize: "0.82rem", fontFamily: "'Playfair Display', serif", color: isSelected ? "#e8d5b0" : "#c8b89a", lineHeight: 1.3, marginBottom: "0.25rem" }}>
                    {recipe.name}
                  </div>
                  {filmSim && (
                    <div style={{ fontSize: "0.62rem", color: isSelected ? "#c8a96e" : "#4a3e2a", fontFamily: "'DM Mono', monospace" }}>
                      {filmSim.value}
                    </div>
                  )}
                  <div style={{ fontSize: "0.55rem", color: "#2e2818", marginTop: "0.3rem" }}>
                    {new Date(recipe.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: recipe detail */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
            {selectedRecipe ? (
              <div style={{ maxWidth: "560px", margin: "0 auto" }}>
                <RecipeCard
                  recipe={selectedRecipe}
                  sessionId={sessionId}
                  alreadySaved={true}
                  savedId={selectedRecipe.id}
                  onDeleted={() => handleDeleted(selectedRecipe.id)}
                />

                {/* Nav arrows */}
                {recipes.length > 1 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.25rem" }}>
                    <button
                      onClick={() => {
                        const idx = recipes.findIndex(r => r.id === selected);
                        if (idx > 0) setSelected(recipes[idx - 1].id);
                      }}
                      disabled={recipes.findIndex(r => r.id === selected) === 0}
                      style={{ background: "transparent", border: "1px solid #1a1610", color: "#4a3e2a", padding: "0.4rem 1rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s", opacity: recipes.findIndex(r => r.id === selected) === 0 ? 0.3 : 1 }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.color = "#c8a96e"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a1610"; e.currentTarget.style.color = "#4a3e2a"; }}>
                      ← Prev
                    </button>
                    <span style={{ fontSize: "0.6rem", color: "#3a3020", alignSelf: "center" }}>
                      {recipes.findIndex(r => r.id === selected) + 1} / {recipes.length}
                    </span>
                    <button
                      onClick={() => {
                        const idx = recipes.findIndex(r => r.id === selected);
                        if (idx < recipes.length - 1) setSelected(recipes[idx + 1].id);
                      }}
                      disabled={recipes.findIndex(r => r.id === selected) === recipes.length - 1}
                      style={{ background: "transparent", border: "1px solid #1a1610", color: "#4a3e2a", padding: "0.4rem 1rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s", opacity: recipes.findIndex(r => r.id === selected) === recipes.length - 1 ? 0.3 : 1 }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.color = "#c8a96e"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a1610"; e.currentTarget.style.color = "#4a3e2a"; }}>
                      Next →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              !loading && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ fontSize: "3rem" }}>🎞️</div>
                  <div style={{ fontSize: "0.8rem", color: "#3a3020" }}>Select a recipe from the list</div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}
