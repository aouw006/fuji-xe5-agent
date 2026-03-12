"use client";
import Link from "next/link";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

const APP_VERSION = "v5.0";

import { useState, useRef, useEffect, useCallback } from "react";
import MessageRenderer from "@/components/MessageRenderer";
import HistorySidebar from "@/components/HistorySidebar";
import TokenBar from "@/components/TokenBar";
import RecipeCard from "@/components/RecipeCard";
import { parseRecipeFromText, ParsedRecipe } from "@/lib/recipeParser";
import { darkTheme, lightTheme, Theme } from "@/lib/theme";
import AboutModal from "@/components/AboutModal";
import SettingsModal from "@/components/SettingsModal";
import ShotOfTheDay from "@/components/ShotOfTheDay";
import RecipeComparison from "@/components/RecipeComparison";

interface Source { title: string; url: string; }
interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  agentName?: string;
  agentIcon?: string;
  recipe?: ParsedRecipe;
  followups?: string[];
}
interface HistoryEntry { role: "user" | "assistant"; content: string; }

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Film Recipes": (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none"/>
      <line x1="11" y1="4" x2="11" y2="20"/>
      <line x1="13" y1="4" x2="13" y2="20"/>
    </svg>
  ),
  "Camera Settings": (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  "Iconic Locations": (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  "Gear & Lenses": (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="3" x2="12" y2="5"/>
      <line x1="12" y1="19" x2="12" y2="21"/>
      <line x1="3" y1="12" x2="5" y2="12"/>
      <line x1="19" y1="12" x2="21" y2="12"/>
    </svg>
  ),
  "Community Tips": (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  "What's New": (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  "Compare & Pick": (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="21"/>
      <path d="M3 9l4-4 4 4"/>
      <path d="M17 15l4 4-4 4" transform="translate(0,-4)"/>
      <line x1="7" y1="5" x2="7" y2="15"/>
      <line x1="17" y1="9" x2="17" y2="19"/>
    </svg>
  ),
};

const CATEGORIES = [
  { label: "Film Recipes", query: "best film simulation recipes for Fujifilm X-E5 with exact settings" },
  { label: "Camera Settings", query: "optimal camera settings custom menu and button setup for Fujifilm X-E5" },
  { label: "Iconic Locations", query: "iconic photography locations perfect for shooting with Fujifilm X-E5" },
  { label: "Gear & Lenses", query: "best XF lenses and accessories for Fujifilm X-E5" },
  { label: "Community Tips", query: "Fujifilm X-E5 hidden tips tricks community recommendations reddit" },
  { label: "What's New", query: "Fujifilm X-E5 latest news firmware update new recipes accessories 2025" },
  { label: "Compare & Pick", query: "compare best XF lenses for Fujifilm X-E5 which should I buy" },
];

const QUICK_PROMPTS = [
  "✦ What's new for X-E5?",
  "Eterna Cinema recipe for street",
  "Silent shutter settings",
  "Best 23mm vs 35mm for X-E5",
  "Kyoto photo locations",
  "AF tracking settings for X-E5",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [streamingSources, setStreamingSources] = useState<Source[]>([]);
  const [streamingAgent, setStreamingAgent] = useState<{ name: string; icon: string } | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);

  useEffect(() => {
    const saved = localStorage.getItem("xe5_fontsize");
    if (saved) setFontSize(Number(saved));
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
    localStorage.setItem("xe5_fontsize", String(fontSize));
  }, [fontSize]);
  const [isDark, setIsDark] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const t: Theme = isDark ? darkTheme : lightTheme;

  useEffect(() => {
    const stored = localStorage.getItem("xe5_session_id");
    if (stored) {
      setSessionId(stored);
    } else {
      const newId = `xe5_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem("xe5_session_id", newId);
      setSessionId(newId);
    }
    const savedMode = localStorage.getItem("xe5_theme");
    if (savedMode === "light") setIsDark(false);
  }, []);

  useEffect(() => {
    document.body.style.background = t.bg;
    document.body.style.color = t.text;
  }, [isDark]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("xe5_theme", next ? "dark" : "light");
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, statusLog]);

  const handleQuery = useCallback(async (query: string) => {
    if (!query.trim() || loading) return;
    setStarted(true);
    setLoading(true);
    setStreaming("");
    setStreamingSources([]);
    setStreamingAgent(null);
    setStatusLog([]);
    setInput("");

    setMessages((prev) => [...prev, { role: "user", content: query }]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query, history, sessionId }),
      });

      if (!res.ok) throw new Error(await res.text());

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let sources: Source[] = [];
      let agentInfo: { name: string; icon: string } | null = null;
      let pendingFollowups: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "agent") {
              agentInfo = { name: data.agentName, icon: data.agentIcon };
              setStreamingAgent(agentInfo);
            } else if (data.type === "status") {
              setStatusLog((prev) => [...prev, data.text]);
            } else if (data.type === "sources") {
              sources = data.sources;
              setStreamingSources(sources);
            } else if (data.type === "text") {
              fullText += data.text;
              setStreaming(fullText);
            } else if (data.type === "followups") {
              pendingFollowups = data.suggestions || [];
            } else if (data.type === "done") {
              const detectedRecipe = parseRecipeFromText(fullText);
              setMessages((prev) => [...prev, {
                role: "assistant",
                content: fullText,
                sources,
                agentName: agentInfo?.name,
                agentIcon: agentInfo?.icon,
                recipe: detectedRecipe || undefined,
                followups: pendingFollowups.length > 0 ? pendingFollowups : undefined,
              }]);
              setHistory((prev) => [
                ...prev,
                { role: "user", content: query },
                { role: "assistant", content: fullText },
              ]);
              setStreaming("");
              setStreamingSources([]);
              setStreamingAgent(null);
              setStatusLog([]);
            } else if (data.type === "error") {
              setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${data.text}`, sources: [] }]);
              setLoading(false);
            }
          } catch (e) {
            // skip malformed SSE
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ Error: ${msg}`, sources: [] }]);
    }

    setLoading(false);
  }, [loading, history, sessionId]);

  const loadSession = (newSessionId: string, msgs: { role: string; content: string }[]) => {
    const restored = msgs.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      sources: [],
    }));
    setMessages(restored);
    setHistory(msgs.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
    localStorage.setItem("xe5_session_id", newSessionId);
    setStarted(restored.length > 0);
  };

  const reset = () => {
    setMessages([]);
    setHistory([]);
    setStarted(false);
    setInput("");
    setStreaming("");
    setStatusLog([]);
    setStreamingAgent(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("xe5_session_id");
      window.location.reload();
    }
  };

  const headerBtn = {
    background: "transparent",
    border: `1px solid ${t.border}`,
    color: t.textFaint,
    width: "30px",
    height: "30px",
    borderRadius: "2px",
    cursor: "pointer",
    fontSize: "0.85rem",
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    transition: "all 0.2s",
    flexShrink: 0 as const,
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: t.bg, color: t.text, transition: "background 0.3s, color 0.3s" }}>
      {/* Grain overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`, backgroundSize: "256px", opacity: t.grain }} />
      <div style={{ position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)", width: "700px", height: "500px", background: `radial-gradient(ellipse, ${t.gradientTop} 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

      <HistorySidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onLoadSession={loadSession} currentSessionId={sessionId} isDark={isDark} onCompare={() => setCompareOpen(true)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} isDark={isDark} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} isDark={isDark} fontSize={fontSize} onFontSizeChange={setFontSize} />
      <RecipeComparison open={compareOpen} onClose={() => setCompareOpen(false)} isDark={isDark} />

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, borderBottom: `1px solid ${t.border}`, background: t.bgHeader, backdropFilter: "blur(16px)", padding: "0.6rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", transition: "background 0.3s, border-color 0.3s" }}>
        {/* Left: menu + logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flex: 1 }}>
          <button onClick={() => setSidebarOpen(true)} style={headerBtn} title="History"
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textFaint; }}>
            <Icon name="menu" size={14} />
          </button>
          <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: `1.5px solid ${t.gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.48rem", color: t.gold, background: t.goldBg, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>XE5</div>
          {/* Title — hidden on very small screens */}
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>X-E5 Agent</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#4caf7d", animation: "blink 2s ease-in-out infinite", flexShrink: 0 }} />
              <span style={{ fontSize: "0.5rem", color: t.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{APP_VERSION}</span>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
          {/* Token bar — hidden on mobile, shown md+ */}
          <div className="hide-mobile">
            <TokenBar />
          </div>
          <button onClick={toggleTheme} style={headerBtn} title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textFaint; }}>
            <Icon name={isDark ? "sun" : "moon"} size={14} />
          </button>
          <button onClick={() => setAboutOpen(true)} style={headerBtn} title="About"
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textFaint; }}>
            <Icon name="question" size={14} />
          </button>
          <Link href="/dashboard" style={{ ...headerBtn, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }} title="Dashboard"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = t.gold; (e.currentTarget as HTMLElement).style.color = t.gold; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = t.border; (e.currentTarget as HTMLElement).style.color = t.textFaint; }}>
            <Icon name="dashboard" size={13} />
          </Link>
          <button onClick={() => setSettingsOpen(true)} style={headerBtn} title="Settings"
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textFaint; }}>
            <Icon name="settings" size={14} />
          </button>
          {started && (
            <button onClick={reset}
              style={{ background: "transparent", border: `1px solid ${t.borderMid}`, color: t.textFaint, padding: "0.3rem 0.55rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s", whiteSpace: "nowrap" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.borderMid; e.currentTarget.style.color = t.textFaint; }}>
              <Icon name="reset" size={13} />
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: "860px", width: "100%", margin: "0 auto", padding: "0 1.25rem", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>

        {/* Welcome */}
        {!started && (
          <div style={{ padding: "2.5rem 0 2rem", textAlign: "center", animation: "fadeIn 0.5s ease" }}>
            <div style={{ fontSize: "0.62rem", letterSpacing: "0.3em", color: t.textVeryFaint, textTransform: "uppercase", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
              <span>6 Specialist Agents · Multi-round Search · Full Article Reading</span>
              <span style={{ border: `1px solid ${t.border}`, borderRadius: "2px", padding: "0.1rem 0.4rem", color: t.textFaint, fontSize: "0.55rem", letterSpacing: "0.1em" }}>{APP_VERSION}</span>
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 900, lineHeight: 1.05, color: t.text, margin: "0 0 0.75rem" }}>
              Fujifilm X-E5<br /><span style={{ color: t.gold, fontStyle: "italic" }}>Research Agent</span>
            </h1>
            <p style={{ color: t.textMuted, maxWidth: "460px", margin: "0 auto 2rem", lineHeight: 1.8, fontSize: "0.875rem" }}>
              Each question is routed to a specialist agent — film recipes, settings, locations, gear, comparisons, or community. It searches multiple rounds, reads full articles, and streams expert answers.
            </p>

            <ShotOfTheDay isDark={isDark} onPrompt={(p) => handleQuery(p)} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: "0.55rem", marginBottom: "1.5rem" }}>
              {CATEGORIES.map((cat) => (
                <button key={cat.label} onClick={() => handleQuery(cat.query)}
                  style={{ background: t.bgCategoryCard, border: `1px solid ${t.border}`, borderRadius: "4px", padding: "1.1rem 0.9rem", cursor: "pointer", textAlign: "left", transition: "all 0.2s", color: t.text }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.background = t.bgCategoryHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.bgCategoryCard; }}>
                  <div style={{ color: t.gold, marginBottom: "0.55rem", display: "flex" }}>{CATEGORY_ICONS[cat.label]}</div>
                  <div style={{ fontSize: "0.76rem", fontWeight: 500 }}>{cat.label}</div>
                  <div style={{ fontSize: "0.6rem", color: t.textFaint, marginTop: "0.2rem" }}>specialist agent</div>
                </button>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
              {["Detect agent", "Plan queries", "Multi-round search", "Scrape articles", "Stream answer"].map((s, i, arr) => (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ padding: "0.3rem 0.6rem", background: t.bgButton, border: `1px solid ${t.border}`, borderRadius: "2px", fontSize: "0.58rem", color: t.textVeryFaint, letterSpacing: "0.06em" }}>{s}</div>
                  {i < arr.length - 1 && <div style={{ color: t.border, fontSize: "0.65rem", padding: "0 0.15rem" }}>→</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, paddingTop: started ? "1.25rem" : 0 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn 0.3s ease" }}>
              <div style={{ fontSize: "0.56rem", letterSpacing: "0.2em", textTransform: "uppercase", color: t.textGhost, marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: "0.35rem", paddingLeft: msg.role === "assistant" ? "0.25rem" : 0, paddingRight: msg.role === "user" ? "0.25rem" : 0 }}>
                {msg.role === "assistant" && msg.agentIcon && <Icon name={msg.agentIcon as Parameters<typeof Icon>[0]["name"]} size={12} style={{ color: t.gold, marginRight: "0.15rem", verticalAlign: "middle" }} />}
                {msg.role === "user" ? "You" : msg.agentName || "XE5 Agent"}
              </div>
              <div style={{ maxWidth: msg.role === "user" ? "70%" : "100%", background: msg.role === "user" ? t.bgCardUser : t.bgCard, border: `1px solid ${msg.role === "user" ? (isDark ? "rgba(200,169,110,0.2)" : "rgba(176,136,64,0.25)") : t.borderCard}`, borderRadius: "4px", padding: "0.9rem 1.15rem", transition: "background 0.3s, border-color 0.3s" }}>
                {msg.role === "assistant" ? <MessageRenderer text={msg.content} /> : <span style={{ fontSize: "0.875rem", color: t.text }}>{msg.content}</span>}

                {msg.role === "assistant" && msg.recipe && (
                  <RecipeCard recipe={msg.recipe} sessionId={sessionId} />
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginTop: "1rem", paddingTop: "0.9rem", borderTop: `1px solid ${t.borderCard}` }}>
                    <div style={{ fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: t.textVeryFaint, marginBottom: "0.4rem" }}>Sources searched</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                      {msg.sources.map((s, si) => (
                        <a key={si} href={s.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: "0.6rem", color: t.textFaint, border: `1px solid ${t.borderCard}`, borderRadius: "2px", padding: "0.15rem 0.4rem", textDecoration: "none", transition: "all 0.15s", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = t.gold; e.currentTarget.style.borderColor = t.gold; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = t.textFaint; e.currentTarget.style.borderColor = t.borderCard; }}
                          title={s.title}>↗ {s.title || s.url}</a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Follow-up suggestions */}
              {msg.role === "assistant" && msg.followups && msg.followups.length > 0 && i === messages.length - 1 && (
                <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.4rem", paddingLeft: "0.25rem" }}>
                  <div style={{ width: "100%", fontSize: "0.52rem", color: t.textVeryFaint, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.1rem" }}>Follow-up</div>
                  {msg.followups.map((q, fi) => (
                    <button key={fi} onClick={() => handleQuery(q)}
                      style={{ background: t.bgButton, border: `1px solid ${isDark ? "rgba(200,169,110,0.12)" : "rgba(176,136,64,0.18)"}`, color: t.textMuted, padding: "0.3rem 0.7rem", borderRadius: "3px", cursor: "pointer", fontSize: "0.68rem", lineHeight: 1.4, textAlign: "left", transition: "all 0.2s", maxWidth: "320px" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isDark ? "rgba(200,169,110,0.12)" : "rgba(176,136,64,0.18)"; e.currentTarget.style.color = t.textMuted; }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Streaming */}
          {(loading || streaming) && (
            <div style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column", alignItems: "flex-start", animation: "fadeIn 0.3s ease" }}>
              <div style={{ fontSize: "0.56rem", letterSpacing: "0.2em", textTransform: "uppercase", color: t.textGhost, marginBottom: "0.35rem", paddingLeft: "0.25rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                {streamingAgent?.icon && <Icon name={streamingAgent.icon as Parameters<typeof Icon>[0]["name"]} size={12} style={{ color: t.gold, marginRight: "0.15rem", verticalAlign: "middle" }} />}
                {streamingAgent?.name || "XE5 Agent"}
              </div>
              <div style={{ width: "100%", background: t.bgCard, border: `1px solid ${t.borderCard}`, borderRadius: "4px", padding: "0.9rem 1.15rem", transition: "background 0.3s" }}>
                {statusLog.length > 0 && !streaming && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    {statusLog.map((s, i) => (
                      <div key={i} style={{ fontSize: "0.68rem", color: i === statusLog.length - 1 ? t.textMuted : t.textVeryFaint, lineHeight: 1.6, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span style={{ color: i === statusLog.length - 1 ? t.gold : t.textTiny }}><Icon name={i === statusLog.length - 1 ? "dotOutline" : "check"} size={10} /></span>
                        {s}
                      </div>
                    ))}
                  </div>
                )}
                {streaming && <MessageRenderer text={streaming} />}
                {streamingSources.length > 0 && streaming && (
                  <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: `1px solid ${t.borderCard}` }}>
                    <div style={{ fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: t.textVeryFaint, marginBottom: "0.35rem" }}>Sources</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                      {streamingSources.slice(0, 6).map((s, si) => (
                        <span key={si} style={{ fontSize: "0.6rem", color: t.textVeryFaint, border: `1px solid ${t.borderCard}`, borderRadius: "2px", padding: "0.15rem 0.4rem", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={s.title}>↗ {s.title}</span>
                      ))}
                    </div>
                  </div>
                )}
                {loading && !streaming && (
                  <div style={{ display: "flex", gap: "4px", marginTop: statusLog.length > 0 ? "0.5rem" : 0 }}>
                    {[0, 1, 2].map((n) => <div key={n} style={{ width: "4px", height: "4px", borderRadius: "50%", background: t.gold, animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />)}
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        {started && !loading && (
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.55rem" }}>
            {QUICK_PROMPTS.map((q, i) => (
              <button key={i} onClick={() => handleQuery(q)}
                style={{ background: "transparent", border: `1px solid ${t.borderCard}`, color: t.textVeryFaint, padding: "0.28rem 0.6rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.62rem", letterSpacing: "0.04em", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.borderCard; e.currentTarget.style.color = t.textVeryFaint; }}>
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ borderTop: `1px solid ${t.borderCard}`, paddingTop: "0.85rem", paddingBottom: "1.2rem", display: "flex", gap: "0.5rem" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleQuery(input); } }}
            placeholder="Ask anything about the Fuji X-E5…"
            rows={1}
            disabled={loading}
            style={{ flex: 1, background: t.bgInput, border: `1px solid ${t.borderMid}`, borderRadius: "4px", color: t.text, padding: "0.65rem 0.95rem", fontSize: "0.875rem", resize: "none", outline: "none", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, transition: "border-color 0.2s, background 0.3s" }}
            onFocus={(e) => (e.target.style.borderColor = t.gold)}
            onBlur={(e) => (e.target.style.borderColor = t.borderMid)}
          />
          <button onClick={() => handleQuery(input)} disabled={loading || !input.trim()}
            style={{ background: loading || !input.trim() ? t.bgButton : t.gold, border: "none", borderRadius: "4px", color: loading || !input.trim() ? t.textFaint : (isDark ? "#0c0a07" : "#ffffff"), padding: "0.65rem 1rem", cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s", whiteSpace: "nowrap" }}>
            {loading ? <Icon name="loader" size={14} /> : <Icon name="send" size={14} />}
          </button>
        </div>
      </main>
    </div>
  );
}
