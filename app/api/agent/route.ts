import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { detectSubAgent } from "@/lib/agents";
import { multiRoundSearch } from "@/lib/search";
import { getSession, saveMessage, isSupabaseConfigured } from "@/lib/memory";
import { trackTokens, estimateTokens, getAgentSources } from "@/lib/analytics";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Step 1: Detect sub-agent
          let agent = detectSubAgent(message);
          send({ type: "agent", agentName: agent.name, agentIcon: agent.icon });
          send({ type: "status", text: `${agent.icon} ${agent.name} activated...` });

          // Merge any custom sources the user has added for this agent
          try {
            const allCustomSources = await getAgentSources();
            const customForAgent = allCustomSources
              .filter(s => s.agent_id === agent.id)
              .map(s => s.domain);
            if (customForAgent.length > 0) {
              agent = { ...agent, priorityDomains: [...customForAgent, ...agent.priorityDomains] };
            }
          } catch {}

          // Step 2: Load memory FIRST before searching
          let memoryHistory: { role: "user" | "assistant"; content: string }[] = [];
          if (sessionId && isSupabaseConfigured()) {
            memoryHistory = await getSession(sessionId);
            if (memoryHistory.length > 0) {
              send({ type: "status", text: `Loaded ${Math.floor(memoryHistory.length / 2)} past exchanges from memory...` });
            }
          }

          // Step 3: Check if this is a memory-only question (no search needed)
          const isMemoryQuestion = /what (was|were|did|have)|last (recipe|setting|answer|time)|remember|previous|earlier|before|we (discussed|talked)/i.test(message);

          let searchContext = "";
          let sourceMeta: { title: string; url: string }[] = [];

          if (!isMemoryQuestion) {
            // Step 4: Build search queries and search
            send({ type: "status", text: "Planning search strategy..." });
            const queries = agent.searchQueries(message);

            const callSeed = Date.now() % 997;
            const sources = await multiRoundSearch(
              queries,
              agent.priorityDomains,
              (msg) => send({ type: "status", text: msg }),
              callSeed
            );

            sourceMeta = sources.map((s) => ({ title: s.title, url: s.url }));
            send({ type: "sources", sources: sourceMeta });
            send({ type: "status", text: `Synthesizing from ${sources.length} sources...` });

            searchContext = sources
              .map((s, i) => `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\n\n${s.content}`)
              .join("\n\n---\n\n");
          }

          // Step 5: Build clean memory context
          // Only use last 6 exchanges (12 messages) to avoid token bloat
          const recentMemory = memoryHistory.slice(-12);

          // Build a clean summary of past conversation for the system prompt
          const memorySummary = recentMemory.length > 0
            ? "\n\n[PREVIOUS CONVERSATION CONTEXT]\n" +
              recentMemory.map(m =>
                `${m.role === "user" ? "User asked" : "You answered"}: ${m.content.slice(0, 500)}${m.content.length > 500 ? "..." : ""}`
              ).join("\n\n") +
              "\n[END PREVIOUS CONTEXT]\n"
            : "";

          // Step 6: Build the user message
          const userMessage = searchContext
            ? `[LIVE SEARCH RESULTS - ${new Date().toLocaleDateString()}]\n\n${searchContext}\n\n---\n[USER QUESTION]\n${message}`
            : message;

          // Step 7: Build system prompt with memory injected
          const systemWithMemory = agent.systemPrompt + memorySummary +
            "\n\nIMPORTANT: If the user asks about previous answers or recipes, refer to the PREVIOUS CONVERSATION CONTEXT above. Always give complete, detailed answers. FRESHNESS: Do not repeat information, recipes, or advice you have already given in this conversation — if the user is asking a similar question again, find different examples, different sources, or a different angle on the topic.";

          // Step 8: Stream Groq response — clean messages, no history contamination
          const groqStream = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemWithMemory },
              { role: "user", content: userMessage },
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

          // Step 9: Save clean Q&A to memory + track token usage
          if (sessionId && isSupabaseConfigured()) {
            await saveMessage(sessionId, "user", message);
            await saveMessage(sessionId, "assistant", fullResponse);
            await trackTokens(sessionId, userMessage + systemWithMemory, fullResponse);
          }

          // Step 10: Generate follow-up suggestions
          try {
            const followupStream = await groq.chat.completions.create({
              model: "llama-3.3-70b-versatile",
              messages: [
                {
                  role: "system",
                  content: "You are a Fujifilm X-E5 expert assistant. Given the question and answer below, generate exactly 3 short follow-up questions the user might naturally want to ask next. Return ONLY a JSON array of 3 strings, no explanation, no markdown, no numbering. Example: [\"How does Velvia compare to Classic Chrome?\", \"What grain setting works best?\", \"Can I use this recipe for portraits?\"]"
                },
                {
                  role: "user",
                  content: `Question: ${message}\n\nAnswer summary: ${fullResponse.slice(0, 600)}`
                }
              ],
              max_tokens: 200,
              temperature: 0.8,
              stream: false,
            });
            const raw = followupStream.choices[0]?.message?.content || "[]";
            const clean = raw.replace(/```json|```/g, "").trim();
            const suggestions = JSON.parse(clean);
            if (Array.isArray(suggestions) && suggestions.length > 0) {
              send({ type: "followups", suggestions: suggestions.slice(0, 3) });
            }
          } catch {
            // follow-ups are optional, don't fail the request
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
