import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function supabaseFetch(path: string, options: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(options.headers || {}),
    },
  });
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, agentId, correctedScore = 2 } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    // Override the reflection score on the most recent assistant message in this session
    await supabaseFetch(
      `/conversations?session_id=eq.${sessionId}&role=eq.assistant&order=created_at.desc&limit=1`,
      {
        method: "PATCH",
        body: JSON.stringify({
          reflection_score: correctedScore,
          reflection_critique: "User marked this response as unhelpful or misunderstood",
        }),
      }
    );

    // Fire-and-forget: if agentId provided and the corrected score is low, check whether
    // self-improvement should trigger now (same logic as maybeImprovePrompt but user-initiated)
    if (agentId && correctedScore < 7) {
      (async () => {
        try {
          const { getAgentReflections, saveAgentPrompt, logPromptRewrite, loadAgentPrompts } = await import("@/lib/memory");
          const { default: Groq } = await import("groq-sdk");
          const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

          const history = await getAgentReflections(agentId, 5);
          if (history.length < 2) return;
          const avgScore = history.reduce((a, b) => a + b.score, 0) / history.length;
          if (avgScore >= 6) return; // only rewrite if consistently poor

          const prompts = await loadAgentPrompts();
          const currentPrompt = prompts[agentId];
          if (!currentPrompt) return;

          const critiqueList = history.map(r => `Score ${r.score}: ${r.critique}`).join("\n");
          const res = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `You are a prompt engineer for a Fujifilm X-E5 photography AI assistant. Rewrite the given system prompt to fix the recurring weaknesses in the critiques. Return ONLY the improved prompt text.`,
              },
              {
                role: "user",
                content: `Current prompt:\n${currentPrompt}\n\nCritiques:\n${critiqueList}\n\nImproved prompt:`,
              },
            ],
            max_tokens: 1500,
            temperature: 0.3,
          });

          const improved = res.choices[0]?.message?.content?.trim();
          if (improved && improved.length > 100) {
            await saveAgentPrompt(agentId, improved);
            await logPromptRewrite(
              agentId, currentPrompt, improved, correctedScore, avgScore,
              "User override triggered retraining | " + history.map(r => r.critique).filter(Boolean).join(" | ").slice(0, 400)
            );
          }
        } catch { /* silent */ }
      })();
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
