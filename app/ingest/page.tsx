"use client";
import { useState, useRef, useEffect } from "react";
import { darkTheme, lightTheme } from "@/lib/theme";

type AgentId = "film_recipes" | "camera_settings" | "gear" | "comparison" | "community" | "locations";

const AGENTS: { id: AgentId; label: string; color: string }[] = [
  { id: "film_recipes", label: "Film Recipes", color: "#c8a96e" },
  { id: "camera_settings", label: "Camera Settings", color: "#7eb8c8" },
  { id: "gear", label: "Gear & Lenses", color: "#a8c87e" },
  { id: "community", label: "Community", color: "#c87ea8" },
  { id: "locations", label: "Locations", color: "#c8987e" },
  { id: "comparison", label: "Comparison", color: "#7e9ec8" },
];

interface UrlEntry {
  id: string;
  url: string;
  agent_id: AgentId;
  status: "pending" | "processing" | "done" | "error" | "skipped";
  chunks?: number;
  error?: string;
  title?: string;
}

export default function IngestPage() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("xe5_theme");
    setIsDark(saved !== "light");
    const handler = (e: StorageEvent) => { if (e.key === "xe5_theme") setIsDark(e.newValue !== "light"); };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  const t = isDark ? darkTheme : lightTheme;
  const goldBorder = isDark ? "rgba(200,169,110,0.25)" : "rgba(176,136,64,0.3)";

  const [input, setInput] = useState("");
  const [defaultAgent, setDefaultAgent] = useState<AgentId>("gear");
  const [deepCrawl, setDeepCrawl] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [entries, setEntries] = useState<UrlEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const abortRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  function addLog(msg: string) {
    setLog(prev => [...prev.slice(-200), msg]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function parseInput() {
    const lines = input.split("\n").map(l => l.trim()).filter(l => l.startsWith("http"));
    if (lines.length === 0) return;

    if (!deepCrawl) {
      const newEntries: UrlEntry[] = lines
        .filter(url => !entries.find(e => e.url === url))
        .map(url => ({ id: Math.random().toString(36).slice(2), url, agent_id: defaultAgent, status: "pending" }));
      setEntries(prev => [...prev, ...newEntries]);
      setInput("");
      addLog(`✚ Added ${newEntries.length} URL${newEntries.length !== 1 ? "s" : ""}`);
      return;
    }

    // Deep crawl: discover all internal links from each seed URL
    setCrawling(true);
    const allUrls = new Set<string>();
    for (const seedUrl of lines) {
      addLog(`🕷 Crawling: ${seedUrl}`);
      try {
        const res = await fetch("/api/ingest/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: seedUrl }),
        });
        const data = await res.json();
        if (data.error) {
          addLog(`  ✗ Crawl failed: ${data.error}`);
        } else {
          addLog(`  ↳ Found ${data.count} links`);
          for (const link of data.links) allUrls.add(link);
        }
      } catch (e) {
        addLog(`  ✗ ${e}`);
      }
    }
    const newEntries: UrlEntry[] = [...allUrls]
      .filter(url => !entries.find(e => e.url === url))
      .map(url => ({ id: Math.random().toString(36).slice(2), url, agent_id: defaultAgent, status: "pending" }));
    setEntries(prev => [...prev, ...newEntries]);
    setInput("");
    setCrawling(false);
    addLog(`✚ Queued ${newEntries.length} discovered URL${newEntries.length !== 1 ? "s" : ""}`);
  }

  function updateEntry(id: string, patch: Partial<UrlEntry>) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  function removeEntry(id: string) { setEntries(prev => prev.filter(e => e.id !== id)); }
  function clearDone() { setEntries(prev => prev.filter(e => e.status === "pending" || e.status === "error")); }

  async function runIngest() {
    const pending = entries.filter(e => e.status === "pending");
    if (pending.length === 0) return;
    setRunning(true);
    abortRef.current = false;
    addLog(`▶ Starting ingest of ${pending.length} URL${pending.length !== 1 ? "s" : ""}...`);

    for (const entry of pending) {
      if (abortRef.current) { addLog("⏹ Stopped by user"); break; }
      updateEntry(entry.id, { status: "processing" });
      addLog(`⟳ ${entry.url}`);
      try {
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: entry.url, agent_id: entry.agent_id }),
        });
        const data = await res.json();
        if (data.skipped) {
          updateEntry(entry.id, { status: "skipped", title: data.title });
          addLog(`  ↷ Skipped (already ingested): ${data.title || entry.url}`);
        } else if (data.error) {
          updateEntry(entry.id, { status: "error", error: data.error });
          addLog(`  ✗ Error: ${data.error}`);
        } else {
          updateEntry(entry.id, { status: "done", chunks: data.chunks, title: data.title });
          addLog(`  ✓ ${data.chunks} chunks — ${data.title || entry.url}`);
        }
      } catch (e) {
        updateEntry(entry.id, { status: "error", error: String(e) });
        addLog(`  ✗ ${e}`);
      }
      await new Promise(r => setTimeout(r, 600));
    }
    setRunning(false);
    addLog("✓ Done");
  }

  const counts = {
    pending: entries.filter(e => e.status === "pending").length,
    done: entries.filter(e => e.status === "done").length,
    error: entries.filter(e => e.status === "error").length,
    skipped: entries.filter(e => e.status === "skipped").length,
  };
  const totalChunks = entries.reduce((s, e) => s + (e.chunks || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'DM Mono', monospace", padding: "2rem", transition: "background 0.3s, color 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 2px; }
        textarea:focus, input:focus, select:focus { outline: none; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ maxWidth: "900px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem", borderBottom: `1px solid ${t.border}`, paddingBottom: "1.5rem", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <a href="/" style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", textDecoration: "none", display: "block", marginBottom: "0.5rem" }}>← Agent</a>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.01em" }}>Knowledge Base</div>
            <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.2em", textTransform: "uppercase", marginTop: "0.25rem" }}>RAG Ingestion Tool · Fujifilm X-E5 Agent</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {totalChunks > 0 && <div style={{ fontSize: "0.65rem", color: t.gold }}>{totalChunks} chunks ingested</div>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

          {/* Left — input */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            <div>
              <div style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Paste URLs (one per line)</div>
              <textarea value={input} onChange={e => setInput(e.target.value)}
                placeholder={"https://fujixweekly.com/...\nhttps://..."} rows={6}
                style={{ width: "100%", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "4px", color: t.text, padding: "0.75rem", fontSize: "0.65rem", lineHeight: 1.7, resize: "vertical", fontFamily: "'DM Mono', monospace", transition: "background 0.3s, border-color 0.3s" }}
                onFocus={e => e.target.style.borderColor = t.gold}
                onBlur={e => e.target.style.borderColor = t.border}
                onKeyDown={e => { if (e.key === "Enter" && e.metaKey) parseInput(); }} />
            </div>

            {/* Deep Crawl toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.75rem", background: deepCrawl ? (isDark ? "rgba(200,169,110,0.06)" : "rgba(176,136,64,0.06)") : t.bgCard, border: `1px solid ${deepCrawl ? goldBorder : t.border}`, borderRadius: "3px", transition: "all 0.2s", cursor: "pointer" }} onClick={() => setDeepCrawl(v => !v)}>
              <div>
                <div style={{ fontSize: "0.6rem", color: deepCrawl ? t.gold : t.textMuted, letterSpacing: "0.05em" }}>Deep Crawl</div>
                <div style={{ fontSize: "0.52rem", color: t.textVeryFaint, marginTop: "0.15rem" }}>Follow all internal links from the given URL</div>
              </div>
              <div style={{ width: "28px", height: "16px", borderRadius: "8px", background: deepCrawl ? t.gold : t.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: "2px", left: deepCrawl ? "14px" : "2px", width: "12px", height: "12px", borderRadius: "50%", background: deepCrawl ? (isDark ? "#1a1a1a" : "#fff") : (isDark ? "#444" : "#ccc"), transition: "left 0.2s" }} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Assign to agent</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {AGENTS.map(a => (
                  <button key={a.id} onClick={() => setDefaultAgent(a.id)}
                    style={{ fontSize: "0.6rem", padding: "0.25rem 0.65rem", borderRadius: "2px", cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em", transition: "all 0.15s",
                      background: defaultAgent === a.id ? `${a.color}22` : "transparent",
                      border: `1px solid ${defaultAgent === a.id ? a.color : t.border}`,
                      color: defaultAgent === a.id ? a.color : t.textMuted }}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={parseInput} disabled={!input.trim() || crawling}
              style={{ background: t.goldDim, border: `1px solid ${goldBorder}`, color: t.gold, padding: "0.6rem 1rem", borderRadius: "3px", cursor: (input.trim() && !crawling) ? "pointer" : "not-allowed", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", opacity: (input.trim() && !crawling) ? 1 : 0.4, transition: "all 0.15s" }}>
              {crawling
                ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: t.gold, animation: "pulse 1s infinite" }} />Crawling...</span>
                : deepCrawl ? "Crawl & Queue" : "Add to Queue"}
            </button>

            {entries.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {([["Pending", counts.pending, t.textMuted], ["Done", counts.done, "#a8c87e"], ["Skipped", counts.skipped, t.textFaint], ["Errors", counts.error, "#c87e7e"]] as [string, number, string][]).map(([label, count, color]) => (
                  <div key={label} style={{ padding: "0.6rem 0.75rem", background: t.bgCard, border: `1px solid ${t.borderCard}`, borderRadius: "3px", transition: "background 0.3s" }}>
                    <div style={{ fontSize: "0.95rem", fontWeight: 500, color }}>{count}</div>
                    <div style={{ fontSize: "0.52rem", color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "0.1rem" }}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={running ? () => { abortRef.current = true; } : runIngest}
                disabled={!running && counts.pending === 0}
                style={{ flex: 1, padding: "0.65rem", borderRadius: "3px", cursor: "pointer", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", transition: "all 0.2s",
                  background: running ? "rgba(200,100,100,0.12)" : t.goldDim,
                  border: `1px solid ${running ? "rgba(200,100,100,0.3)" : goldBorder}`,
                  color: running ? "#c87e7e" : t.gold,
                  opacity: !running && counts.pending === 0 ? 0.4 : 1 }}>
                {running
                  ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#c87e7e", animation: "pulse 1s infinite" }} />Stop</span>
                  : `Run Ingest (${counts.pending})`}
              </button>
              {counts.done + counts.skipped > 0 && !running && (
                <button onClick={clearDone}
                  style={{ padding: "0.65rem 0.85rem", borderRadius: "3px", cursor: "pointer", fontSize: "0.6rem", background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", transition: "all 0.2s" }}>
                  Clear done
                </button>
              )}
            </div>
          </div>

          {/* Right — queue + log */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            <div>
              <div style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Queue — {entries.length} URL{entries.length !== 1 ? "s" : ""}</div>
              <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {entries.length === 0 && (
                  <div style={{ color: t.textVeryFaint, fontSize: "0.65rem", padding: "1.5rem", textAlign: "center", border: `1px dashed ${t.border}`, borderRadius: "4px" }}>No URLs queued yet</div>
                )}
                {entries.map(entry => {
                  const agentColor = AGENTS.find(a => a.id === entry.agent_id)?.color || t.gold;
                  const statusColor = { pending: t.textFaint, processing: t.gold, done: "#a8c87e", error: "#c87e7e", skipped: t.textFaint }[entry.status];
                  return (
                    <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.45rem 0.6rem", background: t.bgCard, border: `1px solid ${entry.status === "processing" ? goldBorder : t.borderCard}`, borderRadius: "3px", animation: "fadeIn 0.2s ease", transition: "background 0.3s" }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: statusColor, flexShrink: 0, animation: entry.status === "processing" ? "pulse 1s infinite" : "none" }} />
                      <select value={entry.agent_id} onChange={e => updateEntry(entry.id, { agent_id: e.target.value as AgentId })} disabled={entry.status !== "pending"}
                        style={{ fontSize: "0.5rem", background: "transparent", border: "none", color: agentColor, cursor: "pointer", fontFamily: "'DM Mono', monospace", padding: 0, flexShrink: 0 }}>
                        {AGENTS.map(a => <option key={a.id} value={a.id} style={{ background: t.bgCard, color: t.text }}>{a.label}</option>)}
                      </select>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.58rem", color: entry.status === "done" ? t.textMuted : t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {entry.title || entry.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </div>
                        {entry.chunks && <div style={{ fontSize: "0.5rem", color: "#a8c87e" }}>{entry.chunks} chunks</div>}
                        {entry.error && <div style={{ fontSize: "0.5rem", color: "#c87e7e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.error}</div>}
                      </div>
                      {entry.status === "pending" && (
                        <button onClick={() => removeEntry(entry.id)}
                          style={{ background: "none", border: "none", color: t.textVeryFaint, cursor: "pointer", fontSize: "0.7rem", padding: "0 0.2rem", flexShrink: 0, lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#c87e7e")}
                          onMouseLeave={e => (e.currentTarget.style.color = t.textVeryFaint)}>×</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Log</div>
              <div style={{ height: "180px", overflowY: "auto", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "4px", padding: "0.6rem 0.75rem", transition: "background 0.3s" }}>
                {log.length === 0 && <div style={{ color: t.textVeryFaint, fontSize: "0.6rem" }}>Waiting...</div>}
                {log.map((line, i) => (
                  <div key={i} style={{ fontSize: "0.6rem", color: line.startsWith("  ✓") ? "#a8c87e" : line.startsWith("  ✗") ? "#c87e7e" : line.startsWith("  ↷") ? t.textFaint : t.textMuted, lineHeight: 1.7, fontFamily: "'DM Mono', monospace" }}>
                    {line}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: `1px solid ${t.border}`, fontSize: "0.55rem", color: t.textVeryFaint, letterSpacing: "0.1em" }}>
          URLs are fetched, chunked (~1200 chars), embedded with Voyage AI, and stored in Supabase pgvector · Already-ingested URLs are skipped automatically
        </div>
      </div>
    </div>
  );
}