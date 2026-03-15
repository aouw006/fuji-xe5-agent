import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { detectSubAgent } from "@/lib/agents";
import { multiRoundSearch } from "@/lib/search";
import { getSession, saveMessage, isSupabaseConfigured } from "@/lib/memory";
import type { MessageMeta } from "@/lib/memory";
import { trackTokens, estimateTokens, getAgentSources } from "@/lib/analytics";
import { retrieveChunks, formatRagContext, findSimilarQuestion, storeQuestionEmbedding } from "@/lib/rag";
import { runAgentLoop } from "@/lib/agentLoop";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Self-improvement: evolve agent prompt when reflection scores are consistently low ──
async function maybeImprovePrompt(agentId: string, score: number, currentPrompt: string) {
  if (score >= 7) return;
  try {
    const { getAgentReflections, saveAgentPrompt, isSupabaseConfigured } = await import("@/lib/memory");
    if (!isSupabaseConfigured()) return;
    const history = await getAgentReflections(agentId, 5);
    if (history.length < 3) return; // need enough data before evolving
    const avgScore = history.reduce((a, b) => a + b.score, 0) / history.length;
    if (avgScore >= 7) return; // average quality is fine
    const critiqueList = history.map(r => `Score ${r.score}: ${r.critique}`).join("\n");
    const res = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a prompt engineer for a Fujifilm X-E5 photography AI assistant. Given a system prompt and recent quality critiques of its outputs, rewrite the prompt to address the recurring weaknesses. Keep the same structure, tone, and expertise focus. Only improve what the critiques indicate is weak. Return ONLY the improved prompt text, no explanation or preamble.`,
        },
        {
          role: "user",
          content: `Current prompt:\n${currentPrompt}\n\nRecent quality critiques (last ${history.length} responses):\n${critiqueList}\n\nImproved prompt:`,
        },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });
    const improved = res.choices[0]?.message?.content?.trim();
    if (improved && improved.length > 100) {
      await saveAgentPrompt(agentId, improved);
      console.log(`[prompt-evolution] updated prompt for ${agentId} (avg score was ${avgScore.toFixed(1)})`);
      const { logPromptRewrite } = await import("@/lib/memory");
      const critiqueSummary = history.map(r => r.critique).filter(Boolean).join(" | ").slice(0, 500);
      await logPromptRewrite(agentId, currentPrompt, improved, score, avgScore, critiqueSummary);
    }
  } catch (e) {
    console.error("[prompt-evolution] failed:", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, activeAgentId, history } = await req.json();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const startTime = Date.now();

          // ── Step 1: Query expansion ──────────────────────────────────────
          // If there's conversation history, rewrite the message to resolve
          // pronouns and implied subjects before routing or answering.
          let expandedMessage = message;
          const recentHistory = Array.isArray(history) ? history.slice(-6) : [];
          const needsExpansion = recentHistory.length >= 2 &&
            /^(is it|does it|how is it|what about it|is that|does that|how does that|tell me more|and the|what about the|how about|can it|will it|would it|is this|does this)\b/i.test(message.trim());

          if (needsExpansion) {
            try {
              const historyContext = recentHistory
                .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 300)}`)
                .join("\n");
              const expansionRes = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [
                  {
                    role: "system",
                    content: `You are a query rewriter. Given a conversation history and a follow-up question, rewrite the follow-up as a fully self-contained question by resolving any pronouns or implied subjects. Output ONLY the rewritten question, nothing else. Keep it concise. If the question is already self-contained, return it unchanged.`,
                  },
                  {
                    role: "user",
                    content: `Conversation:\n${historyContext}\n\nFollow-up question: "${message}"\n\nRewritten question:`,
                  },
                ],
                max_tokens: 80,
                temperature: 0.1,
              });
              const rewritten = expansionRes.choices[0]?.message?.content?.trim();
              if (rewritten && rewritten.length > 0 && rewritten.length < 300) {
                expandedMessage = rewritten;
              }
            } catch { /* fall back to original message */ }
          }

          // ── Step 2: Agent detection with stickiness ──────────────────────
          // Detect agent from the expanded message.
          // If there's an active agent from this conversation, only switch if
          // the new message strongly signals a different agent.
          const detectedAgent = detectSubAgent(expandedMessage);
          let agent = detectedAgent;

          if (activeAgentId && activeAgentId !== detectedAgent.id) {
            // Check if the detected agent is "community" (the weak fallback)
            // or if the signal is ambiguous — if so, stick with the active agent
            const weakSwitch = detectedAgent.id === "community";
            if (weakSwitch) {
              const { SUB_AGENTS } = await import("@/lib/agents");
              agent = SUB_AGENTS[activeAgentId] || detectedAgent;
            }
          }

          send({ type: "agent", agentName: agent.name, agentIcon: agent.icon, agentId: agent.id });
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
          const isMemoryQuestion = /what (was|were|did|have)|last (recipe|setting|answer|time)|remember|previous|earlier|before|we (discussed|talked)/i.test(expandedMessage);

          // ── AGENTIC MODE — all agents ──────────────────────────────────────
          if (!isMemoryQuestion) {
            const memorySummary = memoryHistory.length > 0
              ? "\n\n[PREVIOUS CONVERSATION CONTEXT]\n" +
                memoryHistory.slice(-12).map(m =>
                  `${m.role === "user" ? "User asked" : "You answered"}: ${m.content.slice(0, 500)}${m.content.length > 500 ? "..." : ""}`
                ).join("\n\n") + "\n[END PREVIOUS CONTEXT]\n"
              : "";

            const { answer: fullResponse, steps: agentSteps } = await runAgentLoop(
              expandedMessage, agent.systemPrompt, memorySummary, send, agent.id, sessionId, agent.name
            );

            // Stream the final answer word by word for a natural feel
            const words = fullResponse.split(" ");
            for (const word of words) {
              send({ type: "text", text: word + " " });
              await new Promise(r => setTimeout(r, 8));
            }

            // Save to memory
            if (sessionId && isSupabaseConfigured()) {
              const meta: MessageMeta = { agent_id: agent.id, tokens_used: estimateTokens(message + fullResponse), agent_steps: agentSteps };
              await saveMessage(sessionId, "user", message, meta);
              await saveMessage(sessionId, "assistant", fullResponse, meta);
              await trackTokens(sessionId, message, fullResponse, agent.id);
              storeQuestionEmbedding(sessionId, message).catch(() => {});
            }

            // Follow-up suggestions
            try {
              const followupRes = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [
                  {
                    role: "system",
                    content: `You are a Fujifilm X-E5 photography assistant. Generate exactly 3 short follow-up questions a photographer would naturally ask next, based on the question and answer below. The questions should stay relevant to the ${agent.name} topic area. Return ONLY a JSON array of 3 strings — no explanation, no markdown, no numbering. Keep each question under 10 words.`,
                  },
                  { role: "user", content: `Question: ${expandedMessage}\n\nAnswer summary: ${fullResponse.slice(0, 800)}` },
                ],
                max_tokens: 200,
                temperature: 0.7,
                stream: false,
              });
              const raw = followupRes.choices[0]?.message?.content || "[]";
              const suggestions = JSON.parse(raw.replace(/```json|```/g, "").trim());
              if (Array.isArray(suggestions) && suggestions.length > 0) {
                send({ type: "followups", suggestions: suggestions.slice(0, 3) });
              }
            } catch { /* follow-ups are optional */ }

            // Reflection
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
{"score": <1-10>, "critique": "<one sentence: what was good and what was missing>", "criteria": {"answered": <1-3>, "specific": <1-3>, "prices": <1-3>, "expertise": <1-3>}}`,
                  },
                  { role: "user", content: `Question: ${expandedMessage}\n\nAnswer: ${fullResponse.slice(0, 1500)}` },
                ],
                max_tokens: 200,
                temperature: 0.1,
                stream: false,
              });
              const rawRef = reflectionRes.choices[0]?.message?.content || "{}";
              const reflection = JSON.parse(rawRef.replace(/```json|```/g, "").trim());
              if (reflection.score) {
                if (sessionId && isSupabaseConfigured()) {
                  const { updateReflection } = await import("@/lib/memory");
                  await updateReflection(sessionId, reflection.score, reflection.critique || "");
                }
                send({ type: "reflection", score: reflection.score, critique: reflection.critique, criteria: reflection.criteria });

                // Self-improvement: if quality is consistently low, evolve the prompt (fire and forget)
                maybeImprovePrompt(agent.id, reflection.score, agent.systemPrompt).catch(() => {});
              }
            } catch (e) {
              console.error("[reflection] failed:", e);
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
            const queries = agent.searchQueries(expandedMessage);

            const callSeed = Date.now() % 997;
            const sources = await multiRoundSearch(
              queries,
              agent.priorityDomains,
              (msg) => send({ type: "status", text: msg }),
              callSeed,
              agent.id,
              sessionId
            );

            sourceMeta = sources.map((s) => ({ title: s.title, url: s.url }));
            send({ type: "sources", sources: sourceMeta });
            send({ type: "status", text: `Synthesizing from ${sources.length} sources...` });

            searchContext = sources
              .map((s, i) => `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\n\n${s.content}`)
              .join("\n\n---\n\n");
          }

          // Step 5: Build clean memory context
          const recentMemory = memoryHistory.slice(-12);
          const memorySummary = recentMemory.length > 0
            ? "\n\n[PREVIOUS CONVERSATION CONTEXT]\n" +
              recentMemory.map(m =>
                `${m.role === "user" ? "User asked" : "You answered"}: ${m.content.slice(0, 500)}${m.content.length > 500 ? "..." : ""}`
              ).join("\n\n") +
              "\n[END PREVIOUS CONTEXT]\n"
            : "";

          // Step 6b: RAG retrieval — fetch relevant chunks from knowledge base
          const ragChunks = await retrieveChunks(expandedMessage, agent.id, 5);
          const ragContext = formatRagContext(ragChunks);
          if (ragChunks.length > 0) {
            send({ type: "status", text: `📚 Found ${ragChunks.length} knowledge base chunks` });
            const ragMeta = ragChunks.map(c => ({ title: c.title, url: c.url }));
            const existingUrls = new Set(sourceMeta.map(s => s.url));
            ragMeta.forEach(r => { if (!existingUrls.has(r.url)) sourceMeta.push(r); });
          }

          // Step 6: Build the user message — use expanded for search context, show original to user
          const userMessage = searchContext
            ? `[LIVE SEARCH RESULTS - ${new Date().toLocaleDateString()}]\n\n${searchContext}\n\n---\n[USER QUESTION]\n${expandedMessage}`
            : expandedMessage;

          // Build approved sources block for linking instructions
          const approvedSourcesBlock = sourceMeta.length > 0
            ? `\n\n[APPROVED SOURCES]\n` +
              sourceMeta.map(s => `- ${s.title}: ${s.url}`).join("\n") +
              `\n\nDo NOT include any markdown links or URLs in your answer text. Do not write [text](url) anywhere. Sources will be appended automatically after your answer.`
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

          // Post-processing: if LLM didn't add Sources but we have sources, append them
          if (sourceMeta.length > 0 && !/##\s*sources/i.test(fullResponse)) {
            const trusted = ["fujixweekly.com", "fujifilm.com", "dpreview.com", "bhphotovideo.com", "mirrorlessons.com", "fujilove.com"];
            const sorted = [...sourceMeta].sort((a, b) => {
              const aScore = trusted.some(d => a.url.includes(d)) ? 1 : 0;
              const bScore = trusted.some(d => b.url.includes(d)) ? 1 : 0;
              return bScore - aScore;
            });
            const topSources = sorted.slice(0, 3);
            const sourcesAppend = "\n\n## Sources\n" + topSources.map(s => `- [${s.title}](${s.url})`).join("\n");
            fullResponse += sourcesAppend;
            send({ type: "text", text: sourcesAppend });
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
                  content: `Question: ${expandedMessage}\n\nAnswer summary: ${fullResponse.slice(0, 800)}`
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
                  content: `Question: ${expandedMessage}\n\nAnswer: ${fullResponse.slice(0, 1500)}`
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
