import { NextRequest } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are an expert Fujifilm X-E5 research agent. You have just searched the web and retrieved real, current information. Synthesize the search results into a clear, practical, well-structured answer specifically about the Fujifilm X-E5.

Rules:
- ONLY discuss the Fujifilm X-E5
- Use exact settings values for film simulations (e.g. "Grain: Strong/Large", "Shadow Tone: +1")
- Use emoji headers (##) and bullet points for settings
- Cite sources by name when relevant (e.g. "According to Fuji X Weekly...")
- Be enthusiastic and specific — you're talking to a fellow Fuji shooter
- Format your response in clean markdown`;

async function tavilySearch(query: string): Promise<{ results: { title: string; url: string; content: string }[] }> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      max_results: 6,
      include_answer: false,
    }),
  });
  if (!res.ok) throw new Error(`Tavily error: ${res.statusText}`);
  return res.json();
}

function buildSearchQueries(userQuery: string): string[] {
  const base = userQuery.toLowerCase();
  const queries: string[] = [`Fujifilm X-E5 ${userQuery}`];

  if (base.includes("film") || base.includes("recipe") || base.includes("simulation")) {
    queries.push("Fuji X-E5 film simulation recipe settings fuji x weekly");
  } else if (base.includes("lens") || base.includes("accessory") || base.includes("gear")) {
    queries.push("best XF lenses Fujifilm X-E5 accessories recommended");
  } else if (base.includes("setting") || base.includes("config") || base.includes("menu")) {
    queries.push("Fujifilm X-E5 camera settings configuration tips custom menu");
  } else if (base.includes("place") || base.includes("location") || base.includes("where")) {
    queries.push("photography locations Fujifilm XE5 street travel iconic spots");
  } else {
    queries.push(`Fujifilm X-E5 ${userQuery} review tips 2024 2025`);
  }

  return queries;
}

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    // ── Step 1: Search ─────────────────────────────────────────────────────
    const queries = buildSearchQueries(message);
    const searchPromises = queries.map((q) => tavilySearch(q));
    const searchResults = await Promise.allSettled(searchPromises);

    const sources: { title: string; url: string; content: string }[] = [];
    for (const result of searchResults) {
      if (result.status === "fulfilled") {
        sources.push(...(result.value.results || []));
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueSources = sources.filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });

    // ── Step 2: Build context for Groq ─────────────────────────────────────
    const searchContext = uniqueSources
      .slice(0, 8)
      .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.content}`)
      .join("\n\n---\n\n");

    const userMessageWithContext = `[SEARCH RESULTS]\n${searchContext}\n\n[USER QUESTION]\n${message}`;

    // ── Step 3: Build message history ──────────────────────────────────────
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      ...(history || []),
      { role: "user", content: userMessageWithContext },
    ];

    // ── Step 4: Stream from Groq ────────────────────────────────────────────
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // First, send the sources as metadata
        const sourceMeta = uniqueSources.slice(0, 8).map((s) => ({ title: s.title, url: s.url }));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "sources", sources: sourceMeta })}\n\n`));

        // Then stream the LLM response
    const groqStream = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ],
  max_tokens: 1500,
  temperature: 0.7,
  stream: true,
});

        for await (const chunk of groqStream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text })}\n\n`));
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
