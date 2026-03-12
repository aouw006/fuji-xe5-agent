/**
 * Agentic Comparison Loop
 *
 * The LLM decides which tools to call and when to stop.
 * Tools: search_web, fetch_url, search_knowledge_base, final_answer
 *
 * Loop:
 *   1. Send goal + tools to Groq
 *   2. LLM returns either a tool_call or final_answer
 *   3. Execute the tool, send result back
 *   4. Repeat until final_answer
 */

import Groq from "groq-sdk";
import { retrieveChunks } from "@/lib/rag";
import type { AgentStep } from "@/lib/memory";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const TAVILY_KEY = process.env.TAVILY_API_KEY!;
const MAX_STEPS = 8; // safety limit

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Groq.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web for current information about cameras, lenses, prices, specs, or reviews. Use specific queries for best results.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query. Be specific — e.g. 'Fujifilm XF 23mm f1.4 R WR price AUD 2025' rather than just 'XF 23mm price'",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Fetch the full content of a specific URL. Use when you have a promising URL from search results and need the complete details.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The full URL to fetch" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Search the curated knowledge base of ingested Fujifilm articles and recipes. Use this first for film recipes, settings, and X-E5 specific topics.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to search for" },
        },
        required: ["query"],
      },
    },
  },
];

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, string>,
  send: (data: object) => void
): Promise<string> {
  if (name === "search_web") {
    send({ type: "status", text: `🔍 Searching: "${args.query}"` });
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_KEY,
          query: args.query,
          max_results: 5,
          include_raw_content: false,
        }),
      });
      const data = await res.json();
      const results = (data.results || [])
        .map((r: { title: string; url: string; content: string }, i: number) =>
          `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`
        )
        .join("\n\n---\n\n");
      return results || "No results found.";
    } catch (e) {
      return `Search failed: ${e}`;
    }
  }

  if (name === "fetch_url") {
    send({ type: "status", text: `📄 Reading: ${args.url}` });
    try {
      const res = await fetch("https://api.tavily.com/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: TAVILY_KEY, urls: [args.url] }),
      });
      const data = await res.json();
      const content = data.results?.[0]?.raw_content || "";
      return content.slice(0, 3000) || "Could not extract content.";
    } catch (e) {
      return `Fetch failed: ${e}`;
    }
  }

  if (name === "search_knowledge_base") {
    send({ type: "status", text: `📚 Searching knowledge base: "${args.query}"` });
    try {
      const chunks = await retrieveChunks(args.query, undefined, 5, 0.3);
      if (chunks.length === 0) return "No relevant results found in knowledge base.";
      return chunks
        .map((c, i) => `[${i + 1}] ${c.title}\n${c.content}\n(${c.url})`)
        .join("\n\n---\n\n");
    } catch (e) {
      return `Knowledge base search failed: ${e}`;
    }
  }

  return "Unknown tool.";
}

// ─── Main agentic loop ────────────────────────────────────────────────────────

export async function runComparisonAgent(
  message: string,
  systemPrompt: string,
  memorySummary: string,
  send: (data: object) => void
): Promise<{ answer: string; steps: AgentStep[] }> {
  send({ type: "status", text: "🤔 Planning research strategy..." });

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        systemPrompt +
        memorySummary +
        `\n\nYou have three tools available: search_knowledge_base, search_web, and fetch_url.

Use them to research before answering. Call search_knowledge_base first, then search_web for current prices or specs. When you have enough information, stop calling tools and write your answer.`,
    },
    {
      role: "user",
      content: message,
    },
  ];

  let steps = 0;
  let finalAnswer = "";
  let toolFailures = 0;
  const agentSteps: AgentStep[] = [];

  while (steps < MAX_STEPS) {
    steps++;
    send({ type: "status", text: `Step ${steps}/${MAX_STEPS}...` });

    let response;
    try {
      response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages,
        tools: TOOLS,
        tool_choice: toolFailures >= 1 ? "none" : "auto", // disable tools after a failure
        max_tokens: toolFailures >= 1 ? 2000 : 1000,
        temperature: 0.3,
      });
    } catch (err: unknown) {
      // Groq returns 400 tool_use_failed when it can't form a valid tool call
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("tool_use_failed") || msg.includes("400")) {
        toolFailures++;
        console.log("[agentLoop] tool_use_failed on step", steps, "— switching to direct answer");
        agentSteps.push({
          step: agentSteps.length + 1,
          tool: "direct_answer",
          input: "(tool call failed, answering from training knowledge)",
          result_summary: msg.slice(0, 200),
        });
        send({ type: "status", text: "Switching to direct answer mode..." });
        if (messages[messages.length - 1]?.role === "assistant") {
          messages.pop();
        }
        messages.push({
          role: "user",
          content: "Based on what you know, write a complete, well-structured answer to the original question.",
        });
        continue;
      }
      throw err;
    }

    const choice = response.choices[0];
    const assistantMsg = choice.message;
    messages.push(assistantMsg);

    // No tool calls — LLM decided to answer directly
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      finalAnswer = assistantMsg.content || "";
      break;
    }

    // Execute each tool call
    for (const toolCall of assistantMsg.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs: Record<string, string> = {};
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        // Bad JSON arguments — skip this tool call, note failure
        toolFailures++;
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: "Error: could not parse tool arguments. Please answer directly.",
        });
        continue;
      }

      const result = await executeTool(toolName, toolArgs, send);

      // Record this step
      agentSteps.push({
        step: agentSteps.length + 1,
        tool: toolName,
        input: toolArgs.query || toolArgs.url || JSON.stringify(toolArgs),
        result_summary: result.slice(0, 200) + (result.length > 200 ? "…" : ""),
      });

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }

  // If we hit the step limit or never got a final answer, force one without tools
  if (!finalAnswer) {
    send({ type: "status", text: "Synthesising findings..." });
    messages.push({
      role: "user",
      content: "You have gathered enough information. Now write your complete, well-structured answer based on everything you've found.",
    });

    const finalResponse = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 2000,
      temperature: 0.7,
      stream: false,
    });

    finalAnswer = finalResponse.choices[0].message.content || "";
  }

  return { answer: finalAnswer, steps: agentSteps };
}