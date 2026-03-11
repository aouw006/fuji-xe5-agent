"use client";

import { useState, useEffect } from "react";

interface TokenData {
  used: number;
  limit: number;
  resetIn: string;
}

export default function TokenBar() {
  const [data, setData] = useState<TokenData | null>(null);

  useEffect(() => {
    fetchTokens();
    // Refresh every 2 minutes
    const interval = setInterval(fetchTokens, 120000);
    return () => clearInterval(interval);
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
      {/* Bar */}
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
          resets in {data.resetIn}
        </div>
      </div>
    </div>
  );
}
