const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const DAILY_LIMIT = 100000;

async function supabaseFetch(path: string, options: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
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
  if (!res.ok) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Rough token estimator: ~1 token per 4 chars
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Token Usage ──────────────────────────────────────────────────────────────

export async function trackTokens(sessionId: string, inputText: string, outputText: string): Promise<void> {
  try {
    const tokens = estimateTokens(inputText + outputText);
    const today = new Date().toISOString().split("T")[0];
    await supabaseFetch("/token_usage", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, tokens_used: tokens, date: today }),
    });
  } catch {}
}

export async function getDailyTokenUsage(): Promise<{ used: number; limit: number; resetIn: string }> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const data = await supabaseFetch(`/token_usage?date=eq.${today}&select=tokens_used`);
    const used = Array.isArray(data)
      ? data.reduce((sum: number, row: { tokens_used: number }) => sum + row.tokens_used, 0)
      : 0;

    // Calculate time until midnight UTC
    const now = new Date();
    const midnight = new Date();
    midnight.setUTCHours(24, 0, 0, 0);
    const diffMs = midnight.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const resetIn = `${hours}h ${mins}m`;

    return { used, limit: DAILY_LIMIT, resetIn };
  } catch {
    return { used: 0, limit: DAILY_LIMIT, resetIn: "unknown" };
  }
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface HistorySession {
  session_id: string;
  title: string;
  date: string;
  preview: string;
}

export async function getAllSessions(): Promise<HistorySession[]> {
  try {
    // Get all unique session_ids with their first user message
    const data = await supabaseFetch(
      `/conversations?role=eq.user&order=created_at.asc&select=session_id,content,created_at`
    );
    if (!Array.isArray(data)) return [];

    // Group by session_id, take first message as title
    const seen = new Set<string>();
    const sessions: HistorySession[] = [];

    for (const row of data) {
      if (!seen.has(row.session_id)) {
        seen.add(row.session_id);
        sessions.push({
          session_id: row.session_id,
          title: row.content.slice(0, 60) + (row.content.length > 60 ? "…" : ""),
          date: new Date(row.created_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          }),
          preview: row.content,
        });
      }
    }

    // Most recent first
    return sessions.reverse();
  } catch {
    return [];
  }
}

export async function getSessionMessages(sessionId: string) {
  try {
    const data = await supabaseFetch(
      `/conversations?session_id=eq.${sessionId}&order=created_at.asc&select=role,content`
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ─── Saved Recipes ────────────────────────────────────────────────────────────

export interface SavedRecipe {
  id: string;
  session_id: string;
  name: string;
  author: string;
  mood: string;
  best_for: string;
  settings: { label: string; value: string }[];
  created_at: string;
}

export async function saveRecipe(recipe: Omit<SavedRecipe, "id" | "created_at">): Promise<string | null> {
  try {
    const data = await supabaseFetch("/saved_recipes", {
      method: "POST",
      body: JSON.stringify({
        session_id: recipe.session_id,
        name: recipe.name,
        author: recipe.author,
        mood: recipe.mood,
        best_for: recipe.best_for,
        settings: JSON.stringify(recipe.settings),
      }),
    });
    return data?.[0]?.id || null;
  } catch { return null; }
}

export async function deleteSavedRecipe(id: string): Promise<void> {
  try {
    await supabaseFetch(`/saved_recipes?id=eq.${id}`, { method: "DELETE" });
  } catch {}
}

export async function getAllSavedRecipes(): Promise<SavedRecipe[]> {
  try {
    const data = await supabaseFetch("/saved_recipes?order=created_at.desc");
    if (!Array.isArray(data)) return [];
    return data.map((r: Record<string, string>) => ({
      ...r,
      settings: typeof r.settings === "string" ? JSON.parse(r.settings) : r.settings,
    })) as SavedRecipe[];
  } catch { return []; }
}

// ─── Custom Agent Sources ─────────────────────────────────────────────────────

export interface AgentSource {
  id: string;
  agent_id: string;
  domain: string;
  created_at: string;
}

export async function getAgentSources(): Promise<AgentSource[]> {
  try {
    const data = await supabaseFetch("/agent_sources?order=created_at.asc");
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export async function addAgentSource(agentId: string, domain: string): Promise<AgentSource | null> {
  try {
    const data = await supabaseFetch("/agent_sources", {
      method: "POST",
      body: JSON.stringify({ agent_id: agentId, domain: domain.toLowerCase().trim() }),
    });
    return data?.[0] || null;
  } catch { return null; }
}

export async function deleteAgentSource(id: string): Promise<void> {
  try {
    await supabaseFetch(`/agent_sources?id=eq.${id}`, { method: "DELETE" });
  } catch {}
}
