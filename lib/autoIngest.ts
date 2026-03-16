/**
 * Auto-Ingest
 * Called fire-and-forget from agentLoop after a successful fetch_url.
 * Chunks, embeds, and stores the already-scraped content into document_chunks.
 * Deduplicates by URL — silently skips if already present.
 * Never throws — agent loop must never crash due to this.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VOYAGE_KEY = process.env.VOYAGE_API_KEY!;

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

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
    t
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
      .replace(/\uFFFD/g, "")
      .replace(/[\uD800-\uDFFF]/g, "")
      .normalize("NFC")
  );
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_KEY}`,
    },
    body: JSON.stringify({ model: "voyage-3-lite", input: safe, input_type: "document" }),
  });
  if (!res.ok) throw new Error(`Voyage error: ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

/**
 * Save a fetched page into the RAG knowledge base.
 *
 * @param url     - The canonical URL of the page
 * @param content - Plain text already scraped (not HTML)
 * @param title   - Page title (from search result or empty string)
 * @param agentId - Which agent fetched this (for byAgent breakdown in dashboard)
 */
export async function autoIngestUrl(
  url: string,
  content: string,
  title: string,
  agentId: string
): Promise<void> {
  if (!VOYAGE_KEY || !SUPABASE_KEY || !SUPABASE_URL) return;
  if (!content || content.length < 200) return;

  // Skip obviously bad URLs
  if (!url.startsWith("http")) return;

  try {
    // ── Dedup check ───────────────────────────────────────────────────────────
    const existRes = await fetch(
      `${SUPABASE_URL}/rest/v1/document_chunks?url=eq.${encodeURIComponent(url)}&select=id&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    if (existRes.ok) {
      const existing = await existRes.json();
      if (Array.isArray(existing) && existing.length > 0) {
        console.log(`[autoIngest] Already in KB, skipping: ${url}`);
        return;
      }
    }

    // ── Chunk ─────────────────────────────────────────────────────────────────
    const chunks = chunkText(content);
    if (chunks.length === 0) return;

    // ── Embed (batches of 64 — Voyage limit) ──────────────────────────────────
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += 64) {
      const batch = await embedBatch(chunks.slice(i, i + 64));
      allEmbeddings.push(...batch);
    }

    // ── Store (batches of 20 to keep request size reasonable) ─────────────────
    const rows = chunks.map((c, i) => ({
      url,
      title: title || url,
      chunk_index: i,
      content: c,
      embedding: allEmbeddings[i],
      agent_id: agentId,
    }));

    for (let i = 0; i < rows.length; i += 20) {
      await fetch(`${SUPABASE_URL}/rest/v1/document_chunks`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(rows.slice(i, i + 20)),
      });
    }

    console.log(`[autoIngest] ✓ Saved ${chunks.length} chunks from: ${url} (agent: ${agentId})`);
  } catch (e) {
    // Never let auto-ingest crash the agent loop
    console.error("[autoIngest] Non-fatal error:", e);
  }
}
