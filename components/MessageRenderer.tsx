"use client";

interface Props {
  text: string;
}

export default function MessageRenderer({ text }: Props) {
  const lines = text.split("\n");

  return (
    <div style={{ fontSize: "0.875rem" }}>
      {lines.map((line, i) => {
        if (/^#{1,3}\s/.test(line)) {
          return (
            <div
              key={i}
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "1rem",
                fontWeight: 700,
                color: "#c8a96e",
                margin: "1.2rem 0 0.4rem",
              }}
            >
              {line.replace(/^#+\s/, "")}
            </div>
          );
        }
        if (/^\*\*(.+)\*\*$/.test(line)) {
          return (
            <div key={i} style={{ fontWeight: 700, color: "#e8d5b0", marginTop: "0.6rem" }}>
              {line.replace(/\*\*/g, "")}
            </div>
          );
        }
        if (/^[-•*]\s/.test(line)) {
          const content = line
            .replace(/^[-•*]\s/, "")
            .replace(/\*\*(.*?)\*\*/g, "<strong style='color:#e8d5b0'>$1</strong>");
          return (
            <div
              key={i}
              style={{ display: "flex", gap: "0.5rem", paddingLeft: "0.5rem", lineHeight: 1.75, color: "#c8b89a" }}
            >
              <span style={{ color: "#c8a96e", flexShrink: 0 }}>◆</span>
              <span dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} style={{ height: "0.55rem" }} />;
        const html = line
          .replace(/\*\*(.*?)\*\*/g, "<strong style='color:#e8d5b0'>$1</strong>")
          .replace(/\*(.*?)\*/g, "<em>$1</em>");
        return (
          <div
            key={i}
            style={{ color: "#c8b89a", lineHeight: 1.8 }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}
