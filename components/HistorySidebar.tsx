"use client";

import { useState, useEffect } from "react";
import SavedRecipesPanel from "./SavedRecipesPanel";

interface HistorySession {
  session_id: string;
  title: string;
  date: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onLoadSession: (sessionId: string, messages: { role: string; content: string }[]) => void;
  currentSessionId: string;
}

export default function HistorySidebar({ open, onClose, onLoadSession, currentSessionId }: Props) {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"history" | "recipes">("history");

  useEffect(() => {
    if (open) fetchSessions();
  }, [open]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {}
    setLoading(false);
  };

  const handleLoadSession = async (sessionId: string) => {
    setLoadingSession(sessionId);
    try {
      const res = await fetch(`/api/history?session=${sessionId}`);
      const data = await res.json();
      onLoadSession(sessionId, data.messages || []);
      onClose();
    } catch {}
    setLoadingSession(null);
  };

  // Group sessions by date
  const grouped = sessions.reduce((acc: Record<string, HistorySession[]>, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 20, backdropFilter: "blur(2px)" }}
        />
      )}

      {/* Sidebar */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0,
        width: "300px",
        background: "#0f0d09",
        borderRight: "1px solid #1e1a12",
        zIndex: 30,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ padding: "1.2rem 1.25rem", borderBottom: "1px solid #1a1610", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.95rem", fontWeight: 700, color: "#e8d5b0" }}>
              {activeTab === "history" ? "History" : "Saved Recipes"}
            </div>
            <div style={{ fontSize: "0.6rem", color: "#4a3e2a", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "0.1rem" }}>
              {activeTab === "history" ? "Past conversations" : "Starred recipes"}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: "transparent", border: "1px solid #1e1a12", color: "#4a3e2a", width: "28px", height: "28px", borderRadius: "2px", cursor: "pointer", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.color = "#c8a96e"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e1a12"; e.currentTarget.style.color = "#4a3e2a"; }}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1a1610" }}>
          {(["history", "recipes"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ flex: 1, padding: "0.55rem", background: "transparent", border: "none", borderBottom: `2px solid ${activeTab === tab ? "#c8a96e" : "transparent"}`, color: activeTab === tab ? "#c8a96e" : "#4a3e2a", cursor: "pointer", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s" }}>
              {tab === "history" ? "💬 History" : "⭐ Recipes"}
            </button>
          ))}
        </div>

        {/* Sessions list */}
        <div style={{ flex: 1, padding: "1rem 0", overflowY: "auto" }}>
          {activeTab === "recipes" && <SavedRecipesPanel open={activeTab === "recipes"} sessionId={currentSessionId} />}
          {activeTab === "history" && (<>
          {loading && (
            <div style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
              <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                {[0, 1, 2].map(n => <div key={n} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#c8a96e", animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />)}
              </div>
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📭</div>
              <div style={{ fontSize: "0.75rem", color: "#3a3020" }}>No past conversations yet</div>
            </div>
          )}

          {!loading && Object.entries(grouped).map(([date, dateSessions]) => (
            <div key={date}>
              <div style={{ padding: "0.5rem 1.25rem 0.3rem", fontSize: "0.58rem", color: "#3a3020", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                {date}
              </div>
              {dateSessions.map(session => (
                <button
                  key={session.session_id}
                  onClick={() => handleLoadSession(session.session_id)}
                  disabled={loadingSession === session.session_id}
                  style={{
                    width: "100%", textAlign: "left",
                    padding: "0.65rem 1.25rem",
                    background: session.session_id === currentSessionId ? "rgba(200,169,110,0.08)" : "transparent",
                    border: "none",
                    borderLeft: session.session_id === currentSessionId ? "2px solid #c8a96e" : "2px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "block",
                  }}
                  onMouseEnter={(e) => {
                    if (session.session_id !== currentSessionId) {
                      e.currentTarget.style.background = "rgba(200,169,110,0.04)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (session.session_id !== currentSessionId) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <div style={{ fontSize: "0.72rem", color: "#c8b89a", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {loadingSession === session.session_id ? "Loading…" : session.title}
                  </div>
                  {session.session_id === currentSessionId && (
                    <div style={{ fontSize: "0.55rem", color: "#c8a96e", marginTop: "0.2rem", letterSpacing: "0.08em" }}>current</div>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

          </>)}

        {/* Footer */}
        <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #1a1610" }}>
          <div style={{ fontSize: "0.6rem", color: "#2e2818", textAlign: "center", letterSpacing: "0.08em" }}>
            Powered by Supabase
          </div>
        </div>
      </div>
    </>
  );
}
