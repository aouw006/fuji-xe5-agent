export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface Session {
  id: string;
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
}

// ─── Supabase Memory ──────────────────────────────────────────────────────────
// Only active if SUPABASE_URL and SUPABASE_ANON_KEY are set in env
// Falls back to stateless mode if not configured

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_KEY);
}

async function supabaseFetch(path: string, options: RequestInit = {}) {
  if (!isSupabaseConfigured()) return null;

  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) return null;
  return res.json();
}

export async function getSession(sessionId: string): Promise<ConversationMessage[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const data = await supabaseFetch(
      `/conversations?session_id=eq.${sessionId}&order=created_at.asc`
    );
    if (!Array.isArray(data) || data.length === 0) return [];
    return data.map((row: { role: string; content: string }) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));
  } catch {
    return [];
  }
}

export interface AgentStep {
  step: number;
  tool: string;
  input: string;
  reasoning: string; // why the agent chose this action
  result_summary: string;
}

export interface MessageMeta {
  agent_id?: string;
  prompt_sent?: string;
  sources_used?: { title: string; url: string }[];
  tokens_used?: number;
  response_time_ms?: number;
  agent_steps?: AgentStep[];
  reflection_score?: number;
  reflection_critique?: string;
}

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  meta?: MessageMeta
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    await supabaseFetch("/conversations", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        role,
        content,
        ...(meta?.agent_id && { agent_id: meta.agent_id }),
        ...(meta?.prompt_sent && { prompt_sent: meta.prompt_sent }),
        ...(meta?.sources_used && { sources_used: JSON.stringify(meta.sources_used) }),
        ...(meta?.tokens_used && { tokens_used: meta.tokens_used }),
        ...(meta?.agent_steps && { agent_steps: JSON.stringify(meta.agent_steps) }),
        ...(meta?.reflection_score !== undefined && { reflection_score: meta.reflection_score }),
        ...(meta?.reflection_critique && { reflection_critique: meta.reflection_critique }),
      }),
    });
    console.log("[saveMessage] saved", role, "agent_steps length:", meta?.agent_steps?.length ?? 0);
  } catch {
    // Silently fail — memory is optional
  }
}

export async function clearSession(sessionId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    await supabaseFetch(`/conversations?session_id=eq.${sessionId}`, {
      method: "DELETE",
    });
  } catch {}
}

export { isSupabaseConfigured };

export async function updateReflection(
  sessionId: string,
  score: number,
  critique: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    // Find the most recent assistant message for this session and update it
    await supabaseFetch(
      `/conversations?session_id=eq.${sessionId}&role=eq.assistant&order=created_at.desc&limit=1`,
      {
        method: "PATCH",
        body: JSON.stringify({ reflection_score: score, reflection_critique: critique }),
        headers: { Prefer: "return=minimal" },
      }
    );
  } catch (e) {
    console.error("[updateReflection] failed:", e);
  }
}
