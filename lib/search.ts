export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface SearchResponse {
  results: SearchResult[];
}

// ─── Query Variation ──────────────────────────────────────────────────────────

const SYNONYMS: Record<string, string[]> = {
  "film recipe":   ["film simulation recipe", "jpeg recipe", "film look", "color recipe"],
  "settings":      ["configuration", "setup guide", "custom settings", "menu options"],
  "review":        ["hands-on", "field test", "real world test", "long term review"],
  "tips":          ["tricks", "techniques", "hidden features", "pro tips"],
  "best":          ["top", "recommended", "ideal", "favourite"],
  "street":        ["street photography", "candid", "documentary photography"],
  "portrait":      ["portrait photography", "people photography"],
  "lens":          ["optic", "fujinon", "XF lens", "glass"],
  "guide":         ["tutorial", "walkthrough", "how to", "deep dive"],
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_TERMS = [CURRENT_YEAR.toString(), (CURRENT_YEAR - 1).toString(), "latest", "2025", "2024"];

function varyQuery(query: string, seed: number): string {
  let varied = query;

  for (const [term, alternatives] of Object.entries(SYNONYMS)) {
    const regex = new RegExp(`\\b${term}\\b`, "i");
    if (regex.test(varied)) {
      varied = varied.replace(regex, alternatives[seed % alternatives.length]);
      break;
    }
  }

  if (seed % 2 === 0 && !YEAR_TERMS.some(y => varied.includes(y))) {
    varied = `${varied} ${YEAR_TERMS[seed % YEAR_TERMS.length]}`;
  }

  return varied;
}

// ─── Domain Helpers ───────────────────────────────────────────────────────────

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

// ─── Session URL Seen Tracking ────────────────────────────────────────────────
// Module-scope — resets on cold start. Prevents returning same pages repeatedly.

const seenUrls = new Set<string>();
const seenDomains = new Map<string, number>();

export function markUrlSeen(url: string) {
  seenUrls.add(url);
  const domain = getDomain(url);
  seenDomains.set(domain, (seenDomains.get(domain) || 0) + 1);
}

export function clearSeenUrls() {
  seenUrls.clear();
  seenDomains.clear();
}

function scoreResult(result: SearchResult): number {
  let score = result.score ?? 0.5;
  const domain = getDomain(result.url);

  // Penalise domains we've returned repeatedly
  const hits = seenDomains.get(domain) || 0;
  score -= hits * 0.15;

  // Penalise already-returned URLs
  if (seenUrls.has(result.url)) score -= 1.0;

  // Boost fresh content (year in title or URL)
  const text = `${result.title} ${result.url}`.toLowerCase();
  if (text.includes("2025") || text.includes("2024")) score += 0.2;

  return score;
}

function sampleResults(results: SearchResult[], maxPerDomain: number, total: number, seed: number): SearchResult[] {
  // Shuffle deterministically using seed
  let s = seed;
  const shuffled = [...results].sort(() => {
    const h = Math.sin(s++) * 10000;
    return (h - Math.floor(h)) - 0.5;
  });

  const domainCount: Record<string, number> = {};
  const sampled: SearchResult[] = [];

  for (const r of shuffled) {
    const domain = getDomain(r.url);
    domainCount[domain] = (domainCount[domain] || 0) + 1;
    if (domainCount[domain] <= maxPerDomain) sampled.push(r);
    if (sampled.length >= total) break;
  }

  // Fill remaining slots if needed
  for (const r of shuffled) {
    if (!sampled.includes(r) && sampled.length < total) sampled.push(r);
  }

  return sampled;
}

// ─── Tavily Search ────────────────────────────────────────────────────────────

export async function tavilySearch(
  query: string,
  options: {
    maxResults?: number;
    includeDomains?: string[];
    excludeDomains?: string[];
    searchDepth?: "basic" | "advanced";
  } = {}
): Promise<SearchResult[]> {
  const { maxResults = 6, includeDomains = [], excludeDomains = [], searchDepth = "advanced" } = options;

  const body: Record<string, unknown> = {
    api_key: process.env.TAVILY_API_KEY,
    query,
    search_depth: searchDepth,
    max_results: maxResults,
    include_answer: false,
    include_raw_content: false,
  };

  if (includeDomains.length > 0) body.include_domains = includeDomains;
  if (excludeDomains.length > 0) body.exclude_domains = excludeDomains;

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) return [];

  const data: SearchResponse = await res.json();
  return data.results || [];
}

// ─── Full Article Scraper ─────────────────────────────────────────────────────

export async function scrapeArticle(url: string): Promise<string> {
  try {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        urls: [url],
      }),
    });

    if (!res.ok) return "";
    const data = await res.json();
    const result = data.results?.[0];
    if (!result?.raw_content) return "";
    return result.raw_content.slice(0, 2000);
  } catch {
    return "";
  }
}

// ─── Multi-Round Search ───────────────────────────────────────────────────────

export async function multiRoundSearch(
  queries: string[],
  priorityDomains: string[],
  onProgress?: (msg: string) => void,
  callSeed?: number
): Promise<SearchResult[]> {
  const seed = callSeed ?? (Date.now() % 997);
  const seen = new Set<string>();
  const allResults: SearchResult[] = [];

  // Vary queries using seed for freshness
  const variedQueries = queries.map((q, i) => varyQuery(q, seed + i));

  // Exclude heavily-overrepresented domains
  const excludeDomains = Array.from(seenDomains.entries())
    .filter(([, count]) => count >= 3)
    .map(([domain]) => domain)
    .slice(0, 5);

  // Round 1: Broad search
  onProgress?.("Searching trusted sources…");
  const round1 = await Promise.allSettled(
    variedQueries.slice(0, 3).map((q) =>
      tavilySearch(q, { maxResults: 7, excludeDomains, searchDepth: "advanced" })
    )
  );

  for (const r of round1) {
    if (r.status === "fulfilled") {
      for (const result of r.value) {
        if (!seen.has(result.url)) {
          seen.add(result.url);
          allResults.push(result);
        }
      }
    }
  }

  // Round 2: Priority domains with different query variation
  if (priorityDomains.length > 0 && queries.length > 0) {
    onProgress?.("Searching specialist sources…");
    const priorityQueries = queries.slice(0, 2).map((q, i) => varyQuery(q, seed + 50 + i));

    const round2 = await Promise.allSettled(
      priorityQueries.map((q) =>
        tavilySearch(q, { maxResults: 5, includeDomains: priorityDomains, searchDepth: "advanced" })
      )
    );

    for (const r of round2) {
      if (r.status === "fulfilled") {
        for (const result of r.value) {
          if (!seen.has(result.url)) {
            seen.add(result.url);
            allResults.unshift(result);
          }
        }
      }
    }
  }

  // Score (freshness + seen penalty), then sample to diversify domains
  const scored = allResults
    .map(r => ({ result: r, score: scoreResult(r) }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.result);

  const sampled = sampleResults(scored, 2, 12, seed);

  // Round 3: Scrape top results
  onProgress?.("Reading full articles…");
  await Promise.allSettled(
    sampled.slice(0, 4).map(async (result) => {
      const fullContent = await scrapeArticle(result.url);
      if (fullContent && fullContent.length > result.content.length) {
        result.content = fullContent;
      }
    })
  );

  // Mark returned URLs as seen for next call
  sampled.slice(0, 10).forEach(r => markUrlSeen(r.url));

  return sampled.slice(0, 10);
}
