import { NextRequest, NextResponse } from "next/server";
import { tavilySearch } from "@/lib/search";

export const maxDuration = 55;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DigestStory {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  image: string | null;
  category: "news" | "recipes" | "gear" | "community";
  publishedAt: string;
}

export interface DigestData {
  stories: DigestStory[];
  generatedAt: string;
}

// ─── Supabase helpers (inline to avoid import issues) ────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CACHE_TABLE = "digest_cache";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function getCachedDigest(): Promise<DigestData | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${CACHE_TABLE}?select=data,created_at&order=created_at.desc&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.length) return null;
    const age = Date.now() - new Date(rows[0].created_at).getTime();
    if (age > CACHE_TTL_MS) return null;
    return rows[0].data as DigestData;
  } catch { return null; }
}

async function saveDigestCache(data: DigestData): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    // Clear old rows first
    await fetch(`${SUPABASE_URL}/rest/v1/${CACHE_TABLE}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    });
    await fetch(`${SUPABASE_URL}/rest/v1/${CACHE_TABLE}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ data }),
    });
  } catch {}
}

// ─── og:image scraper ─────────────────────────────────────────────────────────

async function scrapeOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (!match) return null;
    let imgUrl = match[1];
    // Make relative URLs absolute
    if (imgUrl.startsWith("/")) {
      const base = new URL(url);
      imgUrl = `${base.protocol}//${base.host}${imgUrl}`;
    }
    return imgUrl;
  } catch { return null; }
}

// ─── Tavily image search fallback ─────────────────────────────────────────────

async function tavilyImageSearch(query: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results: 3,
        include_images: true,
        include_answer: false,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.images?.[0] || null;
  } catch { return null; }
}

// ─── Extract domain for display ───────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    const map: Record<string, string> = {
      "fujixweekly.com": "Fuji X Weekly",
      "dpreview.com": "DPReview",
      "petapixel.com": "PetaPixel",
      "bhphotovideo.com": "B&H",
      "mirrorlessons.com": "Mirrorlessons",
      "fujilove.com": "Fujilove",
      "fujifilm.com": "Fujifilm",
      "reddit.com": "Reddit",
      "youtube.com": "YouTube",
      "kenrockwell.com": "Ken Rockwell",
      "imaging-resource.com": "Imaging Resource",
    };
    return map[host] || host;
  } catch { return url; }
}

// ─── Build digest ─────────────────────────────────────────────────────────────

const SEARCHES: { category: DigestStory["category"]; query: string; maxResults: number }[] = [
  { category: "news",      query: "Fujifilm X-E5 news firmware update 2025",          maxResults: 3 },
  { category: "recipes",   query: "Fujifilm film simulation recipe fujixweekly 2025",  maxResults: 3 },
  { category: "gear",      query: "Fujifilm XF lens accessory review 2025",            maxResults: 2 },
  { category: "community", query: "Fujifilm X-E5 reddit community tips photographers", maxResults: 2 },
];

async function buildDigest(): Promise<DigestData> {
  // Run searches sequentially to avoid overwhelming limits
  const allResults: Array<{ title: string; url: string; content: string; category: string }> = [];

  for (const s of SEARCHES) {
    try {
      const results = await tavilySearch(s.query, { maxResults: s.maxResults, searchDepth: "basic" });
      for (const r of results) allResults.push({ ...r, category: s.category });
    } catch {
      // continue with other searches
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = allResults.filter(r => {
    if (!r.url || !r.title) return false;
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Build stories first without images so we always return something
  const stories: DigestStory[] = unique.map((r, i) => ({
    id: `story-${i}`,
    title: r.title,
    summary: r.content?.slice(0, 200).trim() + "…" || "",
    url: r.url,
    source: extractDomain(r.url),
    image: null,
    category: r.category as DigestStory["category"],
    publishedAt: new Date().toISOString(),
  }));

  // Fetch images with a global timeout — skip any that are slow
  const imagePromises = stories.map(async (story, i) => {
    try {
      const img = await Promise.race([
        scrapeOgImage(story.url),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
      ]);
      if (img) stories[i].image = img;
    } catch {}
  });

  // Wait max 15s for all images
  await Promise.race([
    Promise.all(imagePromises),
    new Promise(resolve => setTimeout(resolve, 15000)),
  ]);

  return { stories, generatedAt: new Date().toISOString() };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  // Debug mode: call Tavily directly and surface any error
  if (debug) {
    const key = process.env.TAVILY_API_KEY;
    if (!key) return NextResponse.json({ debug: true, error: "TAVILY_API_KEY not set", env: Object.keys(process.env).filter(k => k.includes("TAVILY")) });
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, query: "Fujifilm X-E5 2025", search_depth: "basic", max_results: 2 }),
      });
      const text = await res.text();
      return NextResponse.json({ debug: true, status: res.status, keyPrefix: key.slice(0, 8), response: text.slice(0, 500) });
    } catch (e) {
      return NextResponse.json({ debug: true, error: String(e) });
    }
  }

  if (!force) {
    const cached = await getCachedDigest();
    if (cached) return NextResponse.json(cached);
  }

  const digest = await buildDigest();
  await saveDigestCache(digest);
  return NextResponse.json(digest);
}