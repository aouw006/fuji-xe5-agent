import { NextRequest } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VOYAGE_KEY = process.env.VOYAGE_API_KEY!;

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#8217;/g, "'").replace(/&#8216;/g, "'").replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&#\d+;/g, "").replace(/&[a-z]+;/g, " ")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\uFFFD/g, "")
    .normalize("NFC")
    .trim();
}

function extractTitle(html: string): string {
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1];
  if (og) return og;
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  return title?.trim().replace(/ [-|] .*$/, "") || "";
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
    if (i + 200 >= text.length) break;
  }
  if (i < text.length) chunks.push(text.slice(i));
  return chunks.filter(c => c.trim().length > 100);
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const safe = texts.map(t =>
    Buffer.from(t, "utf8").toString("utf8")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
      .replace(/\uFFFD/g, "")
      .replace(/[\uD800-\uDFFF]/g, "")
      .normalize("NFC")
  );

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${VOYAGE_KEY}` },
    body: JSON.stringify({ model: "voyage-3-lite", input: safe }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage API error: ${err}`);
  }
  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

async function supabaseFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${err}`);
  }
  return res.json();
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { url, agent_id } = await req.json();
    if (!url || !agent_id) return Response.json({ error: "Missing url or agent_id" }, { status: 400 });

    // Check if already ingested
    const existing = await supabaseFetch(
      `/document_chunks?url=eq.${encodeURIComponent(url)}&select=id&limit=1`
    );
    if (Array.isArray(existing) && existing.length > 0) {
      return Response.json({ skipped: true, url });
    }

    // Fetch the page
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RAG-ingestion/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`);
    const html = await pageRes.text();

    const title = extractTitle(html);
    const text = cleanText(html);
    if (text.length < 200) throw new Error("Page too short or blocked");

    // Chunk
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("No chunks produced");

    // Embed in batches of 64
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += 64) {
      const batch = await embedBatch(chunks.slice(i, i + 64));
      allEmbeddings.push(...batch);
    }

    // Store in Supabase
    const rows = chunks.map((content, i) => ({
      url,
      title: title || url,
      chunk_index: i,
      content,
      embedding: allEmbeddings[i],
      agent_id,
    }));

    // Insert in batches of 20
    for (let i = 0; i < rows.length; i += 20) {
      await supabaseFetch("/document_chunks", {
        method: "POST",
        body: JSON.stringify(rows.slice(i, i + 20)),
      });
    }

    return Response.json({ ok: true, url, title, chunks: chunks.length, agent_id });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
