"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useEffect, useCallback } from "react";
import MessageRenderer from "@/components/MessageRenderer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Source { title: string; url: string; }
interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  agentName?: string;
  agentIcon?: string;
}
interface HistoryEntry { role: "user" | "assistant"; content: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: "Film Recipes", icon: "🎞️", query: "best film simulation recipes for Fujifilm X-E5 with exact settings" },
  { label: "Camera Settings", icon: "⚙️", query: "optimal camera settings custom menu and button setup for Fujifilm X-E5" },
  { label: "Iconic Locations", icon: "📍", query: "iconic photography locations perfect for shooting with Fujifilm X-E5" },
  { label: "Gear & Lenses", icon: "🎒", query: "best XF lenses and accessories for Fujifilm X-E5" },
  { label: "Community Tips", icon: "🌐", query: "Fujifilm X-E5 hidden tips tricks community recommendations reddit" },
];

const QUICK_PROMPTS = [
  "Eterna Cinema recipe for street",
  "Silent shutter settings",
  "Best 23mm vs 35mm for X-E5",
  "Kyoto photo locations",
  "AF tracking settings for X-E5",
  "Classic Neg recipe for portraits",
];

// Session managed client-side via useEffect

// ─── Component ────────────────────────────────────────────────────────────────

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
  const bottomRef = useRef<HTMLDivElement>(null);

  // Runs only on the client after mount — safe to use localStorage here
  useEffect(() => {
    const stored = localStorage.getItem("xe5_session_id");
    if (stored) {
      setSessionId(stored);
    } else {
      const newId = `xe5_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem("xe5_session_id", newId);
      setSessionId(newId);
    }
  }, []);

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
            } else if (data.type === "done") {
              setMessages((prev) => [...prev, {
                role: "assistant",
                content: fullText,
                sources,
                agentName: agentInfo?.name,
                agentIcon: agentInfo?.icon,
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
              throw new Error(data.text);
            }
          } catch (e) {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ Error: ${msg}`, sources: [] }]);
    }

    setLoading(false);
  }, [loading, history, sessionId]);

  const reset = () => {
    setMessages([]);
    setHistory([]);
    setStarted(false);
    setInput("");
    setStreaming("");
    setStatusLog([]);
    setStreamingAgent(null);
    // Clear session so next conversation starts fresh
    if (typeof window !== "undefined") {
      localStorage.removeItem("xe5_session_id");
      window.location.reload();
    }
  };

  const btn = (hovered: boolean) => ({
    borderColor: hovered ? "#c8a96e" : "#1e1a12",
    color: hovered ? "#c8a96e" : "#4a3e2a",
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0c0a07" }}>
      {/* Grain */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`, backgroundSize: "256px", opacity: 0.5 }} />
      <div style={{ position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)", width: "700px", height: "500px", background: "radial-gradient(ellipse, rgba(200,169,110,0.04) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid #1a1610", background: "rgba(12,10,7,0.95)", backdropFilter: "blur(16px)", padding: "0.85rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1.5px solid #c8a96e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem", color: "#c8a96e", letterSpacing: "0.05em", background: "rgba(200,169,110,0.06)", fontFamily: "'DM Mono', monospace" }}>XE5</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.95rem", fontWeight: 700, letterSpacing: "0.04em" }}>X-E5 Research Agent</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#4caf7d", animation: "blink 2s ease-in-out infinite" }} />
              <span style={{ fontSize: "0.58rem", color: "#4a3e2a", letterSpacing: "0.15em", textTransform: "uppercase" }}>5 specialist agents · Groq · Tavily</span>
            </div>
          </div>
        </div>
        {started && (
          <button onClick={reset}
            style={{ background: "transparent", border: "1px solid #1e1a12", color: "#4a3e2a", padding: "0.3rem 0.8rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", transition: "all 0.2s" }}
            onMouseEnter={(e) => { const t = e.currentTarget; t.style.borderColor = "#c8a96e"; t.style.color = "#c8a96e"; }}
            onMouseLeave={(e) => { const t = e.currentTarget; t.style.borderColor = "#1e1a12"; t.style.color = "#4a3e2a"; }}>
            ↺ New
          </button>
        )}
      </header>

      <main style={{ flex: 1, maxWidth: "860px", width: "100%", margin: "0 auto", padding: "0 1.25rem", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>

        {/* Welcome */}
        {!started && (
          <div style={{ padding: "2.5rem 0 2rem", textAlign: "center", animation: "fadeIn 0.5s ease" }}>
            <div style={{ fontSize: "0.62rem", letterSpacing: "0.3em", color: "#3a3020", textTransform: "uppercase", marginBottom: "0.75rem" }}>5 Specialist Agents · Multi-round Search · Full Article Reading</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 900, lineHeight: 1.05, color: "#e8d5b0", margin: "0 0 0.75rem" }}>
              Fujifilm X-E5<br /><span style={{ color: "#c8a96e", fontStyle: "italic" }}>Research Agent</span>
            </h1>
            <p style={{ color: "#5a4e38", maxWidth: "460px", margin: "0 auto 2rem", lineHeight: 1.8, fontSize: "0.875rem" }}>
              Each question is routed to a specialist agent — film recipes, settings, locations, gear, or community. It searches multiple rounds, reads full articles, and streams expert answers.
            </p>

            {/* Agent cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: "0.55rem", marginBottom: "1.5rem" }}>
              {CATEGORIES.map((cat) => (
                <button key={cat.label} onClick={() => handleQuery(cat.query)}
                  style={{ background: "rgba(200,169,110,0.025)", border: "1px solid #1a1610", borderRadius: "4px", padding: "1.1rem 0.9rem", cursor: "pointer", textAlign: "left", transition: "all 0.2s", color: "#e8d5b0" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.background = "rgba(200,169,110,0.07)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1a1610"; e.currentTarget.style.background = "rgba(200,169,110,0.025)"; }}>
                  <div style={{ fontSize: "1.35rem", marginBottom: "0.45rem" }}>{cat.icon}</div>
                  <div style={{ fontSize: "0.76rem", fontWeight: 500 }}>{cat.label}</div>
                  <div style={{ fontSize: "0.6rem", color: "#4a3e2a", marginTop: "0.2rem" }}>specialist agent</div>
                </button>
              ))}
            </div>

            {/* How it works */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
              {["Detect agent", "Plan queries", "Multi-round search", "Scrape articles", "Stream answer"].map((s, i, arr) => (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ padding: "0.3rem 0.6rem", background: "rgba(200,169,110,0.03)", border: "1px solid #1a1610", borderRadius: "2px", fontSize: "0.58rem", color: "#3a3020", letterSpacing: "0.06em" }}>{s}</div>
                  {i < arr.length - 1 && <div style={{ color: "#1a1610", fontSize: "0.65rem", padding: "0 0.15rem" }}>→</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, paddingTop: started ? "1.25rem" : 0 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn 0.3s ease" }}>
              <div style={{ fontSize: "0.56rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#2e2818", marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: "0.35rem", paddingLeft: msg.role === "assistant" ? "0.25rem" : 0, paddingRight: msg.role === "user" ? "0.25rem" : 0 }}>
                {msg.role === "assistant" && msg.agentIcon && <span>{msg.agentIcon}</span>}
                {msg.role === "user" ? "You" : msg.agentName || "XE5 Agent"}
              </div>
              <div style={{ maxWidth: msg.role === "user" ? "70%" : "100%", background: msg.role === "user" ? "rgba(200,169,110,0.08)" : "rgba(255,255,255,0.016)", border: `1px solid ${msg.role === "user" ? "rgba(200,169,110,0.2)" : "#181410"}`, borderRadius: "4px", padding: "0.9rem 1.15rem" }}>
                {msg.role === "assistant" ? <MessageRenderer text={msg.content} /> : <span style={{ fontSize: "0.875rem", color: "#e8d5b0" }}>{msg.content}</span>}

                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginTop: "1rem", paddingTop: "0.9rem", borderTop: "1px solid #181410" }}>
                    <div style={{ fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#3a3020", marginBottom: "0.4rem" }}>Sources searched</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                      {msg.sources.map((s, si) => (
                        <a key={si} href={s.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: "0.6rem", color: "#4a3e2a", border: "1px solid #181410", borderRadius: "2px", padding: "0.15rem 0.4rem", textDecoration: "none", transition: "all 0.15s", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}
                          onMouseEnter={(e) => { const t = e.currentTarget; t.style.color = "#c8a96e"; t.style.borderColor = "#c8a96e"; }}
                          onMouseLeave={(e) => { const t = e.currentTarget; t.style.color = "#4a3e2a"; t.style.borderColor = "#181410"; }}
                          title={s.title}>↗ {s.title || s.url}</a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Live streaming */}
          {(loading || streaming) && (
            <div style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column", alignItems: "flex-start", animation: "fadeIn 0.3s ease" }}>
              <div style={{ fontSize: "0.56rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#2e2818", marginBottom: "0.35rem", paddingLeft: "0.25rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                {streamingAgent?.icon && <span>{streamingAgent.icon}</span>}
                {streamingAgent?.name || "XE5 Agent"}
              </div>
              <div style={{ width: "100%", background: "rgba(255,255,255,0.016)", border: "1px solid #181410", borderRadius: "4px", padding: "0.9rem 1.15rem" }}>
                {/* Status log */}
                {statusLog.length > 0 && !streaming && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    {statusLog.map((s, i) => (
                      <div key={i} style={{ fontSize: "0.68rem", color: i === statusLog.length - 1 ? "#8a7258" : "#3a3020", lineHeight: 1.6, display: "flex", alignItems: "center", gap: "0.4rem", transition: "color 0.3s" }}>
                        <span style={{ color: i === statusLog.length - 1 ? "#c8a96e" : "#2a2318" }}>
                          {i === statusLog.length - 1 ? "◎" : "✓"}
                        </span>
                        {s}
                      </div>
                    ))}
                  </div>
                )}

                {/* Streaming text */}
                {streaming && <MessageRenderer text={streaming} />}

                {/* Streaming sources */}
                {streamingSources.length > 0 && streaming && (
                  <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #181410" }}>
                    <div style={{ fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#3a3020", marginBottom: "0.35rem" }}>Sources</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                      {streamingSources.slice(0, 6).map((s, si) => (
                        <span key={si} style={{ fontSize: "0.6rem", color: "#3a3020", border: "1px solid #181410", borderRadius: "2px", padding: "0.15rem 0.4rem", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={s.title}>↗ {s.title}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pulse dots */}
                {loading && !streaming && (
                  <div style={{ display: "flex", gap: "4px", marginTop: statusLog.length > 0 ? "0.5rem" : 0 }}>
                    {[0, 1, 2].map((n) => <div key={n} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#c8a96e", animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />)}
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
                style={{ background: "transparent", border: "1px solid #181410", color: "#3a3020", padding: "0.28rem 0.6rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.62rem", letterSpacing: "0.04em", transition: "all 0.2s" }}
                onMouseEnter={(e) => { const t = e.currentTarget; t.style.borderColor = "#c8a96e"; t.style.color = "#c8a96e"; }}
                onMouseLeave={(e) => { const t = e.currentTarget; t.style.borderColor = "#181410"; t.style.color = "#3a3020"; }}>
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ borderTop: "1px solid #181410", paddingTop: "0.85rem", paddingBottom: "1.2rem", display: "flex", gap: "0.5rem" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleQuery(input); } }}
            placeholder="Ask anything about the Fuji X-E5…"
            rows={1}
            disabled={loading}
            style={{ flex: 1, background: "rgba(255,255,255,0.022)", border: "1px solid #1e1a12", borderRadius: "4px", color: "#e8d5b0", padding: "0.65rem 0.95rem", fontSize: "0.875rem", resize: "none", outline: "none", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, transition: "border-color 0.2s" }}
            onFocus={(e) => (e.target.style.borderColor = "#c8a96e")}
            onBlur={(e) => (e.target.style.borderColor = "#1e1a12")}
          />
          <button onClick={() => handleQuery(input)} disabled={loading || !input.trim()}
            style={{ background: loading || !input.trim() ? "rgba(200,169,110,0.07)" : "rgba(200,169,110,0.82)", border: "none", borderRadius: "4px", color: loading || !input.trim() ? "#3a3020" : "#0c0a07", padding: "0.65rem 1rem", cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s", whiteSpace: "nowrap" }}>
            {loading ? "…" : "Search ↑"}
          </button>
        </div>
      </main>
    </div>
  );
}
