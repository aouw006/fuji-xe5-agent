"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";

// ─── Theme ────────────────────────────────────────────────────────────────────
const GOLD = "#c8a96e";
const GOLD_DIM = "#6b5d45";
const BG = "#0d0b08";
const CARD = "#111009";
const BORDER = "#1e1b14";
const TEXT = "#e8d5b0";
const TEXT_DIM = "#8a7a62";
const TEXT_FAINT = "#3a3020";

const AGENT_COLORS: Record<string, string> = {
  film_recipes:    "#c8a96e",
  camera_settings: "#7eb8d4",
  locations:       "#7ed4a0",
  gear:            "#d4a07e",
  comparison:      "#b07ed4",
  community:       "#d4d07e",
  unknown:         "#444",
};

const AGENT_LABELS: Record<string, string> = {
  film_recipes:    "🎞️ Film Recipes",
  camera_settings: "⚙️ Settings",
  locations:       "📍 Locations",
  gear:            "🎒 Gear",
  comparison:      "⚖️ Comparison",
  community:       "🌐 Community",
  unknown:         "Unknown",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardData {
  costByDay: { date: string; tokens: number; cost: number }[];
  agentBreakdown: { id: string; tokens: number; cost: number; pct: number }[];
  agentQueries: Record<string, { count: number; totalMs: number }>;
  promptLog: {
    session_id: string;
    query: string;
    agent_id: string;
    prompt_sent: string;
    sources_used: { title: string; url: string }[];
    tokens_used: number;
    response_time_ms: number;
    created_at: string;
  }[];
  filmSimBreakdown: { name: string; count: number }[];
  moodBreakdown: { mood: string; count: number }[];
  totalRecipes: number;
  monthTokens: number;
  monthCost: number;
  budgetUsd: number;
  totalQueries: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Card({ title, children, span = 1 }: { title: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: "4px",
      padding: "1.25rem",
      gridColumn: `span ${span}`,
    }}>
      <div style={{ fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD_DIM, marginBottom: "1rem" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function StatPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: GOLD, fontFamily: "'DM Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: "0.62rem", color: TEXT_DIM, marginTop: "0.2rem" }}>{label}</div>
      {sub && <div style={{ fontSize: "0.55rem", color: TEXT_FAINT, marginTop: "0.1rem" }}>{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a1610", border: `1px solid ${BORDER}`, borderRadius: "3px", padding: "0.5rem 0.75rem", fontSize: "0.7rem" }}>
      <div style={{ color: TEXT_DIM, marginBottom: "0.25rem" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: GOLD }}>
          {p.name === "cost" ? `$${p.value.toFixed(5)}` : p.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<DashboardData["promptLog"][0] | null>(null);
  const [activeTab, setActiveTab] = useState<"cost" | "agents" | "prompts" | "recipes">("cost");

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const budgetPct = data ? Math.min((data.monthCost / data.budgetUsd) * 100, 100) : 0;
  const budgetColor = budgetPct > 90 ? "#e05555" : budgetPct > 70 ? "#e0a855" : "#4caf7d";

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Grain overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`, backgroundSize: "256px", opacity: 0.4 }} />

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, borderBottom: `1px solid ${BORDER}`, background: "rgba(13,11,8,0.92)", backdropFilter: "blur(16px)", padding: "0.7rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: `1.5px solid ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.48rem", color: GOLD, background: "rgba(200,169,110,0.06)", fontFamily: "'DM Mono', monospace" }}>XE5</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.9rem", fontWeight: 700, color: TEXT }}>Dashboard</div>
            <div style={{ fontSize: "0.5rem", color: TEXT_DIM, letterSpacing: "0.1em", textTransform: "uppercase" }}>X-E5 Research Agent · Analytics</div>
          </div>
        </div>
        <Link href="/" style={{ background: "transparent", border: `1px solid ${BORDER}`, color: TEXT_DIM, padding: "0.3rem 0.75rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", transition: "all 0.2s" }}>
          ← Back to Agent
        </Link>
      </header>

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem", position: "relative", zIndex: 1 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: TEXT_DIM, fontSize: "0.8rem" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>⏳</div>
            Loading dashboard data...
          </div>
        ) : !data ? (
          <div style={{ textAlign: "center", padding: "4rem", color: TEXT_DIM }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>⚠️</div>
            <div style={{ fontSize: "0.8rem" }}>Could not load dashboard. Check Supabase connection.</div>
          </div>
        ) : (
          <>
            {/* ── Summary row ─────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
              {[
                { label: "Month Cost", value: `$${data.monthCost.toFixed(4)}`, sub: `of $${data.budgetUsd.toFixed(2)} budget` },
                { label: "Budget Used", value: `${budgetPct.toFixed(1)}%`, sub: `$${(data.budgetUsd - data.monthCost).toFixed(4)} remaining` },
                { label: "Total Queries", value: String(data.totalQueries), sub: "this month" },
                { label: "Tokens Used", value: data.monthTokens > 1000 ? `${(data.monthTokens / 1000).toFixed(1)}k` : String(data.monthTokens), sub: "estimated" },
                { label: "Saved Recipes", value: String(data.totalRecipes), sub: "all time" },
              ].map((s, i) => (
                <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: i === 1 ? budgetColor : GOLD, fontFamily: "'DM Mono', monospace" }}>{s.value}</div>
                  <div style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: "0.2rem" }}>{s.label}</div>
                  {s.sub && <div style={{ fontSize: "0.52rem", color: TEXT_FAINT, marginTop: "0.15rem" }}>{s.sub}</div>}
                </div>
              ))}
            </div>

            {/* Budget bar */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "0.75rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "0.6rem", color: TEXT_DIM, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>MONTHLY BUDGET</span>
              <div style={{ flex: 1, height: "4px", background: "#1a1610", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ width: `${budgetPct}%`, height: "100%", background: budgetColor, borderRadius: "2px", transition: "width 0.6s ease" }} />
              </div>
              <span style={{ fontSize: "0.65rem", color: budgetColor, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>
                ${data.monthCost.toFixed(4)} / ${data.budgetUsd.toFixed(2)}
              </span>
            </div>

            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1rem", borderBottom: `1px solid ${BORDER}`, paddingBottom: "0" }}>
              {([
                ["cost",    "💰 Cost & Usage"],
                ["agents",  "🤖 Agent Breakdown"],
                ["prompts", "🔍 Prompt Inspector"],
                ["recipes", "🎞️ Recipe Analytics"],
              ] as const).map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === tab ? `2px solid ${GOLD}` : "2px solid transparent",
                  color: activeTab === tab ? GOLD : TEXT_DIM,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                  fontSize: "0.68rem",
                  letterSpacing: "0.06em",
                  transition: "all 0.2s",
                  marginBottom: "-1px",
                }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── Cost & Usage tab ─────────────────────────────────────────── */}
            {activeTab === "cost" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Card title="Daily Cost (USD) — last 30 days" span={2}>
                  {data.costByDay.length === 0 ? (
                    <div style={{ color: TEXT_DIM, fontSize: "0.75rem", textAlign: "center", padding: "2rem" }}>No data yet — start asking questions!</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={data.costByDay} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: TEXT_DIM }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: TEXT_DIM }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toFixed(4)}`} width={60} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="cost" name="cost" stroke={GOLD} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: GOLD }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card title="Daily Token Volume — last 30 days">
                  {data.costByDay.length === 0 ? (
                    <div style={{ color: TEXT_DIM, fontSize: "0.75rem", textAlign: "center", padding: "2rem" }}>No data yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data.costByDay} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: TEXT_DIM }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: TEXT_DIM }} axisLine={false} tickLine={false} tickFormatter={v => v > 1000 ? `${(v/1000).toFixed(0)}k` : v} width={40} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="tokens" name="tokens" fill={GOLD} opacity={0.7} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card title="Cost per Query (avg)">
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingTop: "0.5rem" }}>
                    {data.agentBreakdown.map(agent => {
                      const q = data.agentQueries[agent.id];
                      const avgCost = q?.count > 0 ? agent.cost / q.count : 0;
                      const avgMs = q?.count > 0 ? Math.round(q.totalMs / q.count / 1000) : 0;
                      return (
                        <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span style={{ fontSize: "0.65rem", color: TEXT_DIM, width: "120px", flexShrink: 0 }}>{AGENT_LABELS[agent.id] || agent.id}</span>
                          <span style={{ fontSize: "0.65rem", color: GOLD, fontFamily: "'DM Mono', monospace", width: "70px" }}>${avgCost.toFixed(5)}</span>
                          <span style={{ fontSize: "0.6rem", color: TEXT_FAINT, fontFamily: "'DM Mono', monospace" }}>{avgMs > 0 ? `~${avgMs}s avg` : ""}</span>
                        </div>
                      );
                    })}
                    {data.agentBreakdown.length === 0 && <div style={{ color: TEXT_DIM, fontSize: "0.75rem" }}>No agent data yet</div>}
                  </div>
                </Card>
              </div>
            )}

            {/* ── Agent Breakdown tab ───────────────────────────────────────── */}
            {activeTab === "agents" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Card title="Token share by agent">
                  {data.agentBreakdown.length === 0 ? (
                    <div style={{ color: TEXT_DIM, fontSize: "0.75rem", textAlign: "center", padding: "2rem" }}>No agent data yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={data.agentBreakdown} dataKey="tokens" nameKey="id" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3}>
                          {data.agentBreakdown.map(entry => (
                            <Cell key={entry.id} fill={AGENT_COLORS[entry.id] || "#888"} />
                          ))}
                        </Pie>
                        <Legend formatter={(v) => AGENT_LABELS[v] || v} wrapperStyle={{ fontSize: "0.65rem" }} />
                        <Tooltip formatter={(v: number) => [`${(v/1000).toFixed(1)}k tokens`, ""]} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card title="Queries & cost per agent">
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", paddingTop: "0.25rem" }}>
                    {data.agentBreakdown.map(agent => {
                      const q = data.agentQueries[agent.id];
                      return (
                        <div key={agent.id} style={{ background: "#0d0b08", border: `1px solid ${BORDER}`, borderRadius: "3px", padding: "0.65rem 0.85rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                            <span style={{ fontSize: "0.7rem", color: TEXT }}>{AGENT_LABELS[agent.id] || agent.id}</span>
                            <span style={{ fontSize: "0.65rem", color: GOLD, fontFamily: "'DM Mono', monospace" }}>${agent.cost.toFixed(5)}</span>
                          </div>
                          <div style={{ display: "flex", gap: "1rem" }}>
                            <span style={{ fontSize: "0.58rem", color: TEXT_DIM }}>{q?.count || 0} queries</span>
                            <span style={{ fontSize: "0.58rem", color: TEXT_DIM }}>{(agent.tokens / 1000).toFixed(1)}k tokens</span>
                            <span style={{ fontSize: "0.58rem", color: TEXT_DIM }}>{agent.pct}% of total</span>
                          </div>
                          <div style={{ marginTop: "0.4rem", height: "2px", background: "#1a1610", borderRadius: "1px", overflow: "hidden" }}>
                            <div style={{ width: `${agent.pct}%`, height: "100%", background: AGENT_COLORS[agent.id] || "#888", borderRadius: "1px" }} />
                          </div>
                        </div>
                      );
                    })}
                    {data.agentBreakdown.length === 0 && <div style={{ color: TEXT_DIM, fontSize: "0.75rem" }}>Ask some questions first to see agent data</div>}
                  </div>
                </Card>

                <Card title="Queries per agent — bar chart" span={2}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={data.agentBreakdown.map(a => ({
                        name: AGENT_LABELS[a.id]?.replace(/^[^\s]+ /, "") || a.id,
                        queries: data.agentQueries[a.id]?.count || 0,
                        tokens: Math.round(a.tokens / 1000),
                        color: AGENT_COLORS[a.id],
                      }))}
                      margin={{ top: 5, right: 10, bottom: 20, left: 10 }}
                    >
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: TEXT_DIM }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: TEXT_DIM }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="queries" name="Queries" radius={[3, 3, 0, 0]}>
                        {data.agentBreakdown.map(a => (
                          <Cell key={a.id} fill={AGENT_COLORS[a.id] || "#888"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* ── Prompt Inspector tab ──────────────────────────────────────── */}
            {activeTab === "prompts" && (
              <div style={{ display: "grid", gridTemplateColumns: selectedPrompt ? "1fr 1fr" : "1fr", gap: "1rem" }}>
                <Card title={`Recent queries — ${data.promptLog.length} logged`}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "600px", overflowY: "auto" }}>
                    {data.promptLog.length === 0 ? (
                      <div style={{ color: TEXT_DIM, fontSize: "0.75rem", padding: "1rem 0" }}>
                        No prompt data yet. Queries after this update will be logged here.
                      </div>
                    ) : data.promptLog.map((entry, i) => (
                      <button key={i} onClick={() => setSelectedPrompt(selectedPrompt === entry ? null : entry)}
                        style={{
                          background: selectedPrompt === entry ? "rgba(200,169,110,0.06)" : "transparent",
                          border: `1px solid ${selectedPrompt === entry ? GOLD_DIM : BORDER}`,
                          borderRadius: "3px",
                          padding: "0.6rem 0.75rem",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.15s",
                        }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                          <span style={{ fontSize: "0.62rem", color: AGENT_COLORS[entry.agent_id] || TEXT_DIM }}>{AGENT_LABELS[entry.agent_id] || entry.agent_id}</span>
                          <span style={{ fontSize: "0.55rem", color: TEXT_FAINT, fontFamily: "'DM Mono', monospace" }}>
                            {entry.tokens_used > 0 ? `${(entry.tokens_used / 1000).toFixed(1)}k tok` : ""}
                            {entry.response_time_ms > 0 ? ` · ${(entry.response_time_ms / 1000).toFixed(1)}s` : ""}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.7rem", color: TEXT, lineHeight: 1.4 }}>{entry.query}</div>
                        <div style={{ fontSize: "0.55rem", color: TEXT_FAINT, marginTop: "0.2rem" }}>
                          {new Date(entry.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {entry.sources_used?.length > 0 ? ` · ${entry.sources_used.length} sources` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>

                {selectedPrompt && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <Card title="Query details">
                      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                        {[
                          ["Agent", AGENT_LABELS[selectedPrompt.agent_id] || selectedPrompt.agent_id],
                          ["Tokens", selectedPrompt.tokens_used > 0 ? `~${selectedPrompt.tokens_used.toLocaleString()}` : "—"],
                          ["Response time", selectedPrompt.response_time_ms > 0 ? `${(selectedPrompt.response_time_ms / 1000).toFixed(1)}s` : "—"],
                          ["Cost (est.)", selectedPrompt.tokens_used > 0 ? `$${(selectedPrompt.tokens_used * 0.00000069).toFixed(6)}` : "—"],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <div style={{ fontSize: "0.52rem", color: TEXT_FAINT, letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</div>
                            <div style={{ fontSize: "0.7rem", color: GOLD, fontFamily: "'DM Mono', monospace" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Query</div>
                      <div style={{ fontSize: "0.75rem", color: TEXT, background: "#0d0b08", border: `1px solid ${BORDER}`, borderRadius: "3px", padding: "0.6rem 0.75rem", lineHeight: 1.6 }}>
                        {selectedPrompt.query}
                      </div>
                    </Card>

                    {selectedPrompt.sources_used?.length > 0 && (
                      <Card title={`Sources searched — ${selectedPrompt.sources_used.length}`}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                          {selectedPrompt.sources_used.map((s, i) => (
                            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                              style={{ display: "block", fontSize: "0.65rem", color: TEXT_DIM, textDecoration: "none", padding: "0.4rem 0.5rem", background: "#0d0b08", border: `1px solid ${BORDER}`, borderRadius: "2px", lineHeight: 1.4 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GOLD_DIM; (e.currentTarget as HTMLElement).style.color = TEXT; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.color = TEXT_DIM; }}>
                              <div style={{ color: TEXT, marginBottom: "0.1rem" }}>{s.title}</div>
                              <div style={{ fontSize: "0.55rem", color: TEXT_FAINT }}>{s.url}</div>
                            </a>
                          ))}
                        </div>
                      </Card>
                    )}

                    {selectedPrompt.prompt_sent && (
                      <Card title="System prompt sent to Groq">
                        <div style={{ fontSize: "0.62rem", color: TEXT_DIM, background: "#0d0b08", border: `1px solid ${BORDER}`, borderRadius: "3px", padding: "0.75rem", maxHeight: "300px", overflowY: "auto", lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "'DM Mono', monospace" }}>
                          {selectedPrompt.prompt_sent}
                        </div>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Recipe Analytics tab ──────────────────────────────────────── */}
            {activeTab === "recipes" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Card title="Film simulations in saved recipes">
                  {data.filmSimBreakdown.length === 0 ? (
                    <div style={{ color: TEXT_DIM, fontSize: "0.75rem", textAlign: "center", padding: "2rem" }}>
                      No saved recipes yet. Star a recipe to save it!
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={data.filmSimBreakdown} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 10 }}>
                        <XAxis type="number" tick={{ fontSize: 10, fill: TEXT_DIM }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: TEXT }} axisLine={false} tickLine={false} width={100} />
                        <Tooltip />
                        <Bar dataKey="count" name="Recipes" fill={GOLD} radius={[0, 3, 3, 0]} opacity={0.8} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card title="Saved recipe moods">
                  {data.moodBreakdown.length === 0 ? (
                    <div style={{ color: TEXT_DIM, fontSize: "0.75rem", textAlign: "center", padding: "2rem" }}>No mood data yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={data.moodBreakdown} dataKey="count" nameKey="mood" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={3}>
                          {data.moodBreakdown.map((_, i) => (
                            <Cell key={i} fill={[GOLD, "#7eb8d4", "#7ed4a0", "#d4a07e", "#b07ed4", "#d4d07e"][i % 6]} />
                          ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: "0.65rem" }} />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card title="Recipe summary" span={2}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                    <StatPill label="Total saved" value={String(data.totalRecipes)} />
                    <StatPill label="Unique film sims" value={String(data.filmSimBreakdown.length)} />
                    <StatPill label="Unique moods" value={String(data.moodBreakdown.length)} />
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
