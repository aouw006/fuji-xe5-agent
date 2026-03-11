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

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    await supabaseFetch("/conversations", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, role, content }),
    });
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
