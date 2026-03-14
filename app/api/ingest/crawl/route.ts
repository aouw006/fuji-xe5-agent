import { NextRequest } from "next/server";

const MAX_LINKS = 200;

function extractLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const hrefRegex = /href=["']([^"']+)["']/gi;
  const links = new Set<string>();
  let m;
  while ((m = hrefRegex.exec(html)) !== null) {
    try {
      const raw = m[1].split("#")[0].split("?")[0];
      if (!raw) continue;
      const resolved = new URL(raw, baseUrl);
      if (
        resolved.origin === base.origin &&
        (resolved.protocol === "http:" || resolved.protocol === "https:") &&
        !resolved.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|xml|css|js|ico|woff|woff2|ttf)$/i)
      ) {
        links.add(resolved.href);
      }
    } catch { /* invalid URL, skip */ }
  }
  return Array.from(links).slice(0, MAX_LINKS);
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return Response.json({ error: "Missing url" }, { status: 400 });

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RAG-ingestion/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const links = extractLinks(html, url);
    return Response.json({ links, count: links.length });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
