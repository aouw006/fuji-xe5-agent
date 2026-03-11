import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { detectSubAgent } from "@/lib/agents";
import { multiRoundSearch } from "@/lib/search";
import { getSession, saveMessage, isSupabaseConfigured } from "@/lib/memory";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { message, history, sessionId } = await req.json();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Step 1: Detect sub-agent
          const agent = detectSubAgent(message);
          send({ type: "agent", agentName: agent.name, agentIcon: agent.icon });
          send({ type: "status", text: `${agent.icon} ${agent.name} activated...` });

          // Step 2: Build search queries
          const queries = agent.searchQueries(message);
          send({ type: "status", text: "Planning search strategy..." });

          // Step 3: Multi-round search + article scraping
          const sources = await multiRoundSearch(
            queries,
            agent.priorityDomains,
            (msg) => send({ type: "status", text: msg })
          );

          const sourceMeta = sources.map((s) => ({ title: s.title, url: s.url }));
          send({ type: "sources", sources: sourceMeta });
          send({ type: "status", text: `Synthesizing from ${sources.length} sources...` });

          // Step 4: Load memory from Supabase
          let memoryHistory: { role: "user" | "assistant"; content: string }[] = [];
          if (sessionId && isSupabaseConfigured()) {
            memoryHistory = await getSession(sessionId);
            if (memoryHistory.length > 0) {
              send({ type: "status", text: `Loaded ${Math.floor(memoryHistory.length / 2)} past exchanges from memory...` });
            }
          }

          // Step 5: Build LLM context
          const searchContext = sources
            .map((s, i) => `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\n\n${s.content}`)
            .join("\n\n---\n\n");

          // Inject memory summary so LLM knows past context
          const memoryContext = memoryHistory.length > 0
            ? `[CONVERSATION HISTORY - ${Math.floor(memoryHistory.length / 2)} previous exchanges]\n` +
              memoryHistory.slice(-10).map(m =>
                `${m.role.toUpperCase()}: ${m.content.slice(0, 400)}${m.content.length > 400 ? "..." : ""}`
              ).join("\n") +
              "\n[END HISTORY]\n\n"
            : "";

          const userMessageWithContext = `${memoryContext}[LIVE SEARCH RESULTS - ${new Date().toLocaleDateString()}]\n\n${searchContext}\n\n----\n[USER QUESTION]\n${message}`;

          // Use last 12 memory messages as chat history
          const trimmedHistory = memoryHistory.slice(-12);

          const messages: Groq.Chat.ChatCompletionMessageParam[] = [
            ...trimmedHistory,
            { role: "user", content: userMessageWithContext },
          ];

          // Step 6: Stream Groq response
          const groqStream = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: agent.systemPrompt },
              ...messages,
            ],
            max_tokens: 2000,
            temperature: 0.7,
            stream: true,
          });

          let fullResponse = "";
          for await (const chunk of groqStream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              fullResponse += text;
              send({ type: "text", text });
            }
          }

          // Step 7: Save to memory
          if (sessionId && isSupabaseConfigured()) {
            await saveMessage(sessionId, "user", message);
            await saveMessage(sessionId, "assistant", fullResponse);
          }

          send({ type: "done" });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          send({ type: "error", text: msg });
        }

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
