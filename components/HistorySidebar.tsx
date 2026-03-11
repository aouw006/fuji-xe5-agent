"use client";

import { useState, useEffect } from "react";
import SavedRecipesPanel from "./SavedRecipesPanel";
import RecipeGallery from "./RecipeGallery";
import { darkTheme, lightTheme } from "@/lib/theme";

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
  isDark: boolean;
}

export default function HistorySidebar({ open, onClose, onLoadSession, currentSessionId, isDark }: Props) {
  const t = isDark ? darkTheme : lightTheme;
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"history" | "recipes">("history");
  const [galleryOpen, setGalleryOpen] = useState(false);

  useEffect(() => {
    if (open && activeTab === "history") fetchSessions();
  }, [open, activeTab]);

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

  const grouped = sessions.reduce((acc: Record<string, HistorySession[]>, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});

  return (
    <>
      {open && (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 20, backdropFilter: "blur(2px)" }} />
      )}

      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: "300px",
        background: t.bgSidebar, borderRight: `1px solid ${t.borderSidebar}`, zIndex: 30,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s",
        display: "flex", flexDirection: "column",
      }}>

        {/* Header */}
        <div style={{ padding: "1.2rem 1.25rem", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.95rem", fontWeight: 700, color: t.text }}>
              {activeTab === "history" ? "History" : "Saved Recipes"}
            </div>
            <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "0.1rem" }}>
              {activeTab === "history" ? "Past conversations" : "Starred recipes"}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: "transparent", border: `1px solid ${t.borderSidebar}`, color: t.textFaint, width: "28px", height: "28px", borderRadius: "2px", cursor: "pointer", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.borderSidebar; e.currentTarget.style.color = t.textFaint; }}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${t.border}` }}>
          {(["history", "recipes"] as const).map(tab => (
            <button key={tab} onClick={() => { if (tab === "recipes") { setGalleryOpen(true); } else { setActiveTab(tab); } }}
              style={{ flex: 1, padding: "0.55rem", background: "transparent", border: "none", borderBottom: `2px solid ${activeTab === tab ? t.gold : "transparent"}`, color: activeTab === tab ? t.gold : t.textFaint, cursor: "pointer", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s" }}>
              {tab === "history" ? "💬 History" : "⭐ Recipes"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {activeTab === "history" && (
            <div style={{ padding: "1rem 0" }}>
              {loading && (
                <div style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
                  <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                    {[0, 1, 2].map(n => (
                      <div key={n} style={{ width: "4px", height: "4px", borderRadius: "50%", background: t.gold, animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}

              {!loading && sessions.length === 0 && (
                <div style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📭</div>
                  <div style={{ fontSize: "0.75rem", color: t.textVeryFaint }}>No past conversations yet</div>
                </div>
              )}

              {!loading && Object.entries(grouped).map(([date, dateSessions]) => (
                <div key={date}>
                  <div style={{ padding: "0.5rem 1.25rem 0.3rem", fontSize: "0.58rem", color: t.textVeryFaint, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                    {date}
                  </div>
                  {dateSessions.map(session => (
                    <button key={session.session_id} onClick={() => handleLoadSession(session.session_id)}
                      disabled={loadingSession === session.session_id}
                      style={{ width: "100%", textAlign: "left", padding: "0.65rem 1.25rem", background: session.session_id === currentSessionId ? (isDark ? "rgba(200,169,110,0.08)" : "rgba(176,136,64,0.1)") : "transparent", border: "none", borderLeft: `2px solid ${session.session_id === currentSessionId ? t.gold : "transparent"}`, cursor: "pointer", transition: "all 0.15s", display: "block" }}
                      onMouseEnter={(e) => { if (session.session_id !== currentSessionId) e.currentTarget.style.background = isDark ? "rgba(200,169,110,0.04)" : "rgba(176,136,64,0.06)"; }}
                      onMouseLeave={(e) => { if (session.session_id !== currentSessionId) e.currentTarget.style.background = "transparent"; }}>
                      <div style={{ fontSize: "0.72rem", color: t.text, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {loadingSession === session.session_id ? "Loading…" : session.title}
                      </div>
                      {session.session_id === currentSessionId && (
                        <div style={{ fontSize: "0.55rem", color: t.gold, marginTop: "0.2rem", letterSpacing: "0.08em" }}>current</div>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.25rem", borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: "0.6rem", color: t.textVeryFaint, textAlign: "center", letterSpacing: "0.08em" }}>
            Powered by Supabase
          </div>
        </div>
      </div>

      <RecipeGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        sessionId={currentSessionId}
        isDark={isDark}
      />
    </>
  );
}
