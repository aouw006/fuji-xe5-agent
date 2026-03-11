"use client";

import { useState, useEffect } from "react";
import { darkTheme, lightTheme } from "@/lib/theme";

interface AgentSource {
  id: string;
  agent_id: string;
  domain: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  isDark: boolean;
}

const AGENTS = [
  { id: "film_recipes", icon: "🎞️", name: "Film Recipe Agent", defaultSources: ["fujixweekly.com", "fujilove.com"] },
  { id: "camera_settings", icon: "⚙️", name: "Settings Agent", defaultSources: ["fujixweekly.com", "dpreview.com", "fujifilm.com"] },
  { id: "locations", icon: "📍", name: "Locations Agent", defaultSources: ["petapixel.com", "dpreview.com", "fujilove.com"] },
  { id: "gear", icon: "🎒", name: "Gear Agent", defaultSources: ["bhphotovideo.com", "dpreview.com", "mirrorlessons.com"] },
  { id: "community", icon: "🌐", name: "Community Agent", defaultSources: ["reddit.com", "fujixweekly.com", "youtube.com"] },
];

export default function SettingsModal({ open, onClose, isDark }: Props) {
  const t = isDark ? darkTheme : lightTheme;
  const [sources, setSources] = useState<AgentSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState(AGENTS[0].id);
  const [inputValue, setInputValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (open) fetchSources();
  }, [open]);

  const fetchSources = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      setSources(data.sources || []);
    } catch {}
    setLoading(false);
  };

  const handleAdd = async () => {
    const domain = inputValue.trim().toLowerCase()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/.*$/, "");

    if (!domain) { setError("Enter a domain"); return; }
    if (!/\.[a-z]{2,}$/.test(domain)) { setError("Enter a valid domain e.g. example.com"); return; }

    const alreadyExists = sources.some(s => s.agent_id === activeAgent && s.domain === domain);
    if (alreadyExists) { setError("Already added"); return; }

    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: activeAgent, domain }),
      });
      const data = await res.json();
      if (data.source) {
        setSources(prev => [...prev, data.source]);
        setInputValue("");
      }
    } catch { setError("Failed to add source"); }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
    try {
      await fetch(`/api/sources?id=${id}`, { method: "DELETE" });
    } catch {}
  };

  const activeAgentData = AGENTS.find(a => a.id === activeAgent)!;
  const customForActive = sources.filter(s => s.agent_id === activeAgent);

  if (!open) return null;

  const inputStyle = {
    flex: 1,
    background: t.bgInput,
    border: `1px solid ${error ? "#e05555" : t.borderMid}`,
    borderRadius: "3px",
    color: t.text,
    padding: "0.5rem 0.75rem",
    fontSize: "0.78rem",
    outline: "none",
    fontFamily: "'DM Mono', monospace",
    transition: "border-color 0.2s",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 40, backdropFilter: "blur(4px)" }} />

      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(640px, 94vw)",
        maxHeight: "88vh",
        zIndex: 50,
        background: t.bgSidebar,
        border: `1px solid ${t.borderSidebar}`,
        borderRadius: "8px",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "fadeIn 0.2s ease",
      }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: t.text }}>Settings</div>
            <div style={{ fontSize: "0.58rem", color: t.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "0.1rem" }}>Customize agent sources</div>
          </div>
          <button onClick={onClose}
            style={{ background: "transparent", border: `1px solid ${t.borderSidebar}`, color: t.textFaint, width: "30px", height: "30px", borderRadius: "2px", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.borderSidebar; e.currentTarget.style.color = t.textFaint; }}>
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Agent selector */}
          <div style={{ width: "180px", borderRight: `1px solid ${t.border}`, flexShrink: 0, padding: "0.75rem 0" }}>
            {AGENTS.map(agent => {
              const isActive = agent.id === activeAgent;
              const customCount = sources.filter(s => s.agent_id === agent.id).length;
              return (
                <button key={agent.id} onClick={() => { setActiveAgent(agent.id); setInputValue(""); setError(""); }}
                  style={{ width: "100%", textAlign: "left", padding: "0.65rem 1rem", background: isActive ? (isDark ? "rgba(200,169,110,0.08)" : "rgba(176,136,64,0.1)") : "transparent", border: "none", borderLeft: `2px solid ${isActive ? t.gold : "transparent"}`, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = isDark ? "rgba(200,169,110,0.04)" : "rgba(176,136,64,0.06)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ fontSize: "0.85rem", marginBottom: "0.15rem" }}>{agent.icon}</div>
                  <div style={{ fontSize: "0.68rem", color: isActive ? t.text : t.textMuted, lineHeight: 1.3 }}>{agent.name}</div>
                  {customCount > 0 && (
                    <div style={{ fontSize: "0.55rem", color: t.gold, marginTop: "0.2rem" }}>+{customCount} custom</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sources panel */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: t.text, marginBottom: "0.2rem" }}>
                {activeAgentData.icon} {activeAgentData.name}
              </div>
              <div style={{ fontSize: "0.68rem", color: t.textMuted, lineHeight: 1.6 }}>
                Add websites this agent should prioritise when searching. Custom sources are checked first before the defaults.
              </div>
            </div>

            {/* Default sources */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Default sources</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {activeAgentData.defaultSources.map(domain => (
                  <span key={domain} style={{ fontSize: "0.65rem", color: t.textVeryFaint, border: `1px solid ${t.borderCard}`, borderRadius: "2px", padding: "0.2rem 0.5rem", fontFamily: "'DM Mono', monospace" }}>
                    {domain}
                  </span>
                ))}
              </div>
            </div>

            {/* Custom sources */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                Custom sources {customForActive.length > 0 && `(${customForActive.length})`}
              </div>

              {loading && (
                <div style={{ fontSize: "0.7rem", color: t.textVeryFaint, padding: "0.5rem 0" }}>Loading…</div>
              )}

              {!loading && customForActive.length === 0 && (
                <div style={{ fontSize: "0.7rem", color: t.textVeryFaint, padding: "0.5rem 0", fontStyle: "italic" }}>
                  No custom sources yet. Add one below.
                </div>
              )}

              {!loading && customForActive.map(source => (
                <div key={source.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.75rem", background: t.bgCard, border: `1px solid ${t.borderCard}`, borderRadius: "3px", marginBottom: "0.35rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.6rem", color: t.gold }}>★</span>
                    <span style={{ fontSize: "0.72rem", color: t.text, fontFamily: "'DM Mono', monospace" }}>{source.domain}</span>
                  </div>
                  <button onClick={() => handleDelete(source.id)}
                    style={{ background: "transparent", border: "none", color: t.textVeryFaint, cursor: "pointer", fontSize: "0.8rem", padding: "0.1rem 0.3rem", borderRadius: "2px", transition: "color 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#e05555"}
                    onMouseLeave={e => e.currentTarget.style.color = t.textVeryFaint}>
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Add source input */}
            <div>
              <div style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Add a source</div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => { setInputValue(e.target.value); setError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                  placeholder="e.g. photographylife.com"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = t.gold}
                  onBlur={e => e.target.style.borderColor = error ? "#e05555" : t.borderMid}
                />
                <button onClick={handleAdd} disabled={adding || !inputValue.trim()}
                  style={{ background: adding || !inputValue.trim() ? t.bgButton : (isDark ? "rgba(200,169,110,0.15)" : "rgba(176,136,64,0.18)"), border: `1px solid ${isDark ? "rgba(200,169,110,0.2)" : "rgba(176,136,64,0.25)"}`, color: adding || !inputValue.trim() ? t.textVeryFaint : t.gold, padding: "0.5rem 1rem", borderRadius: "3px", cursor: adding || !inputValue.trim() ? "not-allowed" : "pointer", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s", whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif" }}>
                  {adding ? "Adding…" : "+ Add"}
                </button>
              </div>
              {error && <div style={{ fontSize: "0.65rem", color: "#e05555", marginTop: "0.4rem" }}>{error}</div>}
              <div style={{ fontSize: "0.62rem", color: t.textVeryFaint, marginTop: "0.5rem", lineHeight: 1.6 }}>
                Paste a full URL or just the domain. Custom sources are prioritised above defaults for this agent.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0.85rem 1.5rem", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: "0.6rem", color: t.textVeryFaint, lineHeight: 1.6 }}>
            Changes take effect on the next query.
          </div>
          <button onClick={onClose}
            style={{ background: isDark ? "rgba(200,169,110,0.1)" : "rgba(176,136,64,0.12)", border: `1px solid ${isDark ? "rgba(200,169,110,0.2)" : "rgba(176,136,64,0.25)"}`, color: t.gold, padding: "0.35rem 1rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(200,169,110,0.18)" : "rgba(176,136,64,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = isDark ? "rgba(200,169,110,0.1)" : "rgba(176,136,64,0.12)"}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}
