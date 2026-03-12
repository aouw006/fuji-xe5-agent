"use client";
import Icon from "@/components/Icon";
import { useState, useEffect, useCallback } from "react";
import SavedRecipesPanel from "./SavedRecipesPanel";
import RecipeGallery from "./RecipeGallery";
import { darkTheme, lightTheme } from "@/lib/theme";
import { useLongPress } from "@/lib/useLongPress";

interface HistorySession {
  session_id: string;
  title: string;
  date: string;
}

interface Props {
  open: boolean;
  pinned?: boolean;
  onClose: () => void;
  onPin?: () => void;
  onLoadSession: (sessionId: string, messages: { role: string; content: string }[]) => void;
  currentSessionId: string;
  isDark: boolean;
  onCompare: () => void;
}

function SessionRow({ session, isCurrent, isLoading, isDark, onLoad, onDelete }: {
  session: HistorySession;
  isCurrent: boolean;
  isLoading: boolean;
  isDark: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const t = isDark ? darkTheme : lightTheme;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lp = useLongPress(useCallback(() => setConfirmDelete(true), []));

  if (confirmDelete) {
    return (
      <div style={{ padding: "0.6rem 1.25rem", background: isDark ? "rgba(224,85,85,0.08)" : "rgba(200,60,60,0.06)", borderLeft: "2px solid #e05555", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.65rem", color: "#e05555" }}>Delete session?</span>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button onClick={() => { onDelete(); setConfirmDelete(false); }}
            style={{ background: "#e05555", border: "none", color: "#fff", padding: "0.25rem 0.6rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.6rem", fontWeight: 600 }}>
            Delete
          </button>
          <button onClick={() => setConfirmDelete(false)}
            style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint, padding: "0.25rem 0.5rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.6rem" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={isLoading ? undefined : onLoad}
      disabled={isLoading}
      onMouseDown={lp.onMouseDown}
      onMouseUp={lp.onMouseUp}
      onTouchStart={lp.onTouchStart}
      onTouchEnd={lp.onTouchEnd}
      onTouchMove={lp.onTouchMove}
      style={{
        width: "100%", textAlign: "left", padding: "0.6rem 1.25rem",
        background: isCurrent ? (isDark ? "rgba(200,169,110,0.08)" : "rgba(176,136,64,0.1)") : "transparent",
        border: "none", borderLeft: `2px solid ${isCurrent ? t.gold : "transparent"}`,
        cursor: "pointer", transition: "all 0.15s", display: "block", userSelect: "none",
        WebkitUserSelect: "none",
      } as React.CSSProperties}
      onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = isDark ? "rgba(200,169,110,0.04)" : "rgba(176,136,64,0.06)"; }}
      onMouseLeave={e => { lp.onMouseLeave(); if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ fontSize: "0.7rem", color: t.text, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {isLoading ? "Loading…" : session.title}
      </div>
      {isCurrent && (
        <div style={{ fontSize: "0.52rem", color: t.gold, marginTop: "0.15rem", letterSpacing: "0.08em" }}>current</div>
      )}
    </button>
  );
}

export default function HistorySidebar({ open, pinned = false, onClose, onPin, onLoadSession, currentSessionId, isDark, onCompare }: Props) {
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
      if (!pinned) onClose();
    } catch {}
    setLoadingSession(null);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
    } catch {}
  };

  const grouped = sessions.reduce((acc: Record<string, HistorySession[]>, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});

  return (
    <>
      {/* Overlay — only shown in overlay mode, not when pinned */}
      {open && !pinned && <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 20, backdropFilter: "blur(2px)" }} />}

      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: "280px",
        background: t.bgSidebar, borderRight: `1px solid ${t.borderSidebar}`, zIndex: pinned ? 5 : 30,
        transform: open || pinned ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "0.9rem 1.1rem", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "Playfair Display, serif", fontSize: "0.88rem", fontWeight: 700, color: t.text }}>
              {activeTab === "history" ? "History" : "Recipes"}
            </div>
            <div style={{ fontSize: "0.52rem", color: t.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "0.1rem" }}>
              Hold to delete
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            {onPin && (
              <button onClick={onPin}
                title={pinned ? "Unpin sidebar" : "Pin sidebar"}
                style={{ background: pinned ? t.goldDim : "transparent", border: `1px solid ${pinned ? t.gold : t.borderSidebar}`, color: pinned ? t.gold : t.textFaint, width: "26px", height: "26px", borderRadius: "2px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
                onMouseLeave={e => { if (!pinned) { e.currentTarget.style.borderColor = t.borderSidebar; e.currentTarget.style.color = t.textFaint; } }}>
                <Icon name="pin" size={13} />
              </button>
            )}
            <button onClick={onClose}
              style={{ background: "transparent", border: `1px solid ${t.borderSidebar}`, color: t.textFaint, width: "26px", height: "26px", borderRadius: "2px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.borderSidebar; e.currentTarget.style.color = t.textFaint; }}>
              <Icon name="close" size={13} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${t.border}` }}>
          {(["history", "recipes"] as const).map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              style={{ flex: 1, padding: "0.5rem", background: "transparent", border: "none", borderBottom: `2px solid ${activeTab === tab ? t.gold : "transparent"}`, color: activeTab === tab ? t.gold : t.textFaint, cursor: "pointer", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}>
              <Icon name={tab === "history" ? "inspect" : "film"} size={11} />
              {tab === "history" ? "History" : "Recipes"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {activeTab === "history" && (
            <div style={{ padding: "0.75rem 0" }}>
              {loading && (
                <div style={{ padding: "2rem 1.25rem", textAlign: "center", display: "flex", gap: "4px", justifyContent: "center" }}>
                  {[0, 1, 2].map(n => <div key={n} style={{ width: "4px", height: "4px", borderRadius: "50%", background: t.gold, animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />)}
                </div>
              )}
              {!loading && sessions.length === 0 && (
                <div style={{ padding: "2rem 1.25rem", textAlign: "center", fontSize: "0.72rem", color: t.textVeryFaint }}>
                  No past conversations yet
                </div>
              )}
              {!loading && Object.entries(grouped).map(([date, dateSessions]) => (
                <div key={date}>
                  <div style={{ padding: "0.45rem 1.25rem 0.25rem", fontSize: "0.52rem", color: t.textVeryFaint, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                    {date}
                  </div>
                  {dateSessions.map(session => (
                    <SessionRow
                      key={session.session_id}
                      session={session}
                      isCurrent={session.session_id === currentSessionId}
                      isLoading={loadingSession === session.session_id}
                      isDark={isDark}
                      onLoad={() => handleLoadSession(session.session_id)}
                      onDelete={() => handleDeleteSession(session.session_id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          {activeTab === "recipes" && (
            <>
              <div style={{ padding: "0.6rem 1.25rem 0", display: "flex", gap: "0.5rem" }}>
                <button onClick={() => setGalleryOpen(true)}
                  style={{ flex: 1, padding: "0.4rem", background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "2px", cursor: "pointer", fontSize: "0.6rem", letterSpacing: "0.08em", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>
                  <Icon name="compare" size={11} /> Gallery &amp; Compare
                </button>
              </div>
              <SavedRecipesPanel open={true} sessionId={currentSessionId} isDark={isDark} />
            </>
          )}
        </div>

        <div style={{ padding: "0.6rem 1.25rem", borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: "0.52rem", color: t.textVeryFaint, textAlign: "center", letterSpacing: "0.08em" }}>
            Hold any item to delete
          </div>
        </div>
      </div>

      <RecipeGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        sessionId={currentSessionId}
        isDark={isDark}
        onCompare={() => { setGalleryOpen(false); onCompare(); }}
      />
    </>
  );
}
