"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { darkTheme, lightTheme } from "@/lib/theme";

const AGENT_COLORS: Record<string, string> = {
  film_recipes:    "#c8a96e",
  camera_settings: "#7eb8d4",
  locations:       "#7ed4a0",
  gear:            "#d4a07e",
  comparison:      "#b07ed4",
  community:       "#d4d07e",
  unknown:         "#666",
};

const AGENT_LABELS: Record<string, string> = {
  film_recipes:    "Film Recipes",
  camera_settings: "Camera Settings",
  locations:       "Locations",
  gear:            "Gear",
  comparison:      "Comparison",
  community:       "Community",
  unknown:         "Unknown",
};

interface DbStats {
  chunks: {
    total: number;
    byAgent: { agent_id: string; chunks: number }[];
    topDomains: { domain: string; chunks: number }[];
    recent: { url: string; title: string; agent_id: string }[];
  };
  conversations: {
    total: number;
    uniqueSessions: number;
    totalTokens: number;
  };
  recipes: { total: number };
  agentPrompts: { agent_id: string; updated_at: string }[];
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
    </div>
  );
}

export default function DbPage() {
  const [dark, setDark] = useState(true);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = dark ? darkTheme : lightTheme;

  useEffect(() => {
    fetch("/api/db-stats")
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  const cell = {
    background: t.bgCard,
    border: `1px solid ${t.border}`,
    borderRadius: 4,
    padding: "1.25rem",
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "monospace", fontSize: 13 }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${t.border}`, padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <Link href="/" style={{ color: t.gold, textDecoration: "none", fontSize: 12 }}>← Chat</Link>
          <Link href="/dashboard" style={{ color: t.textMuted, textDecoration: "none", fontSize: 12 }}>Dashboard</Link>
          <span style={{ color: t.gold, fontSize: 12 }}>Knowledge Base</span>
        </div>
        <button
          onClick={() => setDark(d => !d)}
          style={{ background: "none", border: `1px solid ${t.border}`, color: t.textMuted, padding: "2px 10px", borderRadius: 3, cursor: "pointer", fontSize: 11 }}
        >
          {dark ? "☀ light" : "◐ dark"}
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem" }}>
        <h1 style={{ color: t.gold, fontSize: 16, fontWeight: 600, marginBottom: "1.5rem", letterSpacing: "0.05em" }}>
          SUPABASE · KNOWLEDGE BASE
        </h1>

        {loading && <div style={{ color: t.textMuted }}>Loading stats…</div>}
        {error && <div style={{ color: "#e88" }}>Error: {error}</div>}

        {stats && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Top stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
              {[
                { label: "Document Chunks", value: stats.chunks.total.toLocaleString() },
                { label: "Conversations", value: stats.conversations.total.toLocaleString() },
                { label: "Unique Sessions", value: stats.conversations.uniqueSessions.toLocaleString() },
                { label: "Saved Recipes", value: stats.recipes.total.toLocaleString() },
              ].map(s => (
                <div key={s.label} style={{ ...cell, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: t.gold }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tokens */}
            <div style={{ ...cell, display: "flex", alignItems: "center", gap: "1rem" }}>
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 2 }}>TOTAL TOKENS USED (all time)</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: t.gold }}>
                  {stats.conversations.totalTokens.toLocaleString()}
                </div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 11, color: t.textMuted }}>
                ≈ ${((stats.conversations.totalTokens / 1_000_000) * 0.10).toFixed(4)} estimated cost
              </div>
            </div>

            {/* Chunks by agent + top domains side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>

              {/* By agent */}
              <div style={cell}>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: "0.75rem", letterSpacing: "0.05em" }}>
                  CHUNKS BY AGENT
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {stats.chunks.byAgent.map(r => {
                    const max = stats.chunks.byAgent[0]?.chunks ?? 1;
                    const color = AGENT_COLORS[r.agent_id] || "#888";
                    return (
                      <div key={r.agent_id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ width: 110, color: color, fontSize: 11, flexShrink: 0 }}>
                          {AGENT_LABELS[r.agent_id] || r.agent_id}
                        </div>
                        <Bar value={r.chunks} max={max} color={color} />
                        <div style={{ width: 50, textAlign: "right", color: t.textMuted, fontSize: 11, flexShrink: 0 }}>
                          {r.chunks.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top domains */}
              <div style={cell}>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: "0.75rem", letterSpacing: "0.05em" }}>
                  TOP DOMAINS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {stats.chunks.topDomains.map(r => {
                    const max = stats.chunks.topDomains[0]?.chunks ?? 1;
                    return (
                      <div key={r.domain} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ width: 160, color: t.text, fontSize: 11, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.domain}
                        </div>
                        <Bar value={r.chunks} max={max} color={t.gold} />
                        <div style={{ width: 50, textAlign: "right", color: t.textMuted, fontSize: 11, flexShrink: 0 }}>
                          {r.chunks.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Agent prompts status */}
            <div style={cell}>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: "0.75rem", letterSpacing: "0.05em" }}>
                CUSTOM AGENT PROMPTS
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {["film_recipes","camera_settings","locations","gear","comparison","community"].map(id => {
                  const prompt = stats.agentPrompts.find(p => p.agent_id === id);
                  return (
                    <div key={id} style={{
                      padding: "3px 10px",
                      borderRadius: 3,
                      fontSize: 11,
                      border: `1px solid ${prompt ? AGENT_COLORS[id] || t.border : t.border}`,
                      color: prompt ? AGENT_COLORS[id] || t.text : t.textMuted,
                      background: prompt ? `${AGENT_COLORS[id]}12` : "transparent",
                    }}>
                      {AGENT_LABELS[id]}
                      {prompt ? " ✓" : " —"}
                    </div>
                  );
                })}
              </div>
              {stats.agentPrompts.length === 0 && (
                <div style={{ color: t.textMuted, fontSize: 11 }}>No custom prompts saved yet (self-improvement hasn&apos;t triggered)</div>
              )}
            </div>

            {/* Recent ingests */}
            <div style={cell}>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: "0.75rem", letterSpacing: "0.05em" }}>
                RECENTLY INGESTED PAGES (last 20)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: 320, overflowY: "auto" }}>
                {stats.chunks.recent.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", borderBottom: `1px solid ${t.border}`, paddingBottom: "0.35rem" }}>
                    <span style={{ fontSize: 10, color: AGENT_COLORS[r.agent_id] || "#888", width: 90, flexShrink: 0 }}>
                      {AGENT_LABELS[r.agent_id] || r.agent_id}
                    </span>
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: t.text, textDecoration: "none", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
                      title={r.url}
                    >
                      {r.title || r.url}
                    </a>
                  </div>
                ))}
                {stats.chunks.recent.length === 0 && (
                  <div style={{ color: t.textMuted, fontSize: 11 }}>No chunks found. Run the ingester to populate the knowledge base.</div>
                )}
              </div>
            </div>

            {/* Link to ingest */}
            <div style={{ textAlign: "center", paddingTop: "0.5rem" }}>
              <Link href="/ingest" style={{ color: t.gold, fontSize: 12, textDecoration: "none" }}>
                → Go to Ingester
              </Link>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
