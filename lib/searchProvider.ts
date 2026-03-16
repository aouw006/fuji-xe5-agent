/**
 * Search Provider Abstraction
 * Routes search calls to Tavily or disables live search (none).
 * Logs every call to Supabase for credit tracking.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export type SearchProvider = "tavily" | "serper" | "none";

export interface ProviderSearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

let cachedProvider: SearchProvider | null = null;
let cacheExpiry = 0;

export async function getActiveProvider(): Promise<SearchProvider> {
  if (cachedProvider && Date.now() < cacheExpiry) return cachedProvider;
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) return "tavily";
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_settings?key=eq.active_search_provider&select=value`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) return "tavily";
    const data = await res.json();
    const provider = (data?.[0]?.value as SearchProvider) || "tavily";
    cachedProvider = provider;
    cacheExpiry = Date.now() + 60_000;
    return provider;
  } catch {
    return "tavily";
  }
}

export async function setActiveProvider(provider: SearchProvider): Promise<void> {
  cachedProvider = provider;
  cacheExpiry = Date.now() + 60_000;
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.active_search_provider`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ value: provider, updated_at: new Date().toISOString() }),
  });
}

export async function getTavilyLimit(): Promise<number> {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) return 1000;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_settings?key=eq.tavily_monthly_limit&select=value`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) return 1000;
    const data = await res.json();
    return parseInt(data?.[0]?.value) || 1000;
  } catch {
    return 1000;
  }
}

export async function setTavilyLimit(limit: number): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.tavily_monthly_limit`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ value: String(limit), updated_at: new Date().toISOString() }),
  });
}

// ─── Usage Logging ────────────────────────────────────────────────────────────

export async function logSearchUsage(
  resultsReturned: number,
  agentId?: string,
  sessionId?: string,
  isScrape = false,
  provider?: string
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/search_usage`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        provider: provider || "tavily",
        results_returned: resultsReturned,
        agent_id: agentId || null,
        session_id: sessionId || null,
        is_scrape: isScrape,
      }),
    });
  } catch {}
}

// ─── Search Stats ─────────────────────────────────────────────────────────────

export interface SearchStats {
  searches: number;
  scrapes: number;
  total: number;
  limit: number;
  remaining: number;
  pct: number;
  usageByDay: { date: string; count: number }[];
  usageByAgent: { agent_id: string; count: number }[];
  usageByProvider: { provider: string; count: number }[];
  activeProvider: SearchProvider;
}

export async function getSearchStats(): Promise<SearchStats> {
  const now = new Date();
  const firstOfMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01T00:00:00Z`;
  const [activeProvider, tavilyLimit] = await Promise.all([getActiveProvider(), getTavilyLimit()]);
  const limit = activeProvider === "serper" ? 2500 : tavilyLimit;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { searches: 0, scrapes: 0, total: 0, limit, remaining: limit, pct: 0, usageByDay: [], usageByAgent: [], usageByProvider: [], activeProvider };
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/search_usage?created_at=gte.${firstOfMonth}&select=is_scrape,agent_id,created_at,provider`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) throw new Error("Failed");
    const rows: { is_scrape: boolean; agent_id: string; created_at: string; provider?: string }[] = await res.json();

    let searches = 0, scrapes = 0;
    const dayMap: Record<string, number> = {};
    const agentMap: Record<string, number> = {};
    const providerMap: Record<string, number> = {};

    for (const row of rows) {
      if (row.is_scrape) scrapes++; else searches++;
      const date = row.created_at.slice(0, 10);
      dayMap[date] = (dayMap[date] || 0) + 1;
      const a = row.agent_id || "unknown";
      agentMap[a] = (agentMap[a] || 0) + 1;
      const p = row.provider || "tavily";
      providerMap[p] = (providerMap[p] || 0) + 1;
    }

    const total = searches + scrapes;
    const usageByDay = Object.entries(dayMap)
      .map(([date, count]) => ({ date: date.slice(5), count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const usageByAgent = Object.entries(agentMap)
      .map(([agent_id, count]) => ({ agent_id, count }))
      .sort((a, b) => b.count - a.count);
    const usageByProvider = Object.entries(providerMap)
      .map(([provider, count]) => ({ provider, count }))
      .sort((a, b) => b.count - a.count);

    const activeTotal = providerMap[activeProvider] ?? total;
    return {
      searches, scrapes, total: activeTotal, limit,
      remaining: Math.max(0, limit - activeTotal),
      pct: Math.min((activeTotal / limit) * 100, 100),
      usageByDay, usageByAgent, usageByProvider, activeProvider,
    };
  } catch {
    return { searches: 0, scrapes: 0, total: 0, limit, remaining: limit, pct: 0, usageByDay: [], usageByAgent: [], usageByProvider: [], activeProvider };
  }
}

// ─── Unified Search ───────────────────────────────────────────────────────────

export async function providerSearch(
  query: string,
  options: {
    maxResults?: number;
    includeDomains?: string[];
    excludeDomains?: string[];
    agentId?: string;
    sessionId?: string;
  } = {}
): Promise<ProviderSearchResult[]> {
  const provider = await getActiveProvider();
  if (provider === "none") return [];

  let results: ProviderSearchResult[] = [];

  if (provider === "serper") {
    const { serperSearch } = await import("@/lib/search");
    results = await serperSearch(query, { maxResults: options.maxResults });
  } else {
    const { tavilySearch } = await import("@/lib/search");
    results = await tavilySearch(query, {
      maxResults: options.maxResults,
      includeDomains: options.includeDomains,
      excludeDomains: options.excludeDomains,
    });
  }

  logSearchUsage(results.length, options.agentId, options.sessionId, false, provider);
  return results;
}

export async function providerScrape(
  url: string,
  agentId?: string,
  sessionId?: string
): Promise<string> {
  const provider = await getActiveProvider();
  if (provider === "none") return "";
  const { scrapeArticle } = await import("@/lib/search");
  const result = await scrapeArticle(url);
  if (result) logSearchUsage(0, agentId, sessionId, true);
  return result;
}
