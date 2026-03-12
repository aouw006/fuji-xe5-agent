"use client";
import { useState } from "react";

const t = {
  bg: "#0e0e0e",
  bgCard: "#141414",
  border: "rgba(255,255,255,0.07)",
  borderCard: "rgba(255,255,255,0.05)",
  text: "#e8e0d0",
  textMuted: "#9a9080",
  textFaint: "#5a5248",
  textVeryFaint: "#3a3530",
  gold: "#c8a96e",
  goldDim: "rgba(200,169,110,0.15)",
  goldBorder: "rgba(200,169,110,0.25)",
};

const AGENT_COLORS: Record<string, string> = {
  film_recipes: "#c8a96e",
  camera_settings: "#7eb8c8",
  gear: "#a8c87e",
  comparison: "#7e9ec8",
  community: "#c87ea8",
  locations: "#c8987e",
};

const EVALS: { id: string; agent: string; agentLabel: string; question: string }[] = [
  { id: "fr1", agent: "film_recipes", agentLabel: "Film Recipes", question: "What are the exact settings for a Classic Chrome recipe on the X-E5?" },
  { id: "fr2", agent: "film_recipes", agentLabel: "Film Recipes", question: "Recommend a film recipe for shooting portraits in golden hour" },
  { id: "fr3", agent: "film_recipes", agentLabel: "Film Recipes", question: "What's the difference between Eterna and Eterna Cinema on the X-E5?" },
  { id: "cs1", agent: "camera_settings", agentLabel: "Camera Settings", question: "What autofocus mode should I use for street photography on the X-E5?" },
  { id: "cs2", agent: "camera_settings", agentLabel: "Camera Settings", question: "How do I set up the X-E5 for shooting in low light?" },
  { id: "cs3", agent: "camera_settings", agentLabel: "Camera Settings", question: "What does IBIS do on the X-E5 and when should I turn it off?" },
  { id: "g1", agent: "gear", agentLabel: "Gear", question: "What's the best compact lens for travel on the X-E5?" },
  { id: "g2", agent: "gear", agentLabel: "Gear", question: "Compare the XF 23mm f2 and XF 35mm f2 for street photography" },
  { id: "g3", agent: "gear", agentLabel: "Gear", question: "What accessories do I need to get started with the X-E5?" },
  { id: "cmp1", agent: "comparison", agentLabel: "Comparison", question: "Compare Classic Chrome vs Eterna for street photography" },
  { id: "cmp2", agent: "comparison", agentLabel: "Comparison", question: "Which is better for portraits — Velvia or PRO Neg Hi?" },
  { id: "cmp3", agent: "comparison", agentLabel: "Comparison", question: "XF 27mm pancake vs XF 35mm f2 — which is more versatile?" },
  { id: "com1", agent: "community", agentLabel: "Community", question: "What do X-E5 users say about battery life?" },
  { id: "com2", agent: "community", agentLabel: "Community", question: "What are the most popular shooting styles in the Fujifilm community?" },
  { id: "loc1", agent: "locations", agentLabel: "Locations", question: "Where are good locations to shoot street photography in Melbourne?" },
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

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? "#7ec87e" : score >= 6 ? t.gold : "#c87e7e";
  const bg = score >= 8 ? "rgba(100,180,100,0.1)" : score >= 6 ? "rgba(200,169,110,0.1)" : "rgba(200,100,100,0.1)";
  const border = score >= 8 ? "rgba(100,180,100,0.25)" : score >= 6 ? "rgba(200,169,110,0.25)" : "rgba(200,100,100,0.25)";
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "3px", background: bg, border: `1px solid ${border}`, color, fontFamily: "'DM Mono', monospace" }}>
      {score}/10
    </span>
  );
}

function CriteriaBar({ label, value }: { label: string; value: number }) {
  const pct = (value / 3) * 100;
  const color = value === 3 ? "#7ec87e" : value === 2 ? t.gold : "#c87e7e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
      <div style={{ fontSize: "0.52rem", color: t.textFaint, width: "60px", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "2px", transition: "width 0.5s ease" }} />
      </div>
      <div style={{ fontSize: "0.52rem", color, width: "20px", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{value}/3</div>
    </div>
  );
}

export default function EvalsPage() {
  const [results, setResults] = useState<Record<string, EvalResult>>({});
  const [running, setRunning] = useState(false);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function updateResult(id: string, patch: Partial<EvalResult>) {
    setResults(prev => ({ ...prev, [id]: { ...(prev[id] || { id, status: "pending" }), ...patch } }));
  }

  async function runEval(evalItem: typeof EVALS[0]) {
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
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
          for (const line of lines) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text") fullAnswer += data.text;
              if (data.type === "reflection") { score = data.score; critique = data.critique; criteria = data.criteria; }
            } catch {}
          }
        }
      }

      updateResult(evalItem.id, {
        status: "done",
        answer: fullAnswer.trim(),
        score,
        critique,
        criteria,
        ms: Date.now() - start,
      });
    } catch (e) {
      updateResult(evalItem.id, { status: "error", error: String(e), ms: Date.now() - start });
    }
  }

  async function runAll() {
    setRunning(true);
    setRunningAgent(null);
    for (const e of EVALS) {
      await runEval(e);
      await new Promise(r => setTimeout(r, 500));
    }
    setRunning(false);
  }

  async function runAgent(agentId: string) {
    setRunning(true);
    setRunningAgent(agentId);
    const agentEvals = EVALS.filter(e => e.agent === agentId);
    for (const e of agentEvals) {
      await runEval(e);
      await new Promise(r => setTimeout(r, 500));
    }
    setRunning(false);
    setRunningAgent(null);
  }

  // Compute per-agent averages
  const agentIds = [...new Set(EVALS.map(e => e.agent))];
  const agentStats = agentIds.map(agentId => {
    const agentEvals = EVALS.filter(e => e.agent === agentId);
    const scored = agentEvals.filter(e => results[e.id]?.score !== undefined);
    const avg = scored.length > 0 ? scored.reduce((s, e) => s + (results[e.id].score || 0), 0) / scored.length : null;
    const done = agentEvals.filter(e => results[e.id]?.status === "done").length;
    return { agentId, label: agentEvals[0].agentLabel, total: agentEvals.length, done, avg };
  });

  const totalDone = EVALS.filter(e => results[e.id]?.status === "done").length;
  const totalScored = EVALS.filter(e => results[e.id]?.score !== undefined).length;
  const overallAvg = totalScored > 0
    ? EVALS.filter(e => results[e.id]?.score !== undefined).reduce((s, e) => s + (results[e.id].score || 0), 0) / totalScored
    : null;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'DM Mono', monospace", padding: "2rem" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 2px; }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes fadeIn { from { opacity:0; transform: translateY(4px) } to { opacity:1; transform: translateY(0) } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>

      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem", display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderBottom: `1px solid ${t.border}`, paddingBottom: "1.5rem" }}>
          <div>
            <a href="/dashboard" style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", textDecoration: "none", display: "block", marginBottom: "0.5rem" }}>
              ← Dashboard
            </a>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 900, color: t.text }}>
              Agent Evals
            </div>
            <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", marginTop: "0.25rem" }}>
              {totalDone}/{EVALS.length} completed
              {overallAvg !== null && <span style={{ color: t.gold, marginLeft: "0.75rem" }}>overall avg {overallAvg.toFixed(1)}/10</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={runAll} disabled={running}
              style={{ background: running ? "transparent" : t.goldDim, border: `1px solid ${running ? t.border : t.goldBorder}`, color: running ? t.textFaint : t.gold, padding: "0.6rem 1.2rem", borderRadius: "3px", cursor: running ? "not-allowed" : "pointer", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s" }}>
              {running && !runningAgent ? (
                <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ display: "inline-block", width: "8px", height: "8px", border: `1px solid ${t.gold}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Running…
                </span>
              ) : "Run all evals"}
            </button>
          </div>
        </div>

        {/* Agent scorecards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "2rem" }}>
          {agentStats.map(stat => (
            <div key={stat.agentId} style={{ background: t.bgCard, border: `1px solid ${t.borderCard}`, borderRadius: "4px", padding: "0.9rem 1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.58rem", color: AGENT_COLORS[stat.agentId] || t.gold, letterSpacing: "0.08em", textTransform: "uppercase" }}>{stat.label}</span>
                {stat.avg !== null && <ScoreBadge score={Math.round(stat.avg)} />}
              </div>
              <div style={{ fontSize: "0.55rem", color: t.textFaint, marginBottom: "0.6rem" }}>
                {stat.done}/{stat.total} run
                {stat.avg !== null && <span style={{ color: t.textMuted, marginLeft: "0.4rem" }}>avg {stat.avg.toFixed(1)}</span>}
              </div>
              <button onClick={() => runAgent(stat.agentId)} disabled={running}
                style={{ width: "100%", background: "transparent", border: `1px solid ${t.border}`, color: running && runningAgent === stat.agentId ? t.gold : t.textFaint, padding: "0.3rem", borderRadius: "2px", cursor: running ? "not-allowed" : "pointer", fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}
                onMouseEnter={e => { if (!running) { e.currentTarget.style.borderColor = AGENT_COLORS[stat.agentId]; e.currentTarget.style.color = AGENT_COLORS[stat.agentId]; }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textFaint; }}>
                {running && runningAgent === stat.agentId ? "Running…" : "Run agent"}
              </button>
            </div>
          ))}
        </div>

        {/* Results list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {EVALS.map(e => {
            const result = results[e.id];
            const isExpanded = expanded === e.id;
            const status = result?.status || "pending";

            return (
              <div key={e.id} style={{ background: t.bgCard, border: `1px solid ${status === "running" ? t.goldBorder : t.borderCard}`, borderRadius: "4px", overflow: "hidden", animation: "fadeIn 0.2s ease", transition: "border-color 0.2s" }}>
                <button onClick={() => result?.status === "done" ? setExpanded(isExpanded ? null : e.id) : undefined}
                  style={{ width: "100%", background: "transparent", border: "none", padding: "0.75rem 1rem", cursor: result?.status === "done" ? "pointer" : "default", textAlign: "left", display: "flex", alignItems: "center", gap: "0.75rem" }}>

                  {/* Status indicator */}
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                    background: status === "done" ? (result.score !== undefined ? (result.score >= 8 ? "#7ec87e" : result.score >= 6 ? t.gold : "#c87e7e") : t.textFaint) : status === "running" ? t.gold : status === "error" ? "#c87e7e" : t.textVeryFaint,
                    animation: status === "running" ? "pulse 1s infinite" : "none",
                  }} />

                  {/* Agent badge */}
                  <span style={{ fontSize: "0.52rem", color: AGENT_COLORS[e.agent], border: `1px solid ${AGENT_COLORS[e.agent]}33`, borderRadius: "2px", padding: "0.05rem 0.3rem", flexShrink: 0, letterSpacing: "0.06em" }}>
                    {e.agentLabel}
                  </span>

                  {/* Question */}
                  <span style={{ flex: 1, fontSize: "0.7rem", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.question}
                  </span>

                  {/* Score / status */}
                  <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {result?.ms && <span style={{ fontSize: "0.52rem", color: t.textVeryFaint }}>{(result.ms / 1000).toFixed(1)}s</span>}
                    {result?.score !== undefined && <ScoreBadge score={result.score} />}
                    {status === "error" && <span style={{ fontSize: "0.55rem", color: "#c87e7e" }}>error</span>}
                    {status === "done" && (
                      <span style={{ fontSize: "0.55rem", color: t.textFaint, marginLeft: "0.25rem" }}>{isExpanded ? "▲" : "▼"}</span>
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && result && (
                  <div style={{ borderTop: `1px solid ${t.border}`, padding: "0.9rem 1rem", animation: "fadeIn 0.2s ease" }}>
                    {result.critique && (
                      <div style={{ fontSize: "0.65rem", color: t.textMuted, lineHeight: 1.6, marginBottom: "0.75rem", fontStyle: "italic", borderLeft: `2px solid ${t.goldBorder}`, paddingLeft: "0.75rem" }}>
                        {result.critique}
                      </div>
                    )}
                    {result.criteria && (
                      <div style={{ marginBottom: "0.75rem" }}>
                        <CriteriaBar label="Answered" value={result.criteria.answered} />
                        <CriteriaBar label="Specific" value={result.criteria.specific} />
                        <CriteriaBar label="Prices" value={result.criteria.prices} />
                        <CriteriaBar label="Expertise" value={result.criteria.expertise} />
                      </div>
                    )}
                    {result.answer && (
                      <div style={{ fontSize: "0.62rem", color: t.textMuted, lineHeight: 1.7, maxHeight: "200px", overflowY: "auto", background: t.bg, border: `1px solid ${t.border}`, borderRadius: "3px", padding: "0.65rem 0.75rem" }}>
                        {result.answer.slice(0, 800)}{result.answer.length > 800 ? "…" : ""}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: `1px solid ${t.border}`, fontSize: "0.55rem", color: t.textVeryFaint, letterSpacing: "0.1em" }}>
          Each eval runs the full agent pipeline and scores the response using the reflection scorer · Results are not saved between page loads
        </div>
      </div>
    </div>
  );
}
