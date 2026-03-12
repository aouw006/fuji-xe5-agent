"use client";

import { useState, useEffect } from "react";

interface TokenData {
  used: number;
  limit: number;
}

function getResetCountdown(): string {
  const now = new Date();
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  const diffMs = midnight.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

export default function TokenBar() {
  const [data, setData] = useState<TokenData | null>(null);
  const [resetIn, setResetIn] = useState(getResetCountdown());

  useEffect(() => {
    fetchTokens();
    const dataInterval = setInterval(fetchTokens, 120000);
    const countdownInterval = setInterval(() => setResetIn(getResetCountdown()), 60000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(countdownInterval);
    };
  }, []);

  const fetchTokens = async () => {
    try {
      const res = await fetch("/api/history?type=tokens");
      const d = await res.json();
      setData(d);
    } catch {}
  };

  if (!data) return null;

  const pct = Math.min((data.used / data.limit) * 100, 100);
  const remaining = data.limit - data.used;
  const isLow = pct > 80;
  const isCritical = pct > 95;
  const barColor = isCritical ? "#e05555" : isLow ? "#e0a855" : "#4caf7d";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ fontSize: "0.58rem", color: isCritical ? "#e05555" : "#4a3e2a", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace" }}>
            {remaining.toLocaleString()} left
          </span>
          <div style={{ width: "60px", height: "3px", background: "#1a1610", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: "2px", transition: "width 0.5s ease" }} />
          </div>
        </div>
        <div style={{ fontSize: "0.52rem", color: "#2e2818", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace" }}>
          resets in {resetIn}
        </div>
      </div>
    </div>
  );
}
