"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { darkTheme, lightTheme } from "@/lib/theme";

export type NavPage = "dashboard" | "db" | "ingest" | "agents" | "library" | "evals";

const LINKS: { id: NavPage; href: string; label: string }[] = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard" },
  { id: "db",        href: "/db",        label: "Knowledge Base" },
  { id: "ingest",    href: "/ingest",    label: "Ingester" },
  { id: "agents",    href: "/agents",    label: "How Agents Work" },
  { id: "library",   href: "/library",   label: "Library" },
  { id: "evals",     href: "/evals",     label: "Evals" },
];

interface NavBarProps {
  current: NavPage;
  isDark: boolean;
  onToggleTheme: () => void;
  /** Dashboard-style: show XE5 logo + title on the left */
  pageTitle?: string;
  pageSubtitle?: string;
}

export default function NavBar({ current, isDark, onToggleTheme, pageTitle, pageSubtitle }: NavBarProps) {
  const t = isDark ? darkTheme : lightTheme;
  const [menuOpen, setMenuOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 860);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const btn: React.CSSProperties = {
    background: "transparent",
    border: `1px solid ${t.border}`,
    color: t.textMuted,
    padding: "0.3rem 0.65rem",
    borderRadius: "2px",
    cursor: "pointer",
    fontSize: "0.6rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    textDecoration: "none",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.3rem",
  };

  const active: React.CSSProperties = {
    ...btn,
    color: t.gold,
    border: `1px solid ${t.gold}`,
    cursor: "default",
  };

  const iconBtn: React.CSSProperties = {
    background: "transparent",
    border: `1px solid ${t.border}`,
    color: t.textMuted,
    width: "30px",
    height: "30px",
    borderRadius: "2px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  };

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: `1px solid ${t.border}`, background: t.bgHeader, backdropFilter: "blur(16px)" }}>
      <div style={{ padding: "0.7rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

        {/* Left: logo+title (dashboard) or ← Chat (all others) */}
        {pageTitle ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: `1.5px solid ${t.gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.48rem", color: t.gold, background: t.goldBg, fontFamily: "DM Mono, monospace" }}>XE5</div>
            <div>
              <div style={{ fontFamily: "Playfair Display, serif", fontSize: "0.9rem", fontWeight: 700, color: t.text }}>{pageTitle}</div>
              {pageSubtitle && <div style={{ fontSize: "0.5rem", color: t.textMuted, letterSpacing: "0.1em", textTransform: "uppercase" }}>{pageSubtitle}</div>}
            </div>
          </div>
        ) : (
          <Link href="/" style={{ color: t.gold, textDecoration: "none", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>← Chat</Link>
        )}

        {/* Right: nav links or hamburger */}
        {narrow ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <button onClick={onToggleTheme} style={iconBtn}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>
              <Icon name={isDark ? "sun" : "moon"} size={14} />
            </button>
            <button onClick={() => setMenuOpen(p => !p)}
              style={{ ...iconBtn, fontSize: "1rem", width: "36px" }}>
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {pageTitle && (
              <Link href="/" style={btn}>
                <Icon name="back" size={13} />Back
              </Link>
            )}
            {LINKS.map(link =>
              link.id === current
                ? <span key={link.id} style={active}>{link.label}</span>
                : <Link key={link.id} href={link.href} style={btn}>{link.label}</Link>
            )}
            <button onClick={onToggleTheme} style={iconBtn}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>
              <Icon name={isDark ? "sun" : "moon"} size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Mobile/tablet dropdown */}
      {narrow && menuOpen && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "0.6rem 1.5rem 0.8rem", display: "flex", flexDirection: "column", gap: "0.4rem", background: t.bgHeader }}>
          {pageTitle && (
            <Link href="/" style={btn} onClick={() => setMenuOpen(false)}>
              <Icon name="back" size={13} />Back to Chat
            </Link>
          )}
          {LINKS.map(link =>
            link.id === current
              ? <span key={link.id} style={active}>{link.label}</span>
              : <Link key={link.id} href={link.href} style={btn} onClick={() => setMenuOpen(false)}>{link.label}</Link>
          )}
        </div>
      )}
    </header>
  );
}
