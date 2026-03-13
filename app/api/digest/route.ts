import { NextRequest, NextResponse } from "next/server";

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

// ─── RSS Feed definitions ─────────────────────────────────────────────────────

const FEEDS: { url: string; source: string; category: DigestStory["category"]; maxItems: number }[] = [
  { url: "https://fujixweekly.com/feed/",                   source: "Fuji X Weekly",     category: "recipes",   maxItems: 4 },
  { url: "https://www.dpreview.com/feeds/news.xml",         source: "DPReview",          category: "news",      maxItems: 3 },
  { url: "https://petapixel.com/feed/",                     source: "PetaPixel",         category: "news",      maxItems: 3 },
  { url: "https://mirrorlessons.com/feed/",                 source: "Mirrorlessons",     category: "gear",      maxItems: 2 },
  { url: "https://www.fujilove.com/feed/",                  source: "Fujilove",          category: "community", maxItems: 2 },
  { url: "https://www.reddit.com/r/fujifilm/.rss",          source: "Reddit/r/fujifilm", category: "community", maxItems: 3 },
];

// ─── Supabase cache ───────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours for RSS (updates more frequently)

async function getCachedDigest(): Promise<DigestData | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/digest_cache?select=data,created_at&order=created_at.desc&limit=1`, {
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
    await fetch(`${SUPABASE_URL}/rest/v1/digest_cache`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    });
    await fetch(`${SUPABASE_URL}/rest/v1/digest_cache`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ data }),
    });
  } catch {}
}

// ─── RSS Parser ───────────────────────────────────────────────────────────────

function extractText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function extractImageFromHtml(html: string): string | null {
  // Try src from img tags, skip tiny tracker pixels
  const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = m[1];
    if (src.startsWith("http") && !src.includes("pixel") && !src.includes("tracker") && !src.includes("1x1")) {
      return src;
    }
  }
  return null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#\d+;/g, "");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

interface RssItem {
  title: string;
  url: string;
  summary: string;
  image: string | null;
  publishedAt: string;
}

function parseRssItems(xml: string, maxItems: number): RssItem[] {
  const items: RssItem[] = [];

  // Split on <item> or <entry> (Atom)
  const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;

  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const block = itemMatch[1];

    const title = decodeHtmlEntities(stripHtml(extractText(block, "title")));
    const link = extractText(block, "link") ||
                 extractAttr(block, "link", "href") ||
                 block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] || "";
    const url = link.trim();

    if (!title || !url) continue;

    // Summary from description or content
    // Prefer content:encoded (full HTML) over description for image extraction
    const contentEncoded = extractText(block, "content:encoded");
    const descRaw = contentEncoded ||
                    extractText(block, "description") ||
                    extractText(block, "content") ||
                    extractText(block, "summary");
    const summary = stripHtml(descRaw).slice(0, 220).trim() + (descRaw.length > 220 ? "…" : "");

    // Image: try enclosure → media:content → media:thumbnail → first img in content
    let image: string | null = null;

    // <enclosure url="..." type="image/..."/>
    const enclosure = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image[^"']*["']/i) ||
                      block.match(/<enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']+)["']/i);
    if (enclosure) image = enclosure[1];

    // <media:content url="..." medium="image"/>
    if (!image) {
      const media = block.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*medium=["']image["']/i) ||
                    block.match(/<media:content[^>]+url=["']([^"']+\.(jpg|jpeg|png|webp))[^"']*["']/i);
      if (media) image = media[1];
    }

    // <media:thumbnail url="..."/>
    if (!image) {
      const thumb = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
      if (thumb) image = thumb[1];
    }

    // First <img> in description HTML
    if (!image && descRaw) {
      image = extractImageFromHtml(descRaw);
    }

    const pubDate = extractText(block, "pubDate") ||
                    extractText(block, "published") ||
                    extractText(block, "updated") ||
                    new Date().toISOString();

    items.push({ title, url, summary, image, publishedAt: pubDate });
  }

  return items;
}

// ─── Fetch a single feed ──────────────────────────────────────────────────────

async function fetchFeed(feed: typeof FEEDS[0]): Promise<DigestStory[]> {
  try {
    const res = await fetch(feed.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FujiDaily/1.0; RSS reader)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = parseRssItems(xml, feed.maxItems);

    return items.map((item, i) => ({
      id: `${feed.source}-${i}`,
      title: item.title,
      summary: item.summary,
      url: item.url,
      source: feed.source,
      image: item.image,
      category: feed.category,
      publishedAt: item.publishedAt,
    }));
  } catch {
    return [];
  }
}

// ─── Filter for Fujifilm relevance (for general feeds like DPReview) ──────────

function isFujiRelevant(story: DigestStory): boolean {
  const text = (story.title + " " + story.summary).toLowerCase();
  // Always include Fuji-specific sources
  if (["Fuji X Weekly", "Fujilove", "Mirrorlessons", "Reddit/r/fujifilm"].includes(story.source)) return true;
  // Filter general news sites to Fuji-related content
  return /fuji|x-e5|x-e4|x-t|x-pro|x-s|gfx|fujinon|xf lens|xc lens|fujifilm/.test(text);
}

// ─── Build digest ─────────────────────────────────────────────────────────────

async function buildDigest(): Promise<DigestData> {
  // Fetch all feeds in parallel
  const feedResults = await Promise.all(FEEDS.map(fetchFeed));
  const allStories = feedResults.flat();

  // Filter for relevance
  const relevant = allStories.filter(isFujiRelevant);

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = relevant.filter(s => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  // Sort by date (newest first)
  unique.sort((a, b) => {
    try { return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(); }
    catch { return 0; }
  });

  return { stories: unique.slice(0, 12), generatedAt: new Date().toISOString() };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  if (debug) {
    // Fetch just one feed and return raw result
    const stories = await fetchFeed(FEEDS[0]);
    return NextResponse.json({ debug: true, feed: FEEDS[0].url, count: stories.length, stories: stories.slice(0, 2) });
  }

  if (!force) {
    const cached = await getCachedDigest();
    if (cached) return NextResponse.json(cached);
  }

  const digest = await buildDigest();
  await saveDigestCache(digest);
  return NextResponse.json(digest);
}