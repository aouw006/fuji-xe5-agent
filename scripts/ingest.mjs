/**
 * RAG Ingestion Script
 * Run with: node scripts/ingest.mjs
 *
 * Fetches curated URLs, splits into chunks, embeds with Voyage AI,
 * stores in Supabase pgvector table.
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VOYAGE_KEY = process.env.VOYAGE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !VOYAGE_KEY) {
  console.error("Missing env vars — check .env.local");
  process.exit(1);
}

// ─── Curated sources ──────────────────────────────────────────────────────────
// Add/remove URLs here. agent_id routes chunks to the right specialist agent.
const SOURCES = [
  // Film Recipes
  { url: "https://fujixweekly.com/2024/03/28/fujifilm-x-e5-film-simulation-recipes/", agent_id: "film_recipes" },
  { url: "https://fujixweekly.com/recipes/", agent_id: "film_recipes" },

  // Camera Settings
  { url: "https://fujixweekly.com/2024/03/28/fujifilm-x-e5-settings-guide/", agent_id: "camera_settings" },

  // Gear
  { url: "https://www.mirrorlessons.com/fujifilm-x-e5-review/", agent_id: "gear" },

  // Comparison
  { url: "https://www.dpreview.com/reviews/fujifilm-x-e5-review", agent_id: "comparison" },

  // Community / General
  { url: "https://fujixweekly.com/2024/03/28/fujifilm-x-e5-review/", agent_id: "community" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch a URL and return plain text (strips HTML tags) */
async function fetchText(url) {
  try {
    console.log(`  Fetching ${url}`);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RAG-ingestion/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Strip scripts, styles, nav, footer, header elements
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")           // strip remaining tags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s{2,}/g, " ")            // collapse whitespace
      .trim();

    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    return { text, title };
  } catch (e) {
    console.warn(`  ⚠ Failed to fetch ${url}: ${e.message}`);
    return null;
  }
}

/** Split text into overlapping chunks of ~300 tokens (~1200 chars) */
function chunkText(text, chunkSize = 1200, overlap = 200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 100) chunks.push(chunk); // skip tiny chunks
    start += chunkSize - overlap;
  }
  return chunks;
}

/** Embed an array of strings with Voyage AI (batch up to 128 at a time) */
async function embedBatch(texts) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${VOYAGE_KEY}`,
    },
    body: JSON.stringify({
      model: "voyage-3-lite",   // free tier, 512 dimensions, fast
      input: texts,
      input_type: "document",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage API error: ${err}`);
  }

  const data = await res.json();
  return data.data.map(d => d.embedding);
}

/** Upsert chunks into Supabase */
async function upsertChunks(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/document_chunks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "apikey": SUPABASE_KEY,
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase upsert error: ${err}`);
  }
}

/** Delete existing chunks for a URL before re-ingesting */
async function deleteExisting(url) {
  await fetch(`${SUPABASE_URL}/rest/v1/document_chunks?url=eq.${encodeURIComponent(url)}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "apikey": SUPABASE_KEY,
    },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 Starting ingestion of ${SOURCES.length} sources\n`);
  let totalChunks = 0;

  for (const source of SOURCES) {
    console.log(`\n📄 ${source.url}`);

    // Fetch page text
    const result = await fetchText(source.url);
    if (!result) continue;

    const { text, title } = result;
    console.log(`  Title: ${title}`);
    console.log(`  Text length: ${text.length} chars`);

    // Split into chunks
    const chunks = chunkText(text);
    console.log(`  Chunks: ${chunks.length}`);

    if (chunks.length === 0) {
      console.warn("  ⚠ No chunks produced, skipping");
      continue;
    }

    // Embed in batches of 64
    const BATCH = 64;
    const allEmbeddings = [];
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      process.stdout.write(`  Embedding batch ${Math.floor(i/BATCH)+1}/${Math.ceil(chunks.length/BATCH)}...`);
      const embeddings = await embedBatch(batch);
      allEmbeddings.push(...embeddings);
      process.stdout.write(" ✓\n");
    }

    // Delete old chunks for this URL
    await deleteExisting(source.url);

    // Build rows
    const rows = chunks.map((content, i) => ({
      url: source.url,
      title,
      chunk_index: i,
      content,
      embedding: allEmbeddings[i],
      agent_id: source.agent_id,
    }));

    // Upsert to Supabase
    await upsertChunks(rows);
    console.log(`  ✅ Stored ${rows.length} chunks`);
    totalChunks += rows.length;

    // Small delay to be polite to servers
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✨ Done! Total chunks stored: ${totalChunks}\n`);
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
