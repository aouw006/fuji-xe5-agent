"use client";
import { useState, useEffect, useCallback } from "react";
import { darkTheme, lightTheme } from "@/lib/theme";

const AGENT_COLORS: Record<string, string> = {
  film_recipes: "#c8a96e",
  camera_settings: "#7eb8c8",
  gear: "#a8c87e",
  comparison: "#7e9ec8",
  community: "#c87ea8",
  locations: "#c8987e",
};

const AGENT_LABELS: Record<string, string> = {
  film_recipes: "Film Recipes",
  camera_settings: "Camera Settings",
  gear: "Gear",
  comparison: "Comparison",
  community: "Community",
  locations: "Locations",
};

const EVALS: { id: string; agent: string; question: string }[] = [
  { id: "fr1", agent: "film_recipes", question: "What are the exact settings for a Classic Chrome recipe on the X-E5?" },
  { id: "fr2", agent: "film_recipes", question: "Recommend a film recipe for shooting portraits in golden hour" },
  { id: "fr3", agent: "film_recipes", question: "What's the difference between Eterna and Eterna Cinema on the X-E5?" },
  { id: "cs1", agent: "camera_settings", question: "What autofocus mode should I use for street photography on the X-E5?" },
  { id: "cs2", agent: "camera_settings", question: "How do I set up the X-E5 for shooting in low light?" },
  { id: "cs3", agent: "camera_settings", question: "What does IBIS do on the X-E5 and when should I turn it off?" },
  { id: "g1",  agent: "gear", question: "What's the best compact lens for travel on the X-E5?" },
  { id: "g2",  agent: "gear", question: "Compare the XF 23mm f2 and XF 35mm f2 for street photography" },
  { id: "g3",  agent: "gear", question: "What accessories do I need to get started with the X-E5?" },
  { id: "cmp1", agent: "comparison", question: "Compare Classic Chrome vs Eterna for street photography" },
  { id: "cmp2", agent: "comparison", question: "Which is better for portraits — Velvia or PRO Neg Hi?" },
  { id: "cmp3", agent: "comparison", question: "XF 27mm pancake vs XF 35mm f2 — which is more versatile?" },
  { id: "com1", agent: "community", question: "What do X-E5 users say about battery life?" },
  { id: "com2", agent: "community", question: "What are the most popular shooting styles in the Fujifilm community?" },
  { id: "loc1", agent: "locations", question: "Where are good locations to shoot street photography in Melbourne?" },
];

type EvalStatus = "pending" | "running" | "done" | "error";

interface EvalResult {
  id: string;
  status: EvalStatus;
  answer?: string;
  score?: number;
  critique?: string;
  criteria?: { answered: number; specific: number; prices: number; expertise: number };
  ms?: number;
  error?: string;
}

function ScoreBadge({ score, gold, goldDim, goldBorder }: { score: number; gold: string; goldDim: string; goldBorder: string }) {
  const color = score >= 8 ? "#7ec87e" : score >= 6 ? gold : "#c87e7e";
  const bg = score >= 8 ? "rgba(100,180,100,0.1)" : score >= 6 ? goldDim : "rgba(200,100,100,0.1)";
  const border = score >= 8 ? "rgba(100,180,100,0.25)" : score >= 6 ? goldBorder : "rgba(200,100,100,0.25)";
  return (
    <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "0.12rem 0.45rem", borderRadius: "3px", background: bg, border: `1px solid ${border}`, color, fontFamily: "'DM Mono', monospace" }}>
      {score}/10
    </span>
  );
}

function ScoreDiff({ before, after }: { before: number; after: number }) {
  const diff = after - before;
  if (diff === 0) return <span style={{ fontSize: "0.52rem", color: "#888", fontFamily: "'DM Mono', monospace" }}>±0</span>;
  return <span style={{ fontSize: "0.52rem", color: diff > 0 ? "#7ec87e" : "#c87e7e", fontFamily: "'DM Mono', monospace" }}>{diff > 0 ? "+" : ""}{diff}</span>;
}

function CriteriaBar({ label, value, textFaint }: { label: string; value: number; textFaint: string }) {
  const color = value === 3 ? "#7ec87e" : value === 2 ? "#c8a96e" : "#c87e7e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
      <div style={{ fontSize: "0.52rem", color: textFaint, width: "62px", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: "3px", background: "rgba(128,128,128,0.15)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ width: `${(value / 3) * 100}%`, height: "100%", background: color, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ fontSize: "0.52rem", color, width: "20px", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{value}/3</div>
    </div>
  );
}

export default function EvalsPage() {
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

  const [results, setResults] = useState<Record<string, EvalResult>>({});
  const [baseline, setBaseline] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    fetch("/api/prompts").then(r => r.json()).then(setPrompts).catch(() => {});
  }, []);

  function updateResult(id: string, patch: Partial<EvalResult>) {
    setResults(prev => ({ ...prev, [id]: { ...(prev[id] || { id, status: "pending" }), ...patch } }));
  }

  const runEval = useCallback(async (evalItem: typeof EVALS[0]) => {
    updateResult(evalItem.id, { status: "running" });
    const start = Date.now();
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: evalItem.question, history: [], sessionId: `eval-${Date.now()}` }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";
      let score: number | undefined;
      let critique: string | undefined;
      let criteria: EvalResult["criteria"];
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: "));
          for (const line of lines) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text") fullAnswer += data.text;
              if (data.type === "reflection") { score = data.score; critique = data.critique; criteria = data.criteria; }
            } catch {}
          }
        }
      }
      updateResult(evalItem.id, { status: "done", answer: fullAnswer.trim(), score, critique, criteria, ms: Date.now() - start });
    } catch (e) {
      updateResult(evalItem.id, { status: "error", error: String(e), ms: Date.now() - start });
    }
  }, []);

  async function runAll() {
    setRunning(true); setRunningAgent(null);
    for (const e of EVALS) { await runEval(e); await new Promise(r => setTimeout(r, 400)); }
    setRunning(false);
  }

  async function runAgent(agentId: string) {
    setRunning(true); setRunningAgent(agentId);
    const snap: Record<string, number> = { ...baseline };
    EVALS.filter(e => e.agent === agentId).forEach(e => {
      if (results[e.id]?.score !== undefined) snap[e.id] = results[e.id].score!;
    });
    setBaseline(snap);
    for (const e of EVALS.filter(e => e.agent === agentId)) { await runEval(e); await new Promise(r => setTimeout(r, 400)); }
    setRunning(false); setRunningAgent(null);
  }

  async function savePrompt(agentId: string) {
    setSaving(true); setSaveMsg("");
    try {
      await fetch("/api/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId, prompt: editDraft }) });
      setPrompts(prev => ({ ...prev, [agentId]: editDraft }));
      setSaveMsg("Saved — re-run this agent to see the effect");
      setTimeout(() => setSaveMsg(""), 4000);
    } catch { setSaveMsg("Save failed"); }
    setSaving(false);
  }

  function openEditor(agentId: string) {
    setEditingAgent(agentId); setEditDraft(prompts[agentId] || ""); setSaveMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const agentIds = EVALS.map(e => e.agent).filter((a, i, arr) => arr.indexOf(a) === i);
  const agentStats = agentIds.map(agentId => {
    const agentEvals = EVALS.filter(e => e.agent === agentId);
    const scored = agentEvals.filter(e => results[e.id]?.score !== undefined);
    const avg = scored.length > 0 ? scored.reduce((s, e) => s + (results[e.id].score || 0), 0) / scored.length : null;
    return { agentId, total: agentEvals.length, done: agentEvals.filter(e => results[e.id]?.status === "done").length, avg };
  });

  const totalDone = EVALS.filter(e => results[e.id]?.status === "done").length;
  const totalScored = EVALS.filter(e => results[e.id]?.score !== undefined).length;
  const overallAvg = totalScored > 0 ? EVALS.filter(e => results[e.id]?.score !== undefined).reduce((s, e) => s + (results[e.id].score || 0), 0) / totalScored : null;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'DM Mono', monospace", padding: "2rem", transition: "background 0.3s, color 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 2px; }
        textarea { outline: none; }
        textarea:focus { border-color: ${t.gold} !important; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem", display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderBottom: `1px solid ${t.border}`, paddingBottom: "1.5rem" }}>
          <div>
            <a href="/dashboard" style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", textDecoration: "none", display: "block", marginBottom: "0.5rem" }}>← Dashboard</a>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 900 }}>Agent Evals</div>
            <div style={{ fontSize: "0.58rem", color: t.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "0.25rem" }}>
              {totalDone}/{EVALS.length} completed
              {overallAvg !== null && <span style={{ color: t.gold, marginLeft: "0.75rem" }}>overall {overallAvg.toFixed(1)}/10</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button onClick={runAll} disabled={running}
              style={{ background: running ? "transparent" : t.goldDim, border: `1px solid ${running ? t.border : goldBorder}`, color: running ? t.textMuted : t.gold, padding: "0.6rem 1.4rem", borderRadius: "3px", cursor: running ? "not-allowed" : "pointer", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s" }}>
              {running && !runningAgent
                ? <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><span style={{ width: "8px", height: "8px", border: `1px solid ${t.gold}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />Running…</span>
                : "Run all evals"}
            </button>
          </div>
        </div>

        {/* Agent scorecards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {agentStats.map(stat => (
            <div key={stat.agentId} style={{ background: t.bgCard, border: `1px solid ${editingAgent === stat.agentId ? goldBorder : t.borderCard}`, borderRadius: "4px", padding: "0.9rem 1rem", transition: "background 0.3s, border-color 0.2s" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ fontSize: "0.58rem", color: AGENT_COLORS[stat.agentId], letterSpacing: "0.06em", textTransform: "uppercase" }}>{AGENT_LABELS[stat.agentId]}</span>
                {stat.avg !== null && <ScoreBadge score={Math.round(stat.avg)} gold={t.gold} goldDim={t.goldDim} goldBorder={goldBorder} />}
              </div>
              <div style={{ fontSize: "0.53rem", color: t.textFaint, marginBottom: "0.65rem" }}>
                {stat.done}/{stat.total} run{stat.avg !== null && <span style={{ color: t.textMuted, marginLeft: "0.35rem" }}>· avg {stat.avg.toFixed(1)}</span>}
              </div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button onClick={() => runAgent(stat.agentId)} disabled={running}
                  style={{ flex: 1, background: "transparent", border: `1px solid ${t.border}`, color: running && runningAgent === stat.agentId ? t.gold : t.textMuted, padding: "0.28rem 0", borderRadius: "2px", cursor: running ? "not-allowed" : "pointer", fontSize: "0.53rem", letterSpacing: "0.06em", textTransform: "uppercase", transition: "all 0.2s" }}
                  onMouseEnter={e => { if (!running) { e.currentTarget.style.borderColor = AGENT_COLORS[stat.agentId]; e.currentTarget.style.color = AGENT_COLORS[stat.agentId]; }}}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>
                  {running && runningAgent === stat.agentId ? "Running…" : "Run"}
                </button>
                <button onClick={() => editingAgent === stat.agentId ? setEditingAgent(null) : openEditor(stat.agentId)}
                  style={{ flex: 1, background: editingAgent === stat.agentId ? t.goldDim : "transparent", border: `1px solid ${editingAgent === stat.agentId ? goldBorder : t.border}`, color: editingAgent === stat.agentId ? t.gold : t.textMuted, padding: "0.28rem 0", borderRadius: "2px", cursor: "pointer", fontSize: "0.53rem", letterSpacing: "0.06em", textTransform: "uppercase", transition: "all 0.2s" }}>
                  {editingAgent === stat.agentId ? "Close" : "Edit prompt"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Prompt editor */}
        {editingAgent && (
          <div style={{ background: t.bgCard, border: `1px solid ${goldBorder}`, borderRadius: "4px", padding: "1.25rem", marginBottom: "1.5rem", animation: "fadeIn 0.2s ease", transition: "background 0.3s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div>
                <span style={{ fontSize: "0.55rem", color: AGENT_COLORS[editingAgent], letterSpacing: "0.1em", textTransform: "uppercase" }}>{AGENT_LABELS[editingAgent]}</span>
                <span style={{ fontSize: "0.55rem", color: t.textFaint, marginLeft: "0.5rem" }}>· system prompt</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {saveMsg && <span style={{ fontSize: "0.58rem", color: saveMsg.includes("failed") ? "#c87e7e" : "#7ec87e" }}>{saveMsg}</span>}
                <button onClick={() => setEditDraft(prompts[editingAgent] || "")}
                  style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, padding: "0.28rem 0.7rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}>Reset</button>
                <button onClick={() => savePrompt(editingAgent)} disabled={saving}
                  style={{ background: saving ? "transparent" : t.goldDim, border: `1px solid ${goldBorder}`, color: saving ? t.textMuted : t.gold, padding: "0.28rem 0.85rem", borderRadius: "2px", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
            <textarea value={editDraft} onChange={e => setEditDraft(e.target.value)} rows={16}
              style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: "3px", color: t.text, fontFamily: "'DM Mono', monospace", fontSize: "0.65rem", lineHeight: 1.75, padding: "0.75rem", resize: "vertical", transition: "background 0.3s, border-color 0.2s" }} />
            <div style={{ fontSize: "0.52rem", color: t.textVeryFaint, marginTop: "0.4rem" }}>
              Saved to Supabase — takes effect on next query, no redeploy needed. Re-run this agent after saving to see scores change.
            </div>
          </div>
        )}

        {/* Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {EVALS.map(e => {
            const result = results[e.id];
            const isExpanded = expanded === e.id;
            const status = result?.status || "pending";
            const baseScore = baseline[e.id];
            const currentScore = result?.score;

            return (
              <div key={e.id} style={{ background: t.bgCard, border: `1px solid ${status === "running" ? goldBorder : t.borderCard}`, borderRadius: "4px", overflow: "hidden", transition: "border-color 0.2s, background 0.3s" }}>
                <button onClick={() => result?.status === "done" ? setExpanded(isExpanded ? null : e.id) : undefined}
                  style={{ width: "100%", background: "transparent", border: "none", padding: "0.7rem 1rem", cursor: result?.status === "done" ? "pointer" : "default", textAlign: "left", display: "flex", alignItems: "center", gap: "0.65rem" }}>

                  <div style={{ width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0,
                    background: status === "done" ? (currentScore !== undefined ? (currentScore >= 8 ? "#7ec87e" : currentScore >= 6 ? t.gold : "#c87e7e") : t.textFaint) : status === "running" ? t.gold : status === "error" ? "#c87e7e" : t.textVeryFaint,
                    animation: status === "running" ? "pulse 1s infinite" : "none" }} />

                  <span style={{ fontSize: "0.5rem", color: AGENT_COLORS[e.agent], border: `1px solid ${AGENT_COLORS[e.agent]}33`, borderRadius: "2px", padding: "0.04rem 0.28rem", flexShrink: 0, letterSpacing: "0.05em" }}>
                    {AGENT_LABELS[e.agent]}
                  </span>

                  <span style={{ flex: 1, fontSize: "0.68rem", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.question}</span>

                  <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "0.45rem" }}>
                    {result?.ms && <span style={{ fontSize: "0.5rem", color: t.textVeryFaint }}>{(result.ms / 1000).toFixed(1)}s</span>}
                    {baseScore !== undefined && currentScore !== undefined && (
                      <span style={{ fontSize: "0.52rem", color: t.textFaint, fontFamily: "'DM Mono', monospace" }}>{baseScore} →</span>
                    )}
                    {currentScore !== undefined && <ScoreBadge score={currentScore} gold={t.gold} goldDim={t.goldDim} goldBorder={goldBorder} />}
                    {baseScore !== undefined && currentScore !== undefined && <ScoreDiff before={baseScore} after={currentScore} />}
                    {status === "error" && <span style={{ fontSize: "0.53rem", color: "#c87e7e" }}>error</span>}
                    {status === "done" && <span style={{ fontSize: "0.5rem", color: t.textFaint }}>{isExpanded ? "▲" : "▼"}</span>}
                  </div>
                </button>

                {isExpanded && result && (
                  <div style={{ borderTop: `1px solid ${t.border}`, padding: "0.85rem 1rem", animation: "fadeIn 0.15s ease" }}>
                    {result.critique && (
                      <div style={{ fontSize: "0.64rem", color: t.textMuted, lineHeight: 1.65, marginBottom: "0.75rem", fontStyle: "italic", borderLeft: `2px solid ${goldBorder}`, paddingLeft: "0.75rem" }}>
                        {result.critique}
                      </div>
                    )}
                    {result.criteria && (
                      <div style={{ marginBottom: "0.75rem" }}>
                        <CriteriaBar label="Answered" value={result.criteria.answered} textFaint={t.textFaint} />
                        <CriteriaBar label="Specific" value={result.criteria.specific} textFaint={t.textFaint} />
                        <CriteriaBar label="Prices" value={result.criteria.prices} textFaint={t.textFaint} />
                        <CriteriaBar label="Expertise" value={result.criteria.expertise} textFaint={t.textFaint} />
                      </div>
                    )}
                    {result.answer && (
                      <div style={{ fontSize: "0.61rem", color: t.textMuted, lineHeight: 1.7, maxHeight: "180px", overflowY: "auto", background: t.bg, border: `1px solid ${t.border}`, borderRadius: "3px", padding: "0.6rem 0.75rem", marginBottom: "0.6rem", transition: "background 0.3s" }}>
                        {result.answer.slice(0, 800)}{result.answer.length > 800 ? "…" : ""}
                      </div>
                    )}
                    <button onClick={() => openEditor(e.agent)}
                      style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, padding: "0.25rem 0.65rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.53rem", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}
                      onMouseEnter={ev => { ev.currentTarget.style.borderColor = t.gold; ev.currentTarget.style.color = t.gold; }}
                      onMouseLeave={ev => { ev.currentTarget.style.borderColor = t.border; ev.currentTarget.style.color = t.textMuted; }}>
                      Edit {AGENT_LABELS[e.agent]} prompt →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: `1px solid ${t.border}`, fontSize: "0.53rem", color: t.textVeryFaint, letterSpacing: "0.08em" }}>
          Scores use the reflection scorer · Results reset on page reload · Prompt edits persist to Supabase · Before/after shown when re-running a single agent
        </div>
      </div>
    </div>
  );
}