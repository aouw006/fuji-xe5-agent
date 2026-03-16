"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import Icon from "@/components/Icon";
import NavBar from "@/components/NavBar";

import { darkTheme, lightTheme } from "@/lib/theme";

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
  film_recipes:    "Film Recipes",
  camera_settings: "Settings",
  locations:       "Locations",
  gear:            "Gear",
  comparison:      "Comparison",
  community:       "Community",
  unknown:         "Unknown",
};

interface SearchStats {
  searches: number;
  scrapes: number;
  total: number;
  limit: number;
  remaining: number;
  pct: number;
  usageByDay: { date: string; count: number }[];
  usageByAgent: { agent_id: string; count: number }[];
  usageByProvider: { provider: string; count: number }[];
  activeProvider: string;
}

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
    agent_steps: { step: number; tool: string; input: string; reasoning: string; result_summary: string }[];
    reflection_score?: number;
    reflection_critique?: string;
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
  searchStats: SearchStats;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Card({ title, children, span = 1, t }: { title: string; children: React.ReactNode; span?: number; t: typeof darkTheme }) {
  return (
    <div style={{
      background: t.bgCard,
      border: `1px solid ${t.border}`,
      borderRadius: "4px",
      padding: "1.25rem",
      gridColumn: `span ${span}`,
      minWidth: 0,
      overflow: "hidden",
    }}>
      <div style={{ fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: t.textFaint, marginBottom: "1rem" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function StatPill({ label, value, sub, t }: { label: string; value: string; sub?: string; t: typeof darkTheme }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: t.gold, fontFamily: "DM Mono, monospace" }}>{value}</div>
      <div style={{ fontSize: "0.62rem", color: t.textMuted, marginTop: "0.2rem" }}>{label}</div>
      {sub && <div style={{ fontSize: "0.55rem", color: t.textVeryFaint, marginTop: "0.1rem" }}>{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label, t }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string; t?: typeof darkTheme }) {
  if (!active || !payload?.length || !t) return null;
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "3px", padding: "0.5rem 0.75rem", fontSize: "0.7rem" }}>
      <div style={{ color: t.textMuted, marginBottom: "0.25rem" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: t.gold }}>
          {p.name === "cost" ? `$${p.value.toFixed(5)}` : p.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [isDark, setIsDark] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<DashboardData["promptLog"][0] | null>(null);
  const [activeTab, setActiveTab] = useState<"cost" | "agents" | "prompts" | "recipes" | "search">("cost");

  useEffect(() => {
    const saved = localStorage.getItem("xe5_theme");
    setIsDark(saved !== "light");
    const handler = (e: StorageEvent) => { if (e.key === "xe5_theme") setIsDark(e.newValue !== "light"); };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const t = isDark ? darkTheme : lightTheme;

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("xe5_theme", next ? "dark" : "light");
  };
  const budgetPct = data ? Math.min((data.monthCost / data.budgetUsd) * 100, 100) : 0;
  const budgetColor = budgetPct > 90 ? "#e05555" : budgetPct > 70 ? "#e0a855" : "#4caf7d";

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "DM Sans, sans-serif" }}>
      {/* Grain overlay */}
      <div className="grain-overlay" />

      <NavBar current="dashboard" isDark={isDark} onToggleTheme={toggleTheme} pageTitle="Dashboard" pageSubtitle="X-E5 Research Agent · Analytics" />

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem", position: "relative", zIndex: 1 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: t.textMuted, fontSize: "0.8rem" }}>
            <div style={{ marginBottom: "0.75rem", color: "#c8a96e" }}><Icon name="loader" size={28} /></div>
            Loading dashboard data...
          </div>
        ) : !data ? (
          <div style={{ textAlign: "center", padding: "4rem", color: t.textMuted }}>
            <div style={{ marginBottom: "0.75rem", color: "#c8a96e" }}><Icon name="warning" size={28} /></div>
            <div style={{ fontSize: "0.8rem" }}>Could not load dashboard. Check Supabase connection.</div>
          </div>
        ) : (
          <>
            {/* ── Summary row ─────────────────────────────────────────────── */}
            <div className="dash-stats" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
              {[
                { label: "Month Cost", value: `$${data.monthCost.toFixed(4)}`, sub: `of $${data.budgetUsd.toFixed(2)} budget` },
                { label: "Budget Used", value: `${budgetPct.toFixed(1)}%`, sub: `$${(data.budgetUsd - data.monthCost).toFixed(4)} remaining` },
                { label: "Total Queries", value: String(data.totalQueries), sub: "this month" },
                { label: "Tokens Used", value: data.monthTokens > 1000 ? `${(data.monthTokens / 1000).toFixed(1)}k` : String(data.monthTokens), sub: "estimated" },
                { label: "Saved Recipes", value: String(data.totalRecipes), sub: "all time" },
              ].map((s, i) => (
                <div key={i} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "4px", padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: i === 1 ? budgetColor : t.gold, fontFamily: "DM Mono, monospace" }}>{s.value}</div>
                  <div style={{ fontSize: "0.6rem", color: t.textMuted, marginTop: "0.2rem" }}>{s.label}</div>
                  {s.sub && <div style={{ fontSize: "0.52rem", color: t.textVeryFaint, marginTop: "0.15rem" }}>{s.sub}</div>}
                </div>
              ))}
            </div>

            {/* Budget bar */}
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "4px", padding: "0.75rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "0.6rem", color: t.textMuted, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>MONTHLY BUDGET</span>
              <div style={{ flex: 1, height: "4px", background: t.border, borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ width: `${budgetPct}%`, height: "100%", background: budgetColor, borderRadius: "2px", transition: "width 0.6s ease" }} />
              </div>
              <span style={{ fontSize: "0.65rem", color: budgetColor, fontFamily: "DM Mono, monospace", whiteSpace: "nowrap" }}>
                ${data.monthCost.toFixed(4)} / ${data.budgetUsd.toFixed(2)}
              </span>
            </div>

            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1rem", borderBottom: `1px solid ${t.border}`, paddingBottom: "0" }}>
              {(["cost", "agents", "prompts", "recipes", "search"] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === tab ? `2px solid ${t.gold}` : "2px solid transparent",
                  color: activeTab === tab ? t.gold : t.textMuted,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                  fontSize: "0.68rem",
                  letterSpacing: "0.06em",
                  transition: "all 0.2s",
                  marginBottom: "-1px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}>
                  <Icon name={tab === "cost" ? "cost" : tab === "agents" ? "agents" : tab === "prompts" ? "inspect" : tab === "search" ? "inspect" : "film"} size={12} />
                  {tab === "cost" ? "Cost" : tab === "agents" ? "Agents" : tab === "prompts" ? "Prompts" : tab === "search" ? "Search" : "Recipes"}
                </button>
              ))}
            </div>

            {/* ── Cost & Usage tab ─────────────────────────────────────────── */}
            {activeTab === "cost" && (
              <div className="dash-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Card t={t} title="Daily Cost (USD) — last 30 days" span={2}>
                  {data.costByDay.length === 0 ? (
                    <div style={{ color: t.textMuted, fontSize: "0.75rem", textAlign: "center", padding: "2rem" }}>No data yet — start asking questions!</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={data.costByDay} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textMuted }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: t.textMuted }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toFixed(4)}`} width={60} />
                        <Tooltip content={<CustomTooltip t={t} />} />
                        <Line type="monotone" dataKey="cost" name="cost" stroke={t.gold} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: t.gold }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card t={t} title="Daily Token Volume — last 30 days">
                  {data.costByDay.length === 0 ? (
                    <div style={{ color: t.textMuted, fontSize: "0.75rem", textAlign: "center", padding: "2rem" }}>No data yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data.costByDay} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textMuted }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: t.textMuted }} axisLine={false} tickLine={false} tickFormatter={v => v > 1000 ? `${(v/1000).toFixed(0)}k` : v} width={40} />
                        <Tooltip content={<CustomTooltip t={t} />} />
                        <Bar dataKey="tokens" name="tokens" fill={t.gold} opacity={0.7} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card t={t} title="Cost per Query (avg)">
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingTop: "0.5rem" }}>
                    {data.agentBreakdown.map(agent => {
                      const q = data.agentQueries[agent.id];
                      const avgCost = q?.count > 0 ? agent.cost / q.count : 0;
                      const avgMs = q?.count > 0 ? Math.round(q.totalMs / q.count / 1000) : 0;
                      return (
                        <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span style={{ fontSize: "0.65rem", color: t.textMuted, width: "120px", flexShrink: 0 }}>{AGENT_LABELS[agent.id] || agent.id}</span>
                          <span style={{ fontSize: "0.65rem", color: t.gold, fontFamily: "DM Mono, monospace", width: "70px" }}>${avgCost.toFixed(5)}</span>
                          <span style={{ fontSize: "0.6rem", color: t.textVeryFaint, fontFamily: "DM Mono, monospace" }}>{avgMs > 0 ? `~${avgMs}s avg` : ""}</span>
                        </div>
                      );
                    })}
                    {data.agentBreakdown.length === 0 && <div style={{ color: t.textMuted, fontSize: "0.75rem" }}>No agent data yet</div>}
                  </div>
                </Card>
              </div>
            )}

            {/* ── Agent Breakdown tab ───────────────────────────────────────── */}
            {activeTab === "agents" && (
              <div className="dash-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Card t={t} title="Token share by agent">
                  {data.agentBreakdown.length === 0 ? (
                    <div style={{ color: t.textMuted, fontSize: "0.75rem", textAlign: "center", padding: "2rem" }}>No agent data yet</div>
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

                <Card t={t} title="Queries & cost per agent">
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", paddingTop: "0.25rem" }}>
                    {data.agentBreakdown.map(agent => {
                      const q = data.agentQueries[agent.id];
                      return (
                        <div key={agent.id} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: "3px", padding: "0.65rem 0.85rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                            <span style={{ fontSize: "0.7rem", color: t.text }}>{AGENT_LABELS[agent.id] || agent.id}</span>
                            <span style={{ fontSize: "0.65rem", color: t.gold, fontFamily: "DM Mono, monospace" }}>${agent.cost.toFixed(5)}</span>
                          </div>
                          <div style={{ display: "flex", gap: "1rem" }}>
                            <span style={{ fontSize: "0.58rem", color: t.textMuted }}>{q?.count || 0} queries</span>
                            <span style={{ fontSize: "0.58rem", color: t.textMuted }}>{(agent.tokens / 1000).toFixed(1)}k tokens</span>
                            <span style={{ fontSize: "0.58rem", color: t.textMuted }}>{agent.pct}% of total</span>
                          </div>
                          <div style={{ marginTop: "0.4rem", height: "2px", background: t.border, borderRadius: "1px", overflow: "hidden" }}>
                            <div style={{ width: `${agent.pct}%`, height: "100%", background: AGENT_COLORS[agent.id] || "#888", borderRadius: "1px" }} />
                          </div>
                        </div>
                      );
                    })}
                    {data.agentBreakdown.length === 0 && <div style={{ color: t.textMuted, fontSize: "0.75rem" }}>Ask some questions first to see agent data</div>}
                  </div>
                </Card>

                <Card t={t} title="Queries per agent — bar chart" span={2}>
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
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: t.textMuted }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: t.textMuted }} axisLine={false} tickLine={false} />
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
              <div className="dash-grid" style={{ display: "grid", gridTemplateColumns: selectedPrompt ? "1fr 1fr" : "1fr", gap: "1rem" }}>
                <Card t={t} title={`Recent queries — ${data.promptLog.length} logged`}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "600px", overflowY: "auto" }}>
                    {data.promptLog.length === 0 ? (
                      <div style={{ color: t.textMuted, fontSize: "0.75rem", padding: "1rem 0" }}>
                        No prompt data yet. Queries after this update will be logged here.
                      </div>
                    ) : data.promptLog.map((entry, i) => (
                      <button key={i} onClick={() => setSelectedPrompt(selectedPrompt === entry ? null : entry)}
                        style={{
                          background: selectedPrompt === entry ? t.goldBg : "transparent",
                          border: `1px solid ${selectedPrompt === entry ? t.textFaint : t.border}`,
                          borderRadius: "3px",
                          padding: "0.6rem 0.75rem",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.15s",
                        }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                          <span style={{ fontSize: "0.62rem", color: AGENT_COLORS[entry.agent_id] || t.textMuted }}>{AGENT_LABELS[entry.agent_id] || entry.agent_id}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            {entry.reflection_score !== undefined && (
                              <span style={{
                                fontSize: "0.5rem", padding: "0.05rem 0.3rem", borderRadius: "2px", fontFamily: "DM Mono, monospace",
                                background: entry.reflection_score >= 8 ? "rgba(100,180,100,0.1)" : entry.reflection_score >= 6 ? "rgba(200,169,110,0.1)" : "rgba(200,100,100,0.1)",
                                color: entry.reflection_score >= 8 ? "#7ec87e" : entry.reflection_score >= 6 ? t.gold : "#c87e7e",
                              }}>
                                {entry.reflection_score}/10
                              </span>
                            )}
                            <span style={{ fontSize: "0.55rem", color: t.textVeryFaint, fontFamily: "DM Mono, monospace" }}>
                              {entry.tokens_used > 0 ? `${(entry.tokens_used / 1000).toFixed(1)}k tok` : ""}
                              {entry.response_time_ms > 0 ? ` · ${(entry.response_time_ms / 1000).toFixed(1)}s` : ""}
                            </span>
                          </div>
                        </div>
                        <div style={{ fontSize: "0.7rem", color: t.text, lineHeight: 1.4 }}>{entry.query}</div>
                        <div style={{ fontSize: "0.55rem", color: t.textVeryFaint, marginTop: "0.2rem" }}>
                          {new Date(entry.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {entry.sources_used?.length > 0 ? ` · ${entry.sources_used.length} sources` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>

                {selectedPrompt && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <Card t={t} title="Query details">
                      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                        {[
                          ["Agent", AGENT_LABELS[selectedPrompt.agent_id] || selectedPrompt.agent_id],
                          ["Tokens", selectedPrompt.tokens_used > 0 ? `~${selectedPrompt.tokens_used.toLocaleString()}` : "—"],
                          ["Response time", selectedPrompt.response_time_ms > 0 ? `${(selectedPrompt.response_time_ms / 1000).toFixed(1)}s` : "—"],
                          ["Cost (est.)", selectedPrompt.tokens_used > 0 ? `$${(selectedPrompt.tokens_used * 0.00000069).toFixed(6)}` : "—"],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <div style={{ fontSize: "0.52rem", color: t.textVeryFaint, letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</div>
                            <div style={{ fontSize: "0.7rem", color: t.gold, fontFamily: "DM Mono, monospace" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: "0.6rem", color: t.textMuted, marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Query</div>
                      <div style={{ fontSize: "0.75rem", color: t.text, background: t.bg, border: `1px solid ${t.border}`, borderRadius: "3px", padding: "0.6rem 0.75rem", lineHeight: 1.6 }}>
                        {selectedPrompt.query}
                      </div>
                    </Card>

                    {selectedPrompt.sources_used?.length > 0 && (
                      <Card t={t} title={`Sources searched — ${selectedPrompt.sources_used.length}`}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                          {selectedPrompt.sources_used.map((s, i) => (
                            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                              style={{ display: "block", fontSize: "0.65rem", color: t.textMuted, textDecoration: "none", padding: "0.4rem 0.5rem", background: t.bg, border: `1px solid ${t.border}`, borderRadius: "2px", lineHeight: 1.4 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = t.textFaint; (e.currentTarget as HTMLElement).style.color = t.text; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = t.border; (e.currentTarget as HTMLElement).style.color = t.textMuted; }}>
                              <div style={{ color: t.text, marginBottom: "0.1rem" }}>{s.title}</div>
                              <div style={{ fontSize: "0.55rem", color: t.textVeryFaint }}>{s.url}</div>
                            </a>
                          ))}
                        </div>
                      </Card>
                    )}

                    {selectedPrompt.agent_id === "comparison" && (
                      <Card t={t} title={
                        selectedPrompt.agent_steps?.length > 0
                          ? `Agentic research log — ${selectedPrompt.agent_steps.length} steps`
                          : "Agentic research log — no steps recorded"
                      }>
                        {(!selectedPrompt.agent_steps || selectedPrompt.agent_steps.length === 0) ? (
                          <div style={{ fontSize: "0.68rem", color: t.textMuted, lineHeight: 1.6 }}>
                            No steps found for this query. This happens for queries run before the agentic log was added, or if the <code style={{ fontFamily: "DM Mono, monospace", background: t.bg, padding: "0.1rem 0.3rem", borderRadius: "2px" }}>agent_steps</code> column is missing from Supabase.
                            <br /><br />
                            Run in Supabase SQL editor:<br />
                            <code style={{ fontFamily: "DM Mono, monospace", fontSize: "0.6rem", background: t.bg, padding: "0.4rem 0.6rem", borderRadius: "3px", display: "block", marginTop: "0.4rem", border: `1px solid ${t.border}` }}>
                              ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_steps jsonb;
                            </code>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                            {selectedPrompt.agent_steps.map((s, i) => (
                              <div key={i} style={{ display: "flex", gap: "0.75rem", padding: "0.75rem 0", borderBottom: i < selectedPrompt.agent_steps.length - 1 ? `1px solid ${t.border}` : "none" }}>
                                <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: `1px solid ${isDark ? "rgba(200,169,110,0.3)" : "rgba(176,136,64,0.4)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem", color: t.gold, flexShrink: 0, fontFamily: "DM Mono, monospace", marginTop: "0.1rem" }}>
                                  {s.step}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  {/* Tool badge + query */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                                    <span style={{ fontSize: "0.52rem", color: t.gold, border: `1px solid ${isDark ? "rgba(200,169,110,0.2)" : "rgba(176,136,64,0.3)"}`, borderRadius: "2px", padding: "0.05rem 0.3rem", fontFamily: "DM Mono, monospace", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
                                      {s.tool.replace(/_/g, " ")}
                                    </span>
                                    <span style={{ fontSize: "0.68rem", color: t.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {s.input}
                                    </span>
                                  </div>
                                  {/* Reasoning */}
                                  {s.reasoning && (
                                    <div style={{ fontSize: "0.63rem", color: t.textMuted, lineHeight: 1.55, marginBottom: "0.3rem", fontStyle: "italic" }}>
                                      {s.reasoning}
                                    </div>
                                  )}
                                  {/* Result preview */}
                                  {s.result_summary && (
                                    <div style={{ fontSize: "0.6rem", color: t.textVeryFaint, lineHeight: 1.5, fontFamily: "DM Mono, monospace", paddingLeft: "0.5rem", borderLeft: `2px solid ${t.border}` }}>
                                      {s.result_summary}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    )}

                    {selectedPrompt.prompt_sent && (
                      <Card t={t} title="System prompt sent to Groq">
                        <div style={{ fontSize: "0.62rem", color: t.textMuted, background: t.bg, border: `1px solid ${t.border}`, borderRadius: "3px", padding: "0.75rem", maxHeight: "300px", overflowY: "auto", lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "DM Mono, monospace" }}>
                          {selectedPrompt.prompt_sent}
                        </div>
                      </Card>
                    )}

                    {selectedPrompt.reflection_score !== undefined && (
                      <Card t={t} title="Reflection — self-critique">
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
                          <div style={{
                            fontSize: "2rem", fontWeight: 700, fontFamily: "Playfair Display, serif",
                            color: selectedPrompt.reflection_score >= 8 ? "#7ec87e" : selectedPrompt.reflection_score >= 6 ? t.gold : "#c87e7e",
                          }}>
                            {selectedPrompt.reflection_score}<span style={{ fontSize: "0.9rem", color: t.textFaint }}>/10</span>
                          </div>
                          <div style={{ fontSize: "0.68rem", color: t.textMuted, lineHeight: 1.6, flex: 1 }}>
                            {selectedPrompt.reflection_critique}
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Recipe Analytics tab ──────────────────────────────────────── */}
            {activeTab === "recipes" && (
              <div className="dash-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Card t={t} title="Film simulations in saved recipes">
                  {data.filmSimBreakdown.length === 0 ? (
                    <div style={{ color: t.textMuted, fontSize: "0.75rem", textAlign: "center", padding: "2rem" }}>
                      No saved recipes yet. Star a recipe to save it!
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={data.filmSimBreakdown} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 10 }}>
                        <XAxis type="number" tick={{ fontSize: 10, fill: t.textMuted }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: t.text }} axisLine={false} tickLine={false} width={100} />
                        <Tooltip />
                        <Bar dataKey="count" name="Recipes" fill={t.gold} radius={[0, 3, 3, 0]} opacity={0.8} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card t={t} title="Saved recipe moods">
                  {data.moodBreakdown.length === 0 ? (
                    <div style={{ color: t.textMuted, fontSize: "0.75rem", textAlign: "center", padding: "2rem" }}>No mood data yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={data.moodBreakdown} dataKey="count" nameKey="mood" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={3}>
                          {data.moodBreakdown.map((_, i) => (
                            <Cell key={i} fill={[t.gold, "#7eb8d4", "#7ed4a0", "#d4a07e", "#b07ed4", "#d4d07e"][i % 6]} />
                          ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: "0.65rem" }} />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card t={t} title="Recipe summary" span={2}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                    <StatPill t={t} label="Total saved" value={String(data.totalRecipes)} />
                    <StatPill t={t} label="Unique film sims" value={String(data.filmSimBreakdown.length)} />
                    <StatPill t={t} label="Unique moods" value={String(data.moodBreakdown.length)} />
                  </div>
                </Card>
              </div>
            )}

            {/* ── Search Credits tab ────────────────────────────────────────── */}
            {activeTab === "search" && (() => {
              const ss = data.searchStats;
              const gaugeColor = ss.pct > 90 ? "#e05555" : ss.pct > 70 ? "#e0a855" : "#4caf7d";

              return (
                <div className="dash-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

                  {/* Status */}
                  <Card t={t} title="Active provider">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{
                        fontSize: "1.4rem", fontWeight: 700, fontFamily: "DM Mono, monospace",
                        color: ss.activeProvider === "none" ? t.textMuted : t.gold,
                        textTransform: "uppercase",
                      }}>
                        {ss.activeProvider}
                      </div>
                      <div style={{ fontSize: "0.62rem", color: t.textVeryFaint, lineHeight: 1.6 }}>
                        {ss.activeProvider === "tavily" && "Live search via Tavily"}
                        {ss.activeProvider === "serper" && "Live search via Google (Serper)"}
                        {ss.activeProvider === "none" && "KB only — no live search"}
                        <br />Change in Settings ⚙
                      </div>
                    </div>
                  </Card>

                  {/* Summary */}
                  <Card t={t} title="This month">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                      <StatPill t={t} label="Searches" value={String(ss.searches)} />
                      <StatPill t={t} label="Page reads" value={String(ss.scrapes)} />
                      {ss.activeProvider === "tavily"
                        ? <StatPill t={t} label="Remaining" value={String(ss.remaining)} sub={`of ${ss.limit}`} />
                        : ss.activeProvider === "serper"
                        ? <StatPill t={t} label="Est. cost" value={`$${(ss.total * 0.001).toFixed(2)}`} sub="@$1/1k" />
                        : <StatPill t={t} label="Provider" value="None" sub="KB only" />
                      }
                    </div>
                  </Card>

                  {/* Provider gauge — Tavily */}
                  {ss.activeProvider === "tavily" && (
                    <Card t={t} title="Tavily — monthly credit usage" span={2}>
                      <div style={{ marginBottom: "0.5rem", display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.65rem", color: t.textMuted }}>
                          {ss.total} used · {ss.remaining} remaining · resets 1st of month
                        </span>
                        <span style={{ fontSize: "0.65rem", color: gaugeColor, fontFamily: "DM Mono, monospace", fontWeight: 600 }}>
                          {ss.total} / {ss.limit}
                        </span>
                      </div>
                      <div style={{ height: "8px", background: t.bgCard, borderRadius: "4px", border: `1px solid ${t.border}`, marginBottom: "0.5rem" }}>
                        <div style={{ height: "100%", width: `${ss.pct}%`, background: gaugeColor, borderRadius: "4px", transition: "width 0.5s ease" }} />
                      </div>
                      {ss.pct > 80 && (
                        <div style={{ fontSize: "0.62rem", color: "#e0a855", lineHeight: 1.5 }}>
                          ⚠ Running low — switch to Serper or None in Settings to preserve remaining credits.
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Provider gauge — Serper */}
                  {ss.activeProvider === "serper" && (
                    <Card t={t} title="Serper — usage this month" span={2}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                        <StatPill t={t} label="Total calls" value={String(ss.total)} />
                        <StatPill t={t} label="Est. cost" value={`$${(ss.total * 0.001).toFixed(3)}`} />
                        <StatPill t={t} label="Rate" value="$1 / 1k" sub="queries" />
                      </div>
                      <div style={{ fontSize: "0.62rem", color: t.textVeryFaint, lineHeight: 1.6 }}>
                        Serper charges per query. $50 credit = 50,000 queries.
                      </div>
                    </Card>
                  )}

                  {/* By provider breakdown — shown when both have been used */}
                  {ss.usageByProvider.length > 1 && (
                    <Card t={t} title="Usage by provider — this month" span={2}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {ss.usageByProvider.map(p => {
                          const total = ss.usageByProvider.reduce((s, x) => s + x.count, 0);
                          const pct = total > 0 ? (p.count / total) * 100 : 0;
                          return (
                            <div key={p.provider}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                                <span style={{ fontSize: "0.65rem", color: t.text, textTransform: "uppercase", fontFamily: "DM Mono, monospace" }}>{p.provider}</span>
                                <span style={{ fontSize: "0.65rem", color: t.gold, fontFamily: "DM Mono, monospace" }}>{p.count} ({pct.toFixed(0)}%)</span>
                              </div>
                              <div style={{ height: "4px", background: t.bgCard, borderRadius: "2px", border: `1px solid ${t.border}` }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: t.gold, borderRadius: "2px", opacity: 0.7 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}

                  {/* Daily chart */}
                  <Card t={t} title="Daily usage — this month" span={2}>
                    {ss.usageByDay.length === 0 ? (
                      <div style={{ color: t.textMuted, fontSize: "0.75rem", textAlign: "center", padding: "2rem" }}>
                        No search data yet this month.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={ss.usageByDay} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: t.textMuted }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: t.textMuted }} axisLine={false} tickLine={false} width={24} />
                          <Tooltip content={<CustomTooltip t={t} />} />
                          <Bar dataKey="count" name="Searches" fill={t.gold} opacity={0.8} radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Card>

                  {/* By agent */}
                  <Card t={t} title="Searches by agent — this month" span={2}>
                    {ss.usageByAgent.length === 0 ? (
                      <div style={{ color: t.textMuted, fontSize: "0.75rem", textAlign: "center", padding: "1rem" }}>No data yet.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {ss.usageByAgent.map(a => {
                          const total = ss.usageByAgent.reduce((s, x) => s + x.count, 0);
                          const pct = total > 0 ? Math.round((a.count / total) * 100) : 0;
                          const color = AGENT_COLORS[a.agent_id] || AGENT_COLORS.unknown;
                          return (
                            <div key={a.agent_id}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                                <span style={{ fontSize: "0.65rem", color: t.text }}>{AGENT_LABELS[a.agent_id] || a.agent_id}</span>
                                <span style={{ fontSize: "0.65rem", color: t.textMuted, fontFamily: "DM Mono, monospace" }}>{a.count} ({pct}%)</span>
                              </div>
                              <div style={{ height: "4px", background: t.bgCard, borderRadius: "2px", border: `1px solid ${t.border}` }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "2px", opacity: 0.8 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>

                </div>
              );
            })()}
          </>
        )}
      </main>
    </div>
  );
}
