import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { detectSubAgent } from "@/lib/agents";
import { multiRoundSearch } from "@/lib/search";
import { getSession, saveMessage, isSupabaseConfigured } from "@/lib/memory";
import type { MessageMeta } from "@/lib/memory";
import { trackTokens, estimateTokens, getAgentSources } from "@/lib/analytics";
import { retrieveChunks, formatRagContext, findSimilarQuestion, storeQuestionEmbedding } from "@/lib/rag";
import { runComparisonAgent } from "@/lib/agentLoop";

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
          const startTime = Date.now();
          // Step 1: Detect sub-agent
          let agent = detectSubAgent(message);
          send({ type: "agent", agentName: agent.name, agentIcon: agent.icon });
          send({ type: "status", text: `${agent.icon} ${agent.name} activated...` });

          // Step 1a: Load prompt override from DB if available
          try {
            const { loadAgentPrompts } = await import("@/lib/memory");
            const prompts = await loadAgentPrompts();
            if (prompts[agent.id]) {
              agent = { ...agent, systemPrompt: prompts[agent.id] };
            }
          } catch { /* use hardcoded fallback */ }

          // Step 1b: Check for similar past questions (async, non-blocking)
          if (isSupabaseConfigured()) {
            try {
              const similar = await findSimilarQuestion(message, sessionId || "");
              if (similar) {
                send({
                  type: "similar",
                  question: similar.content,
                  answer: similar.answer,
                  sessionId: similar.session_id,
                  date: similar.created_at,
                  similarity: similar.similarity,
                });
              }
            } catch {
              // Non-fatal — continue without similar check
            }
          }

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

          // ── AGENTIC MODE for comparison agent ──────────────────────────────
          if (agent.id === "comparison" && !isMemoryQuestion) {
            const memorySummary = memoryHistory.length > 0
              ? "\n\n[PREVIOUS CONVERSATION CONTEXT]\n" +
                memoryHistory.slice(-12).map(m =>
                  `${m.role === "user" ? "User asked" : "You answered"}: ${m.content.slice(0, 500)}${m.content.length > 500 ? "..." : ""}`
                ).join("\n\n") + "\n[END PREVIOUS CONTEXT]\n"
              : "";

            const { answer: fullResponse, steps: agentSteps, sources: agentSources } = await runComparisonAgent(message, agent.systemPrompt, memorySummary, send);

            // Stream the final answer word by word for a natural feel
            const words = fullResponse.split(" ");
            for (const word of words) {
              send({ type: "text", text: word + " " });
              await new Promise(r => setTimeout(r, 8));
            }

            // Save to memory
            if (sessionId && isSupabaseConfigured()) {
              console.log("[agentic] steps to save:", JSON.stringify(agentSteps));
              const meta: MessageMeta = { agent_id: agent.id, tokens_used: estimateTokens(message + fullResponse), agent_steps: agentSteps };
              await saveMessage(sessionId, "user", message, meta);
              await saveMessage(sessionId, "assistant", fullResponse, meta);
              await trackTokens(sessionId, message, fullResponse, agent.id);
              storeQuestionEmbedding(sessionId, message).catch(() => {});
            }

            // Reflection — same as standard path
            try {
              const reflectionRes = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [
                  {
                    role: "system",
                    content: `You are a quality evaluator for a Fujifilm X-E5 photography assistant. Score the answer on these 4 criteria:
1. Answered the question directly
2. Specific & actionable (concrete specs, values, prices — not vague)
3. Covered both/all items being compared
4. Used photography expertise

Return ONLY a JSON object: {"score": <1-10>, "critique": "<one sentence: what was good and what was missing>", "criteria": {"answered": <1-3>, "specific": <1-3>, "prices": <1-3>, "expertise": <1-3>}}`
                  },
                  { role: "user", content: `Question: ${message}\n\nAnswer: ${fullResponse.slice(0, 1500)}` }
                ],
                max_tokens: 200,
                temperature: 0.1,
                stream: false,
              });
              const rawRef = reflectionRes.choices[0]?.message?.content || "{}";
              console.log("[reflection-comparison] raw:", rawRef.slice(0, 200));
              const reflection = JSON.parse(rawRef.replace(/```json|```/g, "").trim());
              if (reflection.score) {
                if (sessionId && isSupabaseConfigured()) {
                  const { updateReflection } = await import("@/lib/memory");
                  await updateReflection(sessionId, reflection.score, reflection.critique || "");
                }
                send({ type: "reflection", score: reflection.score, critique: reflection.critique, criteria: reflection.criteria });
              }
            } catch (e) {
              console.error("[reflection-comparison] failed:", e);
            }

            send({ type: "tokens", count: estimateTokens(message + fullResponse), exact: false });
            send({ type: "done" });
            controller.close();
            return;
          }
          // ── END AGENTIC MODE ───────────────────────────────────────────────

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

          // Step 6b: RAG retrieval — fetch relevant chunks from knowledge base
          const ragChunks = await retrieveChunks(message, agent.id, 5);
          const ragContext = formatRagContext(ragChunks);
          if (ragChunks.length > 0) {
            send({ type: "status", text: `📚 Found ${ragChunks.length} knowledge base chunks` });
          }


          // Step 6: Build the user message
          const userMessage = searchContext
            ? `[LIVE SEARCH RESULTS - ${new Date().toLocaleDateString()}]\n\n${searchContext}\n\n---\n[USER QUESTION]\n${message}`
            : message;

          // Build approved sources block for linking instructions
          const approvedSourcesBlock = sourceMeta.length > 0
            ? `\n\n[APPROVED SOURCES — use ONLY these URLs, no others]\n` +
              sourceMeta.map(s => `- ${s.title}: ${s.url}`).join("\n") +
              `\n\nLINKING INSTRUCTIONS:
- When you mention a specific article, recipe, or sample image gallery, link the relevant text inline using markdown: [link text](url)
- At the end of your answer, if you referenced 1-3 sources the user would genuinely benefit from visiting, add a ## Sources section with clean title links: [Title](url)
- Only include Sources if the links add real value (e.g. a recipe to follow, a sample gallery, a detailed review). Skip Sources if the answer is self-contained or all links are already inline.
- Never invent URLs. Only use URLs from the APPROVED SOURCES list above.`
            : "";

          // Step 7: Build system prompt with memory injected
          const systemWithMemory = agent.systemPrompt + ragContext + memorySummary + approvedSourcesBlock +
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
          const responseTimeMs = Date.now() - startTime;
          const tokensEst = estimateTokens(userMessage + systemWithMemory + fullResponse);

          // Send token count to client for session display
          send({ type: "tokens", count: tokensEst, exact: false });

          if (sessionId && isSupabaseConfigured()) {
            const meta: MessageMeta = {
              agent_id: agent.id,
              prompt_sent: systemWithMemory.slice(0, 4000),
              sources_used: sourceMeta,
              tokens_used: tokensEst,
              response_time_ms: responseTimeMs,
            };
            await saveMessage(sessionId, "user", message);
            await saveMessage(sessionId, "assistant", fullResponse, meta);
            await trackTokens(sessionId, userMessage + systemWithMemory, fullResponse, agent.id);
            // Store question embedding for future similarity detection (fire and forget)
            storeQuestionEmbedding(sessionId, message).catch(() => {});
          }

          // Step 10: Generate follow-up suggestions
          try {
            const followupStream = await groq.chat.completions.create({
              model: "llama-3.3-70b-versatile",
              messages: [
                {
                  role: "system",
                  content: `You are a Fujifilm X-E5 photography assistant. Generate exactly 3 short follow-up questions a photographer would naturally ask next, based on the question and answer below. The questions should stay relevant to the ${agent.name} topic area. Return ONLY a JSON array of 3 strings — no explanation, no markdown, no numbering. Keep each question under 10 words. Example: ["How does Velvia compare to Classic Chrome?", "What grain setting works best?", "Can I use this recipe for portraits?"]`
                },
                {
                  role: "user",
                  content: `Question: ${message}\n\nAnswer summary: ${fullResponse.slice(0, 800)}`
                }
              ],
              max_tokens: 200,
              temperature: 0.7,
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

          // Step 11: Reflection — self-critique the answer quality
          try {
            const reflectionRes = await groq.chat.completions.create({
              model: "llama-3.3-70b-versatile",
              messages: [
                {
                  role: "system",
                  content: `You are a quality evaluator for a Fujifilm X-E5 photography assistant. Score the answer on these 4 criteria:
1. Answered the question directly (did it actually address what was asked?)
2. Specific & actionable (gave concrete settings, values, names — not vague advice)
3. Included prices/availability if relevant to the question
4. Used photography expertise (not generic advice that could apply to any camera)

Return ONLY a JSON object, no other text:
{"score": <1-10>, "critique": "<one sentence: what was good and what was missing>", "criteria": {"answered": <1-3>, "specific": <1-3>, "prices": <1-3>, "expertise": <1-3>}}`
                },
                {
                  role: "user",
                  content: `Question: ${message}\n\nAnswer: ${fullResponse.slice(0, 1500)}`
                }
              ],
              max_tokens: 200,
              temperature: 0.1,
              stream: false,
            });

            const rawRef = reflectionRes.choices[0]?.message?.content || "{}";
            console.log("[reflection] raw:", rawRef.slice(0, 200));
            const cleanRef = rawRef.replace(/```json|```/g, "").trim();
            const reflection = JSON.parse(cleanRef);

            if (reflection.score) {
              if (sessionId && isSupabaseConfigured()) {
                const { updateReflection } = await import("@/lib/memory");
                await updateReflection(sessionId, reflection.score, reflection.critique || "");
              }
              send({ type: "reflection", score: reflection.score, critique: reflection.critique, criteria: reflection.criteria });
            }
          } catch (e) {
            console.error("[reflection] failed:", e);
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