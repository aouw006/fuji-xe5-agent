"use client";

interface Props {
  text: string;
  isDark?: boolean;
}

function parseInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong style='color:#e8d5b0'>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code style='font-family:DM Mono,monospace;font-size:0.82em;background:rgba(200,169,110,0.08);padding:0.1em 0.35em;border-radius:3px;color:#c8a96e'>$1</code>");
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s\-:|]+\|/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line.trim().slice(1, -1).split("|").map(cell => cell.trim());
}

export default function MessageRenderer({ text, isDark = true }: Props) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table detection — collect consecutive table lines
    if (isTableRow(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && (isTableRow(lines[i]) || lines[i].trim() === "")) {
        if (lines[i].trim() !== "") tableLines.push(lines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0];
        const headers = parseTableRow(headerRow);
        const dataRows = tableLines.slice(2).filter(l => !isSeparatorRow(l)); // skip separator

        elements.push(
          <div key={`table-${i}`} style={{ overflowX: "auto", margin: "0.85rem 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr>
                  {headers.map((h, hi) => (
                    <th key={hi} style={{
                      padding: "0.45rem 0.75rem",
                      textAlign: hi === 0 ? "left" : "center",
                      background: isDark ? "rgba(200,169,110,0.1)" : "rgba(176,136,64,0.12)",
                      color: "#c8a96e",
                      fontWeight: 600,
                      fontSize: "0.7rem",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      border: isDark ? "1px solid rgba(200,169,110,0.15)" : "1px solid rgba(176,136,64,0.2)",
                      whiteSpace: "nowrap",
                    }}
                    dangerouslySetInnerHTML={{ __html: parseInline(h) }} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, ri) => {
                  const cells = parseTableRow(row);
                  return (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : (isDark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.02)") }}>
                      {cells.map((cell, ci) => (
                        <td key={ci} style={{
                          padding: "0.4rem 0.75rem",
                          textAlign: ci === 0 ? "left" : "center",
                          color: ci === 0 ? "#e8d5b0" : "#c8b89a",
                          fontWeight: ci === 0 ? 500 : 400,
                          border: isDark ? "1px solid rgba(200,169,110,0.08)" : "1px solid rgba(176,136,64,0.12)",
                          fontFamily: ci === 0 ? "inherit" : "'DM Mono', monospace",
                          fontSize: ci === 0 ? "0.78rem" : "0.72rem",
                        }}
                        dangerouslySetInnerHTML={{ __html: parseInline(cell) }} />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Headings
    if (/^#{1,3}\s/.test(line)) {
      const level = (line.match(/^#+/) || [""])[0].length;
      const content = line.replace(/^#+\s/, "");
      elements.push(
        <div key={i} style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: level === 1 ? "1.05rem" : "0.95rem",
          fontWeight: 700,
          color: "#c8a96e",
          margin: "1.1rem 0 0.35rem",
        }}
        dangerouslySetInnerHTML={{ __html: parseInline(content) }} />
      );
      i++; continue;
    }

    // Bold-only line (acts as subheading)
    if (/^\*\*(.+)\*\*$/.test(line.trim())) {
      elements.push(
        <div key={i} style={{ fontWeight: 700, color: "#e8d5b0", marginTop: "0.65rem" }}
          dangerouslySetInnerHTML={{ __html: parseInline(line) }} />
      );
      i++; continue;
    }

    // Bullet point
    if (/^[-•*]\s/.test(line)) {
      const content = line.replace(/^[-•*]\s/, "");
      elements.push(
        <div key={i} style={{ display: "flex", gap: "0.5rem", paddingLeft: "0.5rem", lineHeight: 1.75, color: "#c8b89a" }}>
          <span style={{ color: "#c8a96e", flexShrink: 0 }}>◆</span>
          <span dangerouslySetInnerHTML={{ __html: parseInline(content) }} />
        </div>
      );
      i++; continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const num = (line.match(/^(\d+)\./) || ["", ""])[1];
      const content = line.replace(/^\d+\.\s/, "");
      elements.push(
        <div key={i} style={{ display: "flex", gap: "0.5rem", paddingLeft: "0.5rem", lineHeight: 1.75, color: "#c8b89a" }}>
          <span style={{ color: "#c8a96e", flexShrink: 0, fontFamily: "'DM Mono', monospace", fontSize: "0.78rem", minWidth: "16px" }}>{num}.</span>
          <span dangerouslySetInnerHTML={{ __html: parseInline(content) }} />
        </div>
      );
      i++; continue;
    }

    // Blank line
    if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: "0.5rem" }} />);
      i++; continue;
    }

    // Regular paragraph line
    elements.push(
      <div key={i} style={{ color: "#c8b89a", lineHeight: 1.8 }}
        dangerouslySetInnerHTML={{ __html: parseInline(line) }} />
    );
    i++;
  }

  return <div style={{ fontSize: "0.875rem" }}>{elements}</div>;
}
