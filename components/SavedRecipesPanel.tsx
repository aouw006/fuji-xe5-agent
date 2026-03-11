"use client";

import { useState, useEffect } from "react";
import RecipeCard, { RecipeData } from "./RecipeCard";

interface SavedRecipe extends RecipeData {
  id: string;
  created_at: string;
}

interface Props {
  open: boolean;
  sessionId: string;
}

export default function SavedRecipesPanel({ open, sessionId }: Props) {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (open) fetchRecipes();
  }, [open]);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recipes");
      const data = await res.json();
      setRecipes(data.recipes || []);
    } catch {}
    setLoading(false);
  };

  const handleDeleted = (id: string) => {
    setRecipes(prev => prev.filter(r => r.id !== id));
  };

  if (!open) return null;

  return (
    <div style={{ padding: "0.75rem 0" }}>
      {loading && (
        <div style={{ padding: "1.5rem 1.25rem", textAlign: "center" }}>
          <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
            {[0,1,2].map(n => <div key={n} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#c8a96e", animation: `pulse 1.2s ease-in-out ${n*0.2}s infinite` }} />)}
          </div>
        </div>
      )}

      {!loading && recipes.length === 0 && (
        <div style={{ padding: "1.5rem 1.25rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🎞️</div>
          <div style={{ fontSize: "0.72rem", color: "#3a3020", lineHeight: 1.6 }}>No saved recipes yet.<br />Star a recipe to save it here.</div>
        </div>
      )}

      {!loading && recipes.map(recipe => (
        <div key={recipe.id} style={{ borderBottom: "1px solid #1a1610" }}>
          {/* Collapsed row */}
          <button
            onClick={() => setExpanded(expanded === recipe.id ? null : recipe.id)}
            style={{ width: "100%", textAlign: "left", padding: "0.7rem 1.25rem", background: "transparent", border: "none", cursor: "pointer", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(200,169,110,0.04)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: "0.72rem", color: "#c8b89a", fontFamily: "'Playfair Display', serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ⭐ {recipe.name}
              </div>
              <div style={{ fontSize: "0.58rem", color: "#3a3020", marginTop: "0.1rem" }}>
                {new Date(recipe.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
            <span style={{ color: "#3a3020", fontSize: "0.6rem", flexShrink: 0 }}>
              {expanded === recipe.id ? "▲" : "▼"}
            </span>
          </button>

          {/* Expanded card */}
          {expanded === recipe.id && (
            <div style={{ padding: "0 1rem 1rem" }}>
              <RecipeCard
                recipe={recipe}
                sessionId={sessionId}
                alreadySaved={true}
                savedId={recipe.id}
                onDeleted={() => handleDeleted(recipe.id)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
