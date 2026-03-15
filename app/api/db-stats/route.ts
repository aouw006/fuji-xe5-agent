import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function q(path: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  return res.json();
}

async function count(path: string): Promise<number> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return 0;
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "count=exact",
      "Range-Unit": "items",
      Range: "0-0",
    },
    next: { revalidate: 0 },
  });
  const cr = res.headers.get("Content-Range");
  if (!cr) return 0;
  const m = cr.match(/\/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

export async function GET() {
  try {
    const [
      totalChunks,
      byAgent,
      recentChunksRaw,
      totalConversations,
      uniqueSessions,
      totalTokens,
      totalRecipes,
      agentPrompts,
    ] = await Promise.all([
      count("/document_chunks"),
      q("/document_chunks?select=agent_id&limit=10000"),
      q("/document_chunks?select=url,title,agent_id&order=id.desc&limit=20"),
      count("/conversations"),
      q("/conversations?select=session_id&limit=10000"),
      q("/token_usage?select=tokens_used&limit=10000"),
      count("/saved_recipes"),
      q("/agent_prompts?select=agent_id,updated_at"),
    ]);

    // Agent breakdown from chunks
    const agentChunkCounts: Record<string, number> = {};
    if (Array.isArray(byAgent)) {
      for (const row of byAgent) {
        const id = row.agent_id || "unknown";
        agentChunkCounts[id] = (agentChunkCounts[id] || 0) + 1;
      }
    }

    // Domain breakdown
    const domainCounts: Record<string, number> = {};
    if (Array.isArray(byAgent)) {
      // We need URLs for domain breakdown — fetch separately with url field
    }
    const urlRows = await q("/document_chunks?select=url&limit=10000");
    if (Array.isArray(urlRows)) {
      for (const row of urlRows) {
        try {
          const domain = new URL(row.url).hostname.replace(/^www\./, "");
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        } catch { /* skip */ }
      }
    }

    // Unique sessions
    const sessionSet = new Set<string>();
    if (Array.isArray(uniqueSessions)) {
      for (const r of uniqueSessions) sessionSet.add(r.session_id);
    }

    // Total tokens
    let totalTokensSum = 0;
    if (Array.isArray(totalTokens)) {
      for (const r of totalTokens) totalTokensSum += r.tokens_used || 0;
    }

    // Top domains sorted
    const topDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, chunks]) => ({ domain, chunks }));

    // Agent breakdown sorted
    const agentBreakdown = Object.entries(agentChunkCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([agent_id, chunks]) => ({ agent_id, chunks }));

    return NextResponse.json({
      chunks: {
        total: totalChunks,
        byAgent: agentBreakdown,
        topDomains,
        recent: recentChunksRaw || [],
      },
      conversations: {
        total: totalConversations,
        uniqueSessions: sessionSet.size,
        totalTokens: totalTokensSum,
      },
      recipes: { total: totalRecipes },
      agentPrompts: Array.isArray(agentPrompts) ? agentPrompts : [],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
