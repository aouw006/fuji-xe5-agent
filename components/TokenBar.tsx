"use client";

import { useState, useEffect } from "react";

interface MonthlyData {
  tokensUsed: number;
  costUsd: number;
  budgetUsd: number;
  pct: number;
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

function getMonthName(): string {
  return new Date().toLocaleString("en-AU", { month: "short" });
}

export default function TokenBar() {
  const [data, setData] = useState<MonthlyData | null>(null);
  const [resetIn, setResetIn] = useState(getResetCountdown());

  useEffect(() => {
    fetchUsage();
    const dataInterval = setInterval(fetchUsage, 120000);
    const countdownInterval = setInterval(() => setResetIn(getResetCountdown()), 60000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(countdownInterval);
    };
  }, []);

  const fetchUsage = async () => {
    try {
      const res = await fetch("/api/history?type=monthly");
      const d = await res.json();
      setData(d);
    } catch {}
  };

  if (!data) return null;

  const isLow = data.pct > 70;
  const isCritical = data.pct > 90;
  const barColor = isCritical ? "#e05555" : isLow ? "#e0a855" : "#4caf7d";
  const remaining = data.budgetUsd - data.costUsd;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ fontSize: "0.58rem", color: isCritical ? "#e05555" : "#6b5d45", letterSpacing: "0.06em", fontFamily: "'DM Mono', monospace" }}>
            ${data.costUsd.toFixed(3)} / ${data.budgetUsd.toFixed(2)}
          </span>
          <div style={{ width: "52px", height: "3px", background: "#1a1610", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ width: `${data.pct}%`, height: "100%", background: barColor, borderRadius: "2px", transition: "width 0.5s ease" }} />
          </div>
        </div>
        <div style={{ fontSize: "0.5rem", color: "#2e2818", letterSpacing: "0.07em", fontFamily: "'DM Mono', monospace" }}>
          ${remaining.toFixed(3)} left · {getMonthName()} · resets {resetIn}
        </div>
      </div>
    </div>
  );
}
