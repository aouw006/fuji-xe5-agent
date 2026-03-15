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
};

const AGENT_LABELS: Record<string, string> = {
  film_recipes:    "Film Recipes",
  camera_settings: "Camera Settings",
  locations:       "Locations",
  gear:            "Gear",
  comparison:      "Comparison",
  community:       "Community",
};

interface HistoryEntry {
  id: number;
  agent_id: string;
  trigger_score: number;
  avg_score: number;
  critique_summary: string;
  created_at: string;
}

export default function AgentsPage() {
  const [dark, setDark] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const t = dark ? darkTheme : lightTheme;

  useEffect(() => {
    const saved = localStorage.getItem("xe5_theme");
    if (saved) setDark(saved === "dark");
  }, []);

  useEffect(() => {
    fetch("/api/prompt-history")
      .then(r => r.json())
      .then(d => setHistory(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("xe5_theme", next ? "dark" : "light");
  }

  const section = (label: string) => (
    <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.75rem", marginTop: "2rem", paddingBottom: "0.4rem", borderBottom: `1px solid ${t.border}` }}>
      {label}
    </div>
  );

  const block = (children: React.ReactNode) => (
    <div style={{ padding: "1rem 1.1rem", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4, marginBottom: "0.75rem" }}>
      {children}
    </div>
  );

  const mono = (text: string, color?: string) => (
    <code style={{ fontFamily: "DM Mono, monospace", fontSize: "0.72rem", color: color || t.gold, background: dark ? "rgba(200,169,110,0.07)" : "rgba(176,136,64,0.08)", padding: "1px 5px", borderRadius: 3 }}>
      {text}
    </code>
  );

  const label = (text: string) => (
    <div style={{ fontSize: "0.58rem", color: t.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.3rem" }}>{text}</div>
  );

  const p = (text: string) => (
    <p style={{ fontSize: "0.78rem", color: t.textMuted, lineHeight: 1.8, margin: "0 0 0.75rem 0" }}>{text}</p>
  );

  const stepNum = (n: string | number) => (
    <div style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${dark ? "rgba(200,169,110,0.35)" : "rgba(176,136,64,0.45)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", color: t.gold, flexShrink: 0, fontFamily: "DM Mono, monospace" }}>
      {n}
    </div>
  );

  const TOOLS = [
    { name: "search_knowledge_base", desc: "Semantic vector search across ingested Fujifilm articles stored in Supabase pgvector. Converts the query to a 512-dim Voyage AI embedding and returns the top 5 most similar chunks. Min 2 calls required per research session.", min: 2 },
    { name: "search_web", desc: "Live web search via Tavily. Automatically prepends \"Fujifilm X-E5\" to queries that don't already mention Fuji, preventing off-topic results. Returns 5 results with title, URL, and content snippet. Min 2 calls required.", min: 2 },
    { name: "fetch_url", desc: "Fetches a full article from a URL found in search results. Strips navigation, scripts, and boilerplate — returns the clean article body. Used when a snippet is promising but shallow. Min 1 call required.", min: 1 },
    { name: "answer", desc: "Signals the agent is ready to synthesise. Blocked by the minimum research budget enforcer — if KB searches < 2, web searches < 2, or URL fetches < 1, the model is told what's missing and forced to continue.", min: null },
  ];

  const PIPELINE = [
    {
      step: 1,
      name: "Query Expansion",
      where: "app/api/agent/route.ts",
      detail: "If the last 6 messages contain context and the new question starts with a reference pronoun (\"is it...\", \"tell me more\", \"what about the...\"), a lightweight Groq call rewrites it into a fully self-contained question before any routing happens. This prevents the agent from losing track of the subject across turns.",
      example: '"is it weather sealed?" → "Is the Fujifilm X-E5 weather sealed?"',
    },
    {
      step: 2,
      name: "Agent Routing + Stickiness",
      where: "lib/agents.ts → detectSubAgent()",
      detail: "Keywords in the expanded question are matched against each agent's trigger set. If the matched agent is only \"community\" (the weak fallback) and there's already an active agent from this conversation, the active agent is kept — preventing the agent from unnecessarily resetting mid-conversation.",
      example: "\"how about the ISO?\" during a Settings conversation stays with the Settings Agent",
    },
    {
      step: 3,
      name: "Prompt Override Check",
      where: "lib/memory.ts → loadAgentPrompts()",
      detail: "Before the research loop starts, the agent's system prompt is checked against the agent_prompts table in Supabase. If a self-improved prompt exists (written by the reflection system), it replaces the hardcoded default. This is how agents get better over time.",
      example: "film_recipes agent uses rewritten prompt if its rolling reflection score has been < 7",
    },
    {
      step: 4,
      name: "Similar Question Detection",
      where: "lib/rag.ts → findSimilarQuestion()",
      detail: "The question is vectorised and compared against stored question embeddings. If a past question in the same session has cosine similarity > 0.92, the previous answer is surfaced to the user as a reference card before the new answer is generated. Non-blocking — runs concurrently with the rest of setup.",
      example: "Asking \"best recipe for portraits?\" after previously asking \"portrait film simulation?\"",
    },
    {
      step: 5,
      name: "Custom Sources Merge",
      where: "lib/analytics.ts → getAgentSources()",
      detail: "Any custom domains the user has added in Settings (⚙) for this agent are prepended to the agent's priority domain list. These domains get preferential ranking in web search results.",
      example: "User adds \"thomas-schwab.com\" to the Film Recipes agent priority sources",
    },
    {
      step: 6,
      name: "Memory Load",
      where: "lib/memory.ts → getSession()",
      detail: "The last 12 messages from this session are loaded from Supabase conversations table and formatted as a memory block injected into the prompt. Memory-only questions (\"what did we discuss?\", \"previous recipe\") bypass the research loop entirely and go straight to synthesis.",
      example: "User asks \"what was the first recipe you gave me?\" — no search, answers from memory",
    },
    {
      step: 7,
      name: "RAG Pre-fetch",
      where: "lib/rag.ts → retrieveChunks()",
      detail: "Before the agentic loop, the top 5 semantically-similar chunks from the knowledge base are fetched for the agent's domain and injected into the system prompt. This gives the model grounding material before it even begins its research steps.",
      example: "\"Eterna Cinema recipe\" → retrieves 5 chunks from ingested Fuji X Weekly articles",
    },
    {
      step: 8,
      name: "Agentic Research Loop",
      where: "lib/agentLoop.ts → runComparisonAgent()",
      detail: "The main loop. The planner model outputs a JSON decision each step. The decision is parsed, the tool is executed, and the result is added to a running knowledge ledger. The ledger is distilled into key findings by a second Groq call after each step, so the growing context stays focused. The loop runs up to 10 steps.",
      example: "Step 1: search_knowledge_base → Step 2: search_knowledge_base (different angle) → Step 3: search_web → Step 4: search_web (price) → Step 5: fetch_url → Step 6: answer",
    },
    {
      step: 9,
      name: "Minimum Budget Enforcement",
      where: "lib/agentLoop.ts → getMissingTools()",
      detail: "When the model outputs \"answer\", a budget check fires before allowing it. If any tool hasn't met its minimum call count, the model is told exactly what's missing and forced to continue. This prevents shallow 1-step answers.",
      example: '"You tried to answer but still need: 1 more search_knowledge_base, 1 fetch_url"',
    },
    {
      step: 10,
      name: "Synthesis",
      where: "lib/agentLoop.ts (fallback synthesiser)",
      detail: "If the model included its answer inline in the final JSON, that text is used directly (after stripping any leaked JSON). If not, a separate synthesis call is made with the full research context and the agent's system prompt, outputting clean markdown.",
      example: "Final answer is streamed word-by-word with 8ms delay for a natural feel",
    },
    {
      step: 11,
      name: "Follow-up Suggestions",
      where: "app/api/agent/route.ts",
      detail: "After the answer is complete, a lightweight Groq call generates 3 natural follow-up questions in the same domain, returned as a JSON array. These appear as clickable chips below the answer.",
      example: '["What grain setting works best?", "Can this recipe work indoors?", "How does it compare to Classic Chrome?"]',
    },
    {
      step: 12,
      name: "Reflection Scoring",
      where: "app/api/agent/route.ts (reflection block)",
      detail: "A second model call scores the answer 1–10 across four criteria: answered directly, specific & actionable, prices/availability if relevant, photography expertise. The score and a one-sentence critique are sent to the UI and saved to Supabase alongside the message.",
      example: "Score 6/10 · \"Good recipe detail but no mention of sensor ISO behaviour at ISO 1600+\"",
    },
    {
      step: 13,
      name: "Self-Improvement",
      where: "app/api/agent/route.ts → maybeImprovePrompt()",
      detail: "Fire-and-forget after reflection. If the current score is < 7 AND the last 5 scores average < 7 (min 3 samples), Groq is asked to rewrite the agent's system prompt by analysing the recurring critique themes. The new prompt is saved to agent_prompts in Supabase and immediately used on the next query.",
      example: "Film Recipes agent critiques mention \"no WB shift values\" → prompt updated to require WB settings in every recipe",
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "monospace", fontSize: 13 }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${t.border}`, padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: t.bg, zIndex: 10 }}>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <Link href="/" style={{ color: t.gold, textDecoration: "none", fontSize: 12 }}>← Chat</Link>
          <Link href="/dashboard" style={{ color: t.textMuted, textDecoration: "none", fontSize: 12 }}>Dashboard</Link>
          <Link href="/db" style={{ color: t.textMuted, textDecoration: "none", fontSize: 12 }}>Knowledge Base</Link>
          <Link href="/ingest" style={{ color: t.textMuted, textDecoration: "none", fontSize: 12 }}>Ingester</Link>
          <span style={{ color: t.gold, fontSize: 12 }}>How Agents Work</span>
        </div>
        <button onClick={toggleDark} style={{ background: "none", border: `1px solid ${t.border}`, color: t.textMuted, padding: "2px 10px", borderRadius: 3, cursor: "pointer", fontSize: 11 }}>
          {dark ? "☀ light" : "◐ dark"}
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.25rem 4rem" }}>

        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ color: t.gold, fontSize: 20, fontWeight: 700, marginBottom: "0.4rem", letterSpacing: "0.04em" }}>How Agents Work</h1>
          <p style={{ fontSize: "0.8rem", color: t.textMuted, lineHeight: 1.7, maxWidth: 640 }}>
            Every query runs through a 13-step pipeline. All 6 agents share the same agentic research loop — the difference is their system prompt, priority domains, and trigger keywords. This page covers the full technical flow.
          </p>
        </div>

        {/* Architecture overview */}
        {section("Architecture Overview")}
        {block(
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {[
              { label: "LLM", value: "Groq · Llama 3.3 70B Versatile" },
              { label: "Embeddings", value: "Voyage AI · voyage-3-lite (512 dim)" },
              { label: "Vector Store", value: "Supabase pgvector" },
              { label: "Live Search", value: "Tavily Search API" },
              { label: "Memory", value: "Supabase · conversations table" },
              { label: "Streaming", value: "SSE (Server-Sent Events)" },
              { label: "Max Loop Steps", value: "10 per query" },
              { label: "Min Research Budget", value: "2 KB + 2 web + 1 fetch" },
            ].map(item => (
              <div key={item.label}>
                {label(item.label)}
                <div style={{ fontSize: "0.78rem", color: t.text }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tool dispatch */}
        {section("Manual JSON Tool Dispatch")}
        {p("Groq's native function calling with Llama 3.3 is unreliable — it frequently mis-formats tool calls. Instead, the planner is asked to output a single JSON object, which is parsed manually. If parsing fails, the loop breaks and falls back to a direct synthesis call.")}
        <div style={{ padding: "0.75rem 1rem", background: dark ? "rgba(200,169,110,0.04)" : "rgba(176,136,64,0.05)", border: `1px solid ${dark ? "rgba(200,169,110,0.1)" : "rgba(176,136,64,0.15)"}`, borderRadius: 4, marginBottom: "1rem", fontFamily: "DM Mono, monospace", fontSize: "0.72rem", color: t.textMuted, lineHeight: 1.8 }}>
          <div style={{ color: t.textFaint, marginBottom: "0.4rem" }}>// Valid planner outputs:</div>
          <div>{`{"action": "search_knowledge_base", "query": "...", "reasoning": "..."}`}</div>
          <div>{`{"action": "search_web", "query": "...", "reasoning": "..."}`}</div>
          <div>{`{"action": "fetch_url", "url": "https://...", "reasoning": "..."}`}</div>
          <div>{`{"action": "answer", "text": "full markdown answer", "reasoning": "..."}`}</div>
        </div>

        {/* Tools */}
        {section("Available Tools")}
        {TOOLS.map(tool => (
          <div key={tool.name} style={{ ...{ padding: "0.9rem 1rem", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4, marginBottom: "0.6rem" } }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
              {mono(tool.name)}
              {tool.min !== null && (
                <span style={{ fontSize: "0.58rem", color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 3, padding: "1px 6px" }}>
                  min {tool.min}×
                </span>
              )}
              {tool.min === null && (
                <span style={{ fontSize: "0.58rem", color: "#e88", border: `1px solid rgba(200,80,80,0.25)`, borderRadius: 3, padding: "1px 6px" }}>
                  budget-gated
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.74rem", color: t.textMuted, lineHeight: 1.7 }}>{tool.desc}</div>
          </div>
        ))}

        {/* Knowledge ledger */}
        {section("Knowledge Ledger")}
        {block(<>
          <div style={{ fontSize: "0.78rem", color: t.text, fontWeight: 600, marginBottom: "0.5rem" }}>Why it exists</div>
          {p("After each tool call, the raw result (up to 2000 chars) is injected into the conversation. By step 4–5 the context window fills fast. The knowledge ledger solves this: after every tool result, a second lightweight Groq call extracts only the key findings as 2–3 sentences of specific facts.")}
          {p("The ledger is then rebuilt each step as a compact summary block at the top of the research context, replacing the growing raw transcript. This keeps the planner's context window clean and focused on gaps rather than raw text.")}
          <div style={{ padding: "0.65rem 0.85rem", background: dark ? "rgba(200,169,110,0.04)" : "rgba(176,136,64,0.05)", border: `1px solid ${dark ? "rgba(200,169,110,0.1)" : "rgba(176,136,64,0.15)"}`, borderRadius: 3, fontFamily: "DM Mono, monospace", fontSize: "0.7rem", color: t.textMuted, lineHeight: 1.8 }}>
            <div style={{ color: t.textFaint, marginBottom: "0.3rem" }}>// Injected at top of each planner call:</div>
            <div>[RESEARCH SO FAR]</div>
            <div>Step 1 — search_knowledge_base (&quot;Eterna Cinema X-E5 recipe&quot;):</div>
            <div style={{ paddingLeft: "1rem", color: t.textVeryFaint }}>Fuji X Weekly recommends DR400, ISO 1600 base, Shadow +2 for Eterna Cinema...</div>
            <div>Step 2 — search_web (&quot;Eterna Cinema film simulation price AUD&quot;):</div>
            <div style={{ paddingLeft: "1rem", color: t.textVeryFaint }}>No specific AUD pricing found; feature included in all X-E5 firmware versions...</div>
            <div style={{ marginTop: "0.4rem" }}>[GAPS] What is still missing to fully answer the question?</div>
          </div>
        </>)}

        {/* Full pipeline */}
        {section("Full Pipeline · Step by Step")}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {PIPELINE.map(item => (
            <div key={item.step} style={{ display: "flex", gap: "1rem", padding: "0.9rem 1rem", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4 }}>
              {stepNum(item.step)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.35rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: t.text }}>{item.name}</span>
                  {mono(item.where, t.textMuted)}
                </div>
                <p style={{ fontSize: "0.72rem", color: t.textMuted, lineHeight: 1.7, margin: "0 0 0.5rem 0" }}>{item.detail}</p>
                <div style={{ fontSize: "0.68rem", color: t.textVeryFaint, fontStyle: "italic", borderLeft: `2px solid ${t.border}`, paddingLeft: "0.5rem" }}>
                  {item.example}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reflection criteria */}
        {section("Reflection Scoring Criteria")}
        {block(<>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {[
              { name: "answered", desc: "Did it actually address what was asked? Scores vague or off-topic answers low." },
              { name: "specific", desc: "Gave concrete settings, values, names — not generic advice." },
              { name: "prices", desc: "Included prices or availability where relevant to the question." },
              { name: "expertise", desc: "Used Fujifilm-specific knowledge, not advice that could apply to any camera." },
            ].map(c => (
              <div key={c.name}>
                {mono(c.name)}
                <div style={{ fontSize: "0.7rem", color: t.textMuted, lineHeight: 1.6, marginTop: "0.3rem" }}>{c.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "0.85rem", fontSize: "0.72rem", color: t.textMuted, lineHeight: 1.7 }}>
            Each criterion scores 1–3. Total = sum / 1.2 (mapped to 1–10). Stored in {mono("conversations.reflection_score")} and displayed in the Dashboard Prompts tab.
          </div>
        </>)}

        {/* Self-improvement */}
        {section("Self-Improvement Flow")}
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {[
            ["Check", `After reflection, if score < 7 AND rolling average of last 5 scores < 7 (min 3 samples), self-improvement triggers`],
            ["Analyse", "The agent's current system prompt and the recent critiques are sent to Groq with a prompt-rewriting instruction"],
            ["Rewrite", "Groq produces an improved system prompt that addresses the recurring weaknesses identified in the critiques"],
            ["Save", `New prompt saved to Supabase ${"`"}agent_prompts${"`"} table via upsert. Fires fire-and-forget — doesn't block the response`],
            ["Apply", "Next query: loadAgentPrompts() fetches the improved prompt and it replaces the hardcoded default for this agent"],
          ].map(([title, desc], i) => (
            <div key={i} style={{ display: "flex", gap: "1rem", padding: "0.6rem 0", borderBottom: `1px solid ${t.border}` }}>
              {stepNum(["①","②","③","④","⑤"][i])}
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: t.text, marginRight: "0.5rem" }}>{title}</span>
                <span style={{ fontSize: "0.72rem", color: t.textMuted, lineHeight: 1.7 }}>{desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Retraining log */}
        {section("Retraining Log")}
        {history.length === 0 ? (
          <div style={{ padding: "1rem", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4, fontSize: "0.74rem", color: t.textMuted }}>
            No retraining events yet. Self-improvement triggers when an agent&apos;s rolling average reflection score drops below 7 (min 3 samples).
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {history.map(entry => (
              <div key={entry.id} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4, overflow: "hidden" }}>
                <div
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", cursor: "pointer" }}
                >
                  <span style={{ fontSize: "0.68rem", color: AGENT_COLORS[entry.agent_id] || t.gold, border: `1px solid ${AGENT_COLORS[entry.agent_id] || t.border}`, borderRadius: 3, padding: "1px 7px", flexShrink: 0 }}>
                    {AGENT_LABELS[entry.agent_id] || entry.agent_id}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: t.textMuted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.critique_summary || "No critique summary"}
                  </span>
                  <span style={{ fontSize: "0.65rem", color: "#e88", flexShrink: 0 }}>
                    score {entry.trigger_score} · avg {Number(entry.avg_score).toFixed(1)}
                  </span>
                  <span style={{ fontSize: "0.62rem", color: t.textFaint, flexShrink: 0 }}>
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                  <span style={{ fontSize: "0.65rem", color: t.textFaint }}>{expanded === entry.id ? "▲" : "▼"}</span>
                </div>
                {expanded === entry.id && (
                  <div style={{ borderTop: `1px solid ${t.border}`, padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div>
                      <div style={{ fontSize: "0.58rem", color: t.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.3rem" }}>Critiques that triggered retraining</div>
                      <div style={{ fontSize: "0.72rem", color: t.textMuted, lineHeight: 1.7 }}>{entry.critique_summary}</div>
                    </div>
                    <div style={{ fontSize: "0.65rem", color: t.textVeryFaint }}>
                      Triggered at {new Date(entry.created_at).toLocaleString()} · Score {entry.trigger_score}/10 · Rolling avg {Number(entry.avg_score).toFixed(1)}/10
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
