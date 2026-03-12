"use client";
import Icon from "@/components/Icon";
import { useState, useEffect, useCallback } from "react";
import { darkTheme, lightTheme } from "@/lib/theme";
import { useLongPress } from "@/lib/useLongPress";

interface Setting {
  label: string;
  value: string;
}

interface Recipe {
  id: string;
  name: string;
  author?: string;
  mood?: string;
  best_for?: string;
  settings: Setting[];
  created_at: string;
}

interface Props {
  open: boolean;
  sessionId: string;
  isDark: boolean;
}

function RecipeRow({ recipe, isDark, onDelete }: { recipe: Recipe; isDark: boolean; onDelete: () => void }) {
  const t = isDark ? darkTheme : lightTheme;
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lp = useLongPress(useCallback(() => setConfirmDelete(true), []));

  if (confirmDelete) {
    return (
      <div style={{ borderBottom: `1px solid ${t.border}`, padding: "0.65rem 1.25rem", background: isDark ? "rgba(224,85,85,0.07)" : "rgba(200,60,60,0.05)", borderLeft: "2px solid #e05555", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.65rem", color: "#e05555" }}>Delete recipe?</span>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button onClick={onDelete}
            style={{ background: "#e05555", border: "none", color: "#fff", padding: "0.25rem 0.6rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.6rem", fontWeight: 600 }}>
            Delete
          </button>
          <button onClick={() => setConfirmDelete(false)}
            style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint, padding: "0.25rem 0.5rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.6rem" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderBottom: `1px solid ${t.border}` }}>
      {/* Row header — long-press to delete, tap to expand */}
      <button
        onClick={() => setExpanded(e => !e)}
        {...lp}
        style={{
          width: "100%", textAlign: "left", padding: "0.65rem 1.25rem",
          background: "transparent", border: "none",
          cursor: "pointer", transition: "background 0.15s",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem",
          userSelect: "none", WebkitUserSelect: "none",
        } as React.CSSProperties}
        onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(200,169,110,0.04)" : "rgba(176,136,64,0.06)"}
        onMouseLeave={e => { lp.onMouseLeave(); e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.7rem", color: t.text, fontFamily: "Playfair Display, serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {recipe.name}
          </div>
          <div style={{ fontSize: "0.55rem", color: t.textFaint, marginTop: "0.1rem", display: "flex", gap: "0.5rem" }}>
            {recipe.mood && <span>{recipe.mood}</span>}
            <span>{new Date(recipe.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
          </div>
        </div>
        <span style={{ color: t.textVeryFaint, fontSize: "0.55rem", flexShrink: 0 }}>
          <Icon name={expanded ? "arrowUp" : "arrowRight"} size={10} />
        </span>
      </button>

      {/* Expanded settings grid */}
      {expanded && (
        <div style={{ padding: "0 1.25rem 0.75rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem" }}>
            {recipe.settings.map((s, i) => (
              <div key={i} style={{ background: isDark ? "rgba(200,169,110,0.04)" : "rgba(176,136,64,0.06)", border: `1px solid ${t.border}`, borderRadius: "2px", padding: "0.3rem 0.5rem" }}>
                <div style={{ fontSize: "0.5rem", color: t.textFaint, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.1rem" }}>{s.label}</div>
                <div style={{ fontSize: "0.65rem", color: t.gold, fontFamily: "DM Mono, monospace" }}>{s.value}</div>
              </div>
            ))}
          </div>
          {recipe.best_for && (
            <div style={{ fontSize: "0.62rem", color: t.textMuted, marginTop: "0.5rem", lineHeight: 1.5, fontStyle: "italic" }}>
              Best for: {recipe.best_for}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SavedRecipesPanel({ open, sessionId, isDark }: Props) {
  const t = isDark ? darkTheme : lightTheme;
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);

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

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/recipes?id=${id}`, { method: "DELETE" });
      setRecipes(prev => prev.filter(r => r.id !== id));
    } catch {}
  };

  if (!open) return null;

  return (
    <div style={{ padding: "0.5rem 0" }}>
      {loading && (
        <div style={{ padding: "1.5rem 1.25rem", textAlign: "center", display: "flex", gap: "4px", justifyContent: "center" }}>
          {[0, 1, 2].map(n => <div key={n} style={{ width: "4px", height: "4px", borderRadius: "50%", background: t.gold, animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />)}
        </div>
      )}

      {!loading && recipes.length === 0 && (
        <div style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
          <div style={{ marginBottom: "0.5rem", color: t.gold }}><Icon name="film" size={22} /></div>
          <div style={{ fontSize: "0.7rem", color: t.textVeryFaint, lineHeight: 1.6 }}>No saved recipes yet.<br />Star a recipe to save it here.</div>
        </div>
      )}

      {!loading && recipes.map(recipe => (
        <RecipeRow
          key={recipe.id}
          recipe={recipe}
          isDark={isDark}
          onDelete={() => handleDelete(recipe.id)}
        />
      ))}
    </div>
  );
}
