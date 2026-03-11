export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface SearchResponse {
  results: SearchResult[];
}

// ─── Tavily Search ────────────────────────────────────────────────────────────

export async function tavilySearch(
  query: string,
  options: {
    maxResults?: number;
    includeDomains?: string[];
    searchDepth?: "basic" | "advanced";
  } = {}
): Promise<SearchResult[]> {
  const { maxResults = 6, includeDomains = [], searchDepth = "advanced" } = options;

  const body: Record<string, unknown> = {
    api_key: process.env.TAVILY_API_KEY,
    query,
    search_depth: searchDepth,
    max_results: maxResults,
    include_answer: false,
    include_raw_content: false,
  };

  if (includeDomains.length > 0) {
    body.include_domains = includeDomains;
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`Tavily error: ${res.status} ${res.statusText}`);
    return [];
  }

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

    // Trim to ~2000 chars to avoid token bloat
    return result.raw_content.slice(0, 2000);
  } catch {
    return "";
  }
}

// ─── Multi-Round Search ───────────────────────────────────────────────────────

export async function multiRoundSearch(
  queries: string[],
  priorityDomains: string[],
  onProgress?: (msg: string) => void
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  const seen = new Set<string>();

  // Round 1: Broad search across all queries in parallel
  onProgress?.("Searching trusted sources…");
  const round1 = await Promise.allSettled(
    queries.slice(0, 3).map((q) =>
      tavilySearch(q, {
        maxResults: 5,
        searchDepth: "advanced",
      })
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

  // Round 2: Priority domain search for higher-quality results
  if (priorityDomains.length > 0 && queries.length > 0) {
    onProgress?.(`Searching specialist sources…`);
    const round2 = await Promise.allSettled(
      queries.slice(0, 2).map((q) =>
        tavilySearch(q, {
          maxResults: 4,
          includeDomains: priorityDomains,
          searchDepth: "advanced",
        })
      )
    );

    for (const r of round2) {
      if (r.status === "fulfilled") {
        for (const result of r.value) {
          if (!seen.has(result.url)) {
            seen.add(result.url);
            // Boost priority domain results to top
            allResults.unshift(result);
          }
        }
      }
    }
  }

  // Round 3: Scrape full content from top 3 results
  onProgress?.("Reading full articles…");
  const topResults = allResults.slice(0, 3);
  const scrapePromises = topResults.map(async (result) => {
    const fullContent = await scrapeArticle(result.url);
    if (fullContent && fullContent.length > result.content.length) {
      result.content = fullContent;
    }
    return result;
  });

  await Promise.allSettled(scrapePromises);

  return allResults.slice(0, 10);
}
