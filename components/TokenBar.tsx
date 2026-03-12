"use client";

import { useState, useEffect } from "react";

interface TokenBarProps {
  sessionTokens?: number;
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function estimateCost(tokens: number): string {
  // Llama 3.3 70B on Groq blended rate ~$0.69/M tokens
  const cost = (tokens / 1000000) * 0.69;
  if (cost < 0.001) return "<$0.001";
  return `$${cost.toFixed(3)}`;
}

export default function TokenBar({ sessionTokens = 0 }: TokenBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionTokens > 0) setVisible(true);
  }, [sessionTokens]);

  if (!visible) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.15rem" }}>
        <div style={{
          fontSize: "0.58rem",
          color: "#6b5d45",
          letterSpacing: "0.06em",
          fontFamily: "'DM Mono', monospace",
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
        }}>
          <span style={{ color: "#c8a96e" }}>{formatTokens(sessionTokens)}</span>
          <span>tokens</span>
          <span style={{ color: "#3a3530" }}>·</span>
          <span>{estimateCost(sessionTokens)}</span>
        </div>
        <div style={{
          fontSize: "0.5rem",
          color: "#2e2818",
          letterSpacing: "0.07em",
          fontFamily: "'DM Mono', monospace",
        }}>
          this session
        </div>
      </div>
    </div>
  );
}
