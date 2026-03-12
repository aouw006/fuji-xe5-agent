/**
 * RAG Ingestion Script
 * Run with: node scripts/ingest.mjs
 *
 * Auto-discovers URLs from sitemaps (handles nested sitemap indexes),
 * splits into chunks, embeds with Voyage AI, stores in Supabase pgvector.
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

// ─── Sitemap sources ──────────────────────────────────────────────────────────
// filter: URL must contain at least one of these strings (case-insensitive)
// agent_id: which specialist agent these chunks belong to
const SITEMAPS = [
  {
    // Only X-E5 specific pages and film simulation recipes
    url: "https://fujixweekly.com/sitemap.xml",
    filter: ["x-e5", "x-trans-v-film-simulation-recipe", "film-simulation-recipe"],
    agent_id: "film_recipes",
    agent_id_overrides: {
      "settings": "camera_settings",
      "review": "community",
      "lens": "gear",
      "accessory": "gear",
    },
  },
  {
    // Only recipe-specific pages on film.recipes
    url: "https://film.recipes/sitemap.xml",
    filter: ["film-recipe", "film-recipes/", "nightwalker", "vintage-mood"],
    agent_id: "film_recipes",
  },
];

// Manual URLs to always include (fallback / supplements)
const MANUAL_SOURCES = [
  { url: "https://fujixweekly.com/recipes/", agent_id: "film_recipes" },
  { url: "https://fujixweekly.com/2025/07/30/review-fujifilm-x-e5-pancakes-recipes/", agent_id: "community" },
];

// ─── Sitemap parsing ──────────────────────────────────────────────────────────

async function fetchXml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RAG-ingestion/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function extractTags(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const matches = [];
  let m;
  while ((m = regex.exec(xml)) !== null) matches.push(m[1].trim());
  return matches;
}

/** Recursively resolve a sitemap — handles both index and regular sitemaps */
async function resolveSitemap(url, depth = 0) {
  if (depth > 3) return []; // safety limit
  console.log(`  ${"  ".repeat(depth)}📋 Fetching sitemap: ${url}`);

  let xml;
  try {
    xml = await fetchXml(url);
  } catch (e) {
    console.warn(`  ⚠ Failed to fetch sitemap ${url}: ${e.message}`);
    return [];
  }

  // Sitemap index — contains child sitemaps
  if (xml.includes("<sitemapindex")) {
    const childUrls = extractTags(xml, "loc")
      .filter(u => u.endsWith(".xml") || u.includes("sitemap"))
      .filter(u => !u.includes("image-sitemap") && !u.includes("video-sitemap"));
    console.log(`  ${"  ".repeat(depth)}↳ Index with ${childUrls.length} child sitemaps`);
    const allUrls = [];
    for (const childUrl of childUrls) {
      const urls = await resolveSitemap(childUrl, depth + 1);
      allUrls.push(...urls);
      await sleep(300);
    }
    return allUrls;
  }

  // Regular sitemap — contains page URLs
  const urls = extractTags(xml, "loc").filter(u => !u.endsWith(".xml"));
  console.log(`  ${"  ".repeat(depth)}↳ Found ${urls.length} URLs`);
  return urls;
}

/** Filter URLs by keyword list */
function filterUrls(urls, keywords) {
  return urls.filter(url =>
    keywords.some(kw => url.toLowerCase().includes(kw.toLowerCase()))
  );
}

/** Determine agent_id from URL using overrides */
function getAgentId(url, defaultAgentId, overrides = {}) {
  for (const [keyword, agentId] of Object.entries(overrides)) {
    if (url.toLowerCase().includes(keyword)) return agentId;
  }
  return defaultAgentId;
}

// ─── Text processing ──────────────────────────────────────────────────────────

async function fetchText(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RAG-ingestion/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<aside[\s\S]*?<\/aside>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
      .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
      .replace(/&#8211;/g, "–").replace(/&#8212;/g, "—")
      .replace(/&#038;/g, "&").replace(/&#\d+;/g, "")
      .replace(/\s{2,}/g, " ")
      // Strip non-UTF-8 / non-printable characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
      .replace(/\uFFFD/g, "")
      .replace(/[\uD800-\uDFFF]/g, "")
      .normalize("NFC")
      .trim();
    // Force re-encode through Buffer to catch any remaining invalid sequences
    text = Buffer.from(text, "utf8").toString("utf8");

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s*[|\-–].*/,"").trim() : url;

    return { text, title };
  } catch (e) {
    console.warn(`    ⚠ Failed: ${e.message}`);
    return null;
  }
}

function chunkText(text, chunkSize = 1200, overlap = 200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 100) chunks.push(chunk);
    start += chunkSize - overlap;
  }
  return chunks;
}

// ─── Voyage embeddings ────────────────────────────────────────────────────────

async function embedBatch(texts) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_KEY}`,
    },
    body: JSON.stringify({
      model: "voyage-3-lite",
      input: texts,
      input_type: "document",
    }),
  });

  if (!res.ok) throw new Error(`Voyage API error: ${await res.text()}`);
  const data = await res.json();
  return data.data.map(d => d.embedding);
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

async function deleteExisting(url) {
  await fetch(`${SUPABASE_URL}/rest/v1/document_chunks?url=eq.${encodeURIComponent(url)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY },
  });
}

async function upsertChunks(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/document_chunks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase upsert error: ${await res.text()}`);
}

async function getExistingUrls() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/document_chunks?select=url&limit=1000`, {
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY },
  });
  if (!res.ok) return new Set();
  const rows = await res.json();
  return new Set(rows.map(r => r.url));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Main ─────────────────────────────────────────────────────────────────────

async function ingestUrl(url, agentId, existingUrls, stats) {
  if (existingUrls.has(url)) {
    stats.skipped++;
    return;
  }

  process.stdout.write(`  → ${url.slice(0, 80)}... `);
  const result = await fetchText(url);
  if (!result) { stats.failed++; return; }

  const { text, title } = result;
  const chunks = chunkText(text);
  if (chunks.length === 0) { process.stdout.write("(no content)\n"); stats.failed++; return; }

  // Aggressively sanitise chunks — force through Buffer to strip any invalid UTF-8
  const safeChunks = chunks.map(ch => {
    // Round-trip through Buffer to drop any invalid byte sequences
    const clean = Buffer.from(ch, "utf8").toString("utf8");
    return clean
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")  // control chars
      .replace(/\uFFFD/g, "")                                          // replacement char (bad bytes)
      .replace(/[\uD800-\uDFFF]/g, "")                                // lone surrogates
      .normalize("NFC")
      .trim();
  }).filter(ch => ch.length > 20); // drop any chunks that became too short

  // Embed in batches of 64
  const allEmbeddings = [];
  for (let i = 0; i < chunks.length; i += 64) {
    const embeddings = await embedBatch(safeChunks.slice(i, i + 64));
    allEmbeddings.push(...embeddings);
  }

  await deleteExisting(url);
  await upsertChunks(chunks.map((content, i) => ({
    url, title, chunk_index: i, content,
    embedding: allEmbeddings[i], agent_id: agentId,
  })));

  process.stdout.write(`✅ ${chunks.length} chunks\n`);
  stats.ingested++;
  stats.totalChunks += chunks.length;
}

async function main() {
  console.log("\n🚀 Starting sitemap-driven ingestion\n");
  const stats = { ingested: 0, skipped: 0, failed: 0, totalChunks: 0 };

  // Load already-ingested URLs to skip re-ingestion
  process.stdout.write("Loading existing URLs from Supabase... ");
  const existingUrls = await getExistingUrls();
  console.log(`${existingUrls.size} already ingested\n`);

  // ── Sitemap sources ──
  for (const source of SITEMAPS) {
    console.log(`\n📡 Sitemap: ${source.url}`);
    const allUrls = await resolveSitemap(source.url);
    const filtered = filterUrls(allUrls, source.filter);
    console.log(`  Matched ${filtered.length} / ${allUrls.length} URLs after filtering\n`);

    for (const url of filtered) {
      const agentId = getAgentId(url, source.agent_id, source.agent_id_overrides);
      await ingestUrl(url, agentId, existingUrls, stats);
      await sleep(800); // polite delay between requests
    }
  }

  // ── Manual sources ──
  if (MANUAL_SOURCES.length > 0) {
    console.log(`\n📄 Manual sources (${MANUAL_SOURCES.length})`);
    for (const source of MANUAL_SOURCES) {
      await ingestUrl(source.url, source.agent_id, existingUrls, stats);
      await sleep(800);
    }
  }

  console.log(`\n✨ Done!`);
  console.log(`   Ingested: ${stats.ingested} pages (${stats.totalChunks} chunks)`);
  console.log(`   Skipped:  ${stats.skipped} (already in DB)`);
  console.log(`   Failed:   ${stats.failed}\n`);
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
