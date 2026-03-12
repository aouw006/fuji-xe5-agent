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
): Promise<string> {
  send({ type: "status", text: "🤔 Planning research strategy..." });

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        systemPrompt +
        memorySummary +
        `\n\nYou are operating in AGENTIC MODE. You have access to tools to research thoroughly before answering.

STRATEGY:
- For comparisons: search for specs of EACH item separately, then search for prices, then synthesise
- For recommendations: search knowledge base first, then web for current prices/availability
- Use search_knowledge_base first — it has curated Fujifilm content
- Use search_web for prices, recent reviews, availability (always include "AUD" for prices)
- Use fetch_url when a search result looks highly relevant and you need full details
- Stop when you have enough to give a complete, accurate answer
- Do NOT repeat the same search twice

Always call final_answer when ready — never just stop tool calling.`,
    },
    {
      role: "user",
      content: message,
    },
  ];

  let steps = 0;
  let finalAnswer = "";

  while (steps < MAX_STEPS) {
    steps++;
    send({ type: "status", text: `Step ${steps}/${MAX_STEPS}...` });

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 1000,
      temperature: 0.3, // lower temp for more consistent tool use
    });

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
      } catch {}

      const result = await executeTool(toolName, toolArgs, send);

      // Add tool result to message history
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }

  // If we hit the step limit without a final answer, ask for one explicitly
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

  return finalAnswer;
}
