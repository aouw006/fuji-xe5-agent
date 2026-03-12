"use client";

import { useState, useEffect } from "react";

interface TokenBarProps {
  sessionTokens?: number;
  exact?: boolean;
}

interface MonthlyData {
  tokensUsed: number;
  costUsd: number;
  budgetUsd: number;
  pct: number;
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function estimateCost(tokens: number): string {
  // Llama 3.3 70B on Groq: $0.59/M input + $0.79/M output, blended ~$0.69/M
  const cost = (tokens / 1000000) * 0.69;
  if (cost < 0.001) return "<$0.001";
  return `$${cost.toFixed(3)}`;
}

export default function TokenBar({ sessionTokens = 0, exact = false }: TokenBarProps) {
  const [monthly, setMonthly] = useState<MonthlyData | null>(null);

  useEffect(() => {
    fetchMonthly();
    const interval = setInterval(fetchMonthly, 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (sessionTokens > 0) fetchMonthly();
  }, [sessionTokens]);

  const fetchMonthly = async () => {
    try {
      const res = await fetch("/api/history?type=monthly");
      const d = await res.json();
      setMonthly(d);
    } catch {}
  };

  const remaining = monthly ? monthly.budgetUsd - monthly.costUsd : null;
  const isCritical = monthly ? monthly.pct > 90 : false;
  const isLow = monthly ? monthly.pct > 70 : false;
  const barColor = isCritical ? "#e05555" : isLow ? "#e0a855" : "#4caf7d";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem" }}>

        {/* Top row */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {sessionTokens > 0 && (
            <span style={{ fontSize: "0.58rem", color: "#c8a96e", letterSpacing: "0.06em", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: "0.2rem" }}>
              {formatTokens(sessionTokens)}
              {!exact && <span style={{ color: "#3a3530", fontSize: "0.5rem" }}>~</span>}
              <span style={{ color: "#6b5d45" }}>·</span>
              {estimateCost(sessionTokens)}
            </span>
          )}
          {monthly && (
            <>
              <span style={{ fontSize: "0.58rem", color: isCritical ? "#e05555" : "#6b5d45", letterSpacing: "0.06em", fontFamily: "'DM Mono', monospace" }}>
                ${monthly.costUsd.toFixed(3)} / ${monthly.budgetUsd.toFixed(2)}
              </span>
              <div style={{ width: "48px", height: "3px", background: "#1a1610", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(monthly.pct, 100)}%`, height: "100%", background: barColor, borderRadius: "2px", transition: "width 0.5s ease" }} />
              </div>
            </>
          )}
        </div>

        {/* Bottom row */}
        <div style={{ fontSize: "0.5rem", color: "#2e2818", letterSpacing: "0.07em", fontFamily: "'DM Mono', monospace", display: "flex", gap: "0.35rem" }}>
          {sessionTokens > 0 && <span>{exact ? "exact" : "est"} · session</span>}
          {sessionTokens > 0 && remaining !== null && <span style={{ color: "#1e1810" }}>·</span>}
          {remaining !== null && <span>${remaining.toFixed(3)} left this month</span>}
        </div>

      </div>
    </div>
  );
}
