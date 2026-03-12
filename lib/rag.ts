/**
 * RAG Retrieval
 * Called at query time — embeds the user's question with Voyage,
 * searches Supabase pgvector for similar chunks, returns context.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VOYAGE_KEY = process.env.VOYAGE_API_KEY!;

export interface RagChunk {
  url: string;
  title: string;
  content: string;
  agent_id: string;
  similarity: number;
}

/** Embed a single query string with Voyage */
async function embedQuery(query: string): Promise<number[]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_KEY}`,
    },
    body: JSON.stringify({
      model: "voyage-3-lite",
      input: [query],
      input_type: "query", // different from "document" — optimised for retrieval
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage embed error: ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

/**
 * Retrieve the most relevant chunks for a query.
 * Optionally filter by agent_id to keep results focused.
 */
export async function retrieveChunks(
  query: string,
  agentId?: string,
  matchCount = 5,
  threshold = 0.3
): Promise<RagChunk[]> {
  if (!VOYAGE_KEY) {
    // RAG not configured — fail silently, agent falls back to Tavily
    return [];
  }

  try {
    const embedding = await embedQuery(query);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_chunks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: matchCount,
        filter_agent_id: agentId ?? null,
      }),
    });

    if (!res.ok) {
      console.error("RAG retrieval failed:", await res.text());
      return [];
    }

    const chunks: RagChunk[] = await res.json();
    console.log(`[RAG] Retrieved ${chunks.length} chunks for query: "${query.slice(0, 60)}" (agent: ${agentId})`);
    return chunks;
  } catch (e) {
    // Never crash the agent due to RAG failure
    console.error("RAG error (non-fatal):", e);
    return [];
  }
}

/** Format chunks into a context block for the system prompt */
export function formatRagContext(chunks: RagChunk[]): string {
  if (chunks.length === 0) return "";

  const formatted = chunks
    .map((c, i) =>
      `[Source ${i + 1}] ${c.title}\n${c.content}\n(${c.url})`
    )
    .join("\n\n---\n\n");

  return `\n\n## Curated Knowledge Base\nThe following is from your ingested document library — treat this as high-confidence reference material:\n\n${formatted}\n`;
}

// ─── Similar Question Detection ───────────────────────────────────────────────

export interface SimilarQuestion {
  session_id: string;
  content: string;         // the original question
  answer: string;          // the assistant's answer
  created_at: string;
  similarity: number;
}

/**
 * Store a question embedding so future queries can find it.
 * Called after saving the message, with the question text.
 */
export async function storeQuestionEmbedding(
  sessionId: string,
  question: string
): Promise<void> {
  if (!VOYAGE_KEY || !SUPABASE_KEY) return;
  try {
    const embedding = await embedQuery(question);
    await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ question_embedding: embedding }),
      // patch only the latest user message for this session
    });

    // More precise: patch by session_id + role + content match via RPC
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/store_question_embedding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({
        p_session_id: sessionId,
        p_question: question,
        p_embedding: embedding,
      }),
    });
  } catch (e) {
    console.error("[RAG] storeQuestionEmbedding error:", e);
  }
}

/**
 * Find past questions semantically similar to the current one.
 * Returns the question + the assistant's reply that followed it.
 */
export async function findSimilarQuestion(
  question: string,
  currentSessionId: string,
  threshold = 0.88
): Promise<SimilarQuestion | null> {
  if (!VOYAGE_KEY || !SUPABASE_KEY) return null;
  try {
    const embedding = await embedQuery(question);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: 1,
        exclude_session_id: currentSessionId,
      }),
    });
    if (!res.ok) return null;
    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;
    return results[0] as SimilarQuestion;
  } catch (e) {
    console.error("[RAG] findSimilarQuestion error:", e);
    return null;
  }
}
