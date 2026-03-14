"use client";
import Icon from "@/components/Icon";

import { useEffect } from "react";
import { darkTheme, lightTheme } from "@/lib/theme";

interface Props {
  open: boolean;
  onClose: () => void;
  isDark: boolean;
}

const AGENTS = [
  {
    icon: "agentFilm",
    name: "Film Recipe Agent",
    triggers: "film, recipe, simulation, velvia, grain, eterna, chrome, neg",
    description: "Searches specialist sources like Fuji X Weekly for exact film simulation recipes with all settings. Gives you ready-to-type configurations for your X-E5.",
    sources: ["fujixweekly.com", "fujilove.com"],
  },
  {
    icon: "agentSettings",
    name: "Settings Agent",
    triggers: "setting, config, menu, button, AF, ISO, shutter, autofocus",
    description: "Finds optimal camera configurations, custom menu setups, and button assignments. Covers everything from AF tracking to silent shutter to IBIS.",
    sources: ["fujixweekly.com", "dpreview.com"],
  },
  {
    icon: "agentLocation",
    name: "Locations Agent",
    triggers: "place, location, where, city, travel, tokyo, street",
    description: "Discovers iconic photography spots around the world — particularly suited to the X-E5's street and travel strengths.",
    sources: ["petapixel.com", "dpreview.com"],
  },
  {
    icon: "agentGear",
    name: "Gear Agent",
    triggers: "lens, accessory, bag, strap, grip, XF, filter, hood",
    description: "Recommends lenses, accessories and gear pairings. Covers the full XF lens lineup, third-party options, and what works best with the X-E5 form factor.",
    sources: ["bhphotovideo.com", "mirrorlessons.com"],
  },
  {
    icon: "agentCompare",
    name: "Comparison Agent",
    triggers: "vs, versus, compare, which is better, should I get, recommend me, worth it",
    description: "Runs in full agentic mode — decides its own research steps, searches for specs and prices separately, fetches full articles when needed, then synthesises a structured verdict. Unlike other agents, it loops until it has enough to answer properly.",
    agentic: true,
    sources: ["dpreview.com", "mirrorlessons.com", "kenrockwell.com"],
  },
  {
    icon: "agentCommunity",
    name: "Community Agent",
    triggers: "everything else — tips, comparisons, general questions",
    description: "The default fallback agent. Searches Reddit, forums and community blogs for real-world user experience, hidden tips, and honest opinions.",
    sources: ["reddit.com", "fujixweekly.com"],
  },
];

export default function AboutModal({ open, onClose, isDark }: Props) {
  const t = isDark ? darkTheme : lightTheme;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 40, backdropFilter: "blur(4px)" }} />

      {/* Modal */}
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(680px, 94vw)",
        maxHeight: "88vh",
        zIndex: 50,
        background: t.bgSidebar,
        border: `1px solid ${t.borderSidebar}`,
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "fadeIn 0.2s ease",
      }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", fontWeight: 900, color: t.text, marginBottom: "0.25rem" }}>
              Fujifilm X-E5 Research Agent
            </div>
            <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              How it works
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: "transparent", border: `1px solid ${t.borderSidebar}`, color: t.textFaint, width: "30px", height: "30px", borderRadius: "2px", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.borderSidebar; e.currentTarget.style.color = t.textFaint; }}>
            <Icon name="close" size={14} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", padding: "1.5rem" }}>

          {/* App summary */}
          <div style={{ marginBottom: "1.75rem", padding: "1rem 1.25rem", background: isDark ? "rgba(200,169,110,0.04)" : "rgba(176,136,64,0.06)", border: `1px solid ${isDark ? "rgba(200,169,110,0.12)" : "rgba(176,136,64,0.18)"}`, borderRadius: "4px", borderLeft: `3px solid ${t.gold}` }}>
            <p style={{ fontSize: "0.82rem", color: t.textMuted, lineHeight: 1.8 }}>
              This app is an AI-powered research tool built specifically for the <strong style={{ color: t.text }}>Fujifilm X-E5</strong>. Ask any question and it automatically routes your query to the most relevant specialist agent. Each agent searches trusted photography sources, reads full articles, and streams a detailed answer — all in real time.
            </p>
            <div style={{ marginTop: "0.85rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {["Groq (Llama 3.3 70B)", "Tavily Search", "Voyage RAG", "Supabase Memory", "6 Specialist Agents", "Agentic Loop", "Fuji Daily", "Search Credits"].map(tag => (
                <span key={tag} style={{ fontSize: "0.58rem", color: t.gold, border: `1px solid ${isDark ? "rgba(200,169,110,0.2)" : "rgba(176,136,64,0.3)"}`, borderRadius: "2px", padding: "0.15rem 0.5rem", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace" }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* How a query works */}
          <div style={{ marginBottom: "1.75rem" }}>
            <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
              What happens when you ask a question
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {[
                ["1", "Detect", "Keywords in your question determine which specialist agent handles it — or the Comparison Agent kicks in for vs/recommend queries"],
                ["2", "Knowledge Base", "Voyage AI embeds your question into a 512-dimension vector and searches ingested articles for semantically similar content — this is RAG"],
                ["3", "Search", "The agent runs targeted web searches via the active search provider (Tavily or None). The Comparison Agent decides its own search strategy in an agentic loop"],
                ["4", "Remember", "Past conversations are loaded from Supabase memory for context"],
                ["5", "Stream", "Groq (Llama 3.3 70B) synthesizes everything and streams the answer in real time, including a Sources section with verified links"],
              ].map(([num, title, desc]) => (
                <div key={num} style={{ display: "flex", gap: "1rem", padding: "0.65rem 0", borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: `1px solid ${isDark ? "rgba(200,169,110,0.3)" : "rgba(176,136,64,0.4)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", color: t.gold, flexShrink: 0, fontFamily: "'DM Mono', monospace", marginTop: "0.1rem" }}>{num}</div>
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: t.text, marginBottom: "0.15rem" }}>{title}</div>
                    <div style={{ fontSize: "0.7rem", color: t.textMuted, lineHeight: 1.6 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          <div style={{ marginBottom: "1.75rem" }}>
            <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
              Features
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                {
                  title: "Fuji Daily — News Digest",
                  body: "A daily newspaper-style digest of Fujifilm content pulled from RSS feeds including Fuji X Weekly, DPReview, PetaPixel, Mirrorlessons, Fujilove and Reddit. Press ♡ in the masthead to save an edition to your archive. Open past editions from the left drawer — pin it open to browse while reading. The digest refreshes every 6 hours.",
                },
                {
                  title: "Sources & Links",
                  body: "After every answer, a Sources section lists the articles the agent actually used — verified links only, no hallucinated URLs. Sources are ranked by trusted domain (Fuji X Weekly, DPReview, etc.) and capped at 3 per response.",
                },
                {
                  title: "Search Provider Control",
                  body: "In Settings (⚙), you can switch the live search provider between Tavily and None (KB only). Use None when your Tavily credits run low — answers still work from the knowledge base. The Dashboard Search tab shows your monthly credit usage, daily chart, and remaining credits.",
                },
                {
                  title: "RAG — Retrieval Augmented Generation",
                  body: "Before hitting the web, every query is converted into a 512-number vector by Voyage AI. That vector is compared against hundreds of pre-ingested photography articles stored in Supabase pgvector. The most semantically similar chunks are injected into the prompt as high-confidence reference material — even if they share no keywords with your question.",
                },
                {
                  title: "Agentic Loop (Comparison Agent)",
                  body: "Most agents follow a fixed pipeline: search → answer. The Comparison Agent is different — it uses tool calling to run its own research loop. It decides which searches to run, whether to fetch a full article, and when it has enough information to answer. It enforces a minimum research budget (2 KB searches, 2 web searches, 1 URL fetch) before answering.",
                },
                {
                  title: "Memory & Similar Questions",
                  body: "Past conversations are stored in Supabase and loaded as context on each query. Question embeddings are also stored — if you ask something semantically similar to a past question, the app surfaces that previous answer as a reference before generating a new one.",
                },
                {
                  title: "Custom Agent Sources",
                  body: "In Settings (⚙), you can add custom domains for any agent to prioritise when searching. Useful for adding niche Fujifilm blogs or your favourite review sites.",
                },
                {
                  title: "Dashboard Analytics",
                  body: "The Dashboard tracks token usage, cost, response quality (self-critique scores), prompt history, recipe analytics, and search credit usage. Tabs: Cost, Agents, Prompts, Recipes, Search.",
                },
              ].map(item => (
                <div key={item.title} style={{ padding: "0.85rem 1rem", background: t.bgCard, border: `1px solid ${t.borderCard}`, borderRadius: "4px" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: t.text, marginBottom: "0.35rem" }}>{item.title}</div>
                  <div style={{ fontSize: "0.7rem", color: t.textMuted, lineHeight: 1.7 }}>{item.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Agents */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
              The 6 specialist agents
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {AGENTS.map(agent => (
                <div key={agent.name} style={{ padding: "0.9rem 1rem", background: t.bgCard, border: `1px solid ${t.borderCard}`, borderRadius: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
                    <Icon name={agent.icon as Parameters<typeof Icon>[0]["name"]} size={18} style={{ color: t.gold }} />
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.9rem", fontWeight: 700, color: t.text }}>{agent.name}</span>
                    {(agent as {agentic?: boolean}).agentic && (
                      <span style={{ fontSize: "0.5rem", color: t.gold, border: `1px solid ${isDark ? "rgba(200,169,110,0.3)" : "rgba(176,136,64,0.4)"}`, borderRadius: "2px", padding: "0.1rem 0.35rem", letterSpacing: "0.1em", fontFamily: "DM Mono, monospace", textTransform: "uppercase" }}>
                        Agentic
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.72rem", color: t.textMuted, lineHeight: 1.7, marginBottom: "0.5rem" }}>{agent.description}</p>
                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "0.52rem", color: t.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.2rem" }}>Triggered by</div>
                      <div style={{ fontSize: "0.62rem", color: t.textVeryFaint, fontStyle: "italic" }}>{agent.triggers}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.52rem", color: t.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.2rem" }}>Priority sources</div>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        {agent.sources.map(s => (
                          <span key={s} style={{ fontSize: "0.58rem", color: t.gold, border: `1px solid ${isDark ? "rgba(200,169,110,0.15)" : "rgba(176,136,64,0.2)"}`, borderRadius: "2px", padding: "0.1rem 0.35rem", fontFamily: "'DM Mono', monospace" }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0.85rem 1.5rem", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: "0.58rem", color: t.textVeryFaint, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em" }}>
            XE5 Research Agent · v6.0
          </div>
          <button onClick={onClose}
            style={{ background: isDark ? "rgba(200,169,110,0.1)" : "rgba(176,136,64,0.12)", border: `1px solid ${isDark ? "rgba(200,169,110,0.2)" : "rgba(176,136,64,0.25)"}`, color: t.gold, padding: "0.35rem 1rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? "rgba(200,169,110,0.18)" : "rgba(176,136,64,0.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = isDark ? "rgba(200,169,110,0.1)" : "rgba(176,136,64,0.12)"; }}>
            Got it
          </button>
        </div>
      </div>
    </>
  );
}
