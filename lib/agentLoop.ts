/**
 * Agentic Comparison Loop — Manual JSON Tool Dispatch
 *
 * We avoid Groq's native tool_use (unreliable with Llama 3.3).
 * Instead, we ask the model to output a JSON decision each step,
 * parse it ourselves, execute the tool, and feed results back.
 */

import Groq from "groq-sdk";
import { retrieveChunks } from "@/lib/rag";
import type { AgentStep } from "@/lib/memory";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const TAVILY_KEY = process.env.TAVILY_API_KEY!;
const MAX_STEPS = 6;

// ─── Tools ────────────────────────────────────────────────────────────────────

async function searchWeb(query: string, send: (d: object) => void): Promise<string> {
  send({ type: "status", text: `🔍 Searching: "${query}"` });
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_KEY, query, max_results: 5 }),
    });
    const data = await res.json();
    return (data.results || [])
      .map((r: { title: string; url: string; content: string }, i: number) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`
      )
      .join("\n\n---\n\n") || "No results found.";
  } catch (e) { return `Search failed: ${e}`; }
}

async function fetchUrl(url: string, send: (d: object) => void): Promise<string> {
  send({ type: "status", text: `📄 Reading: ${url}` });
  try {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_KEY, urls: [url] }),
    });
    const data = await res.json();
    return (data.results?.[0]?.raw_content || "").slice(0, 3000) || "Could not extract content.";
  } catch (e) { return `Fetch failed: ${e}`; }
}

async function searchKnowledgeBase(query: string, send: (d: object) => void): Promise<string> {
  send({ type: "status", text: `📚 Searching knowledge base: "${query}"` });
  try {
    const chunks = await retrieveChunks(query, undefined, 5, 0.3);
    if (chunks.length === 0) return "No relevant results found in knowledge base.";
    return chunks.map((c, i) => `[${i + 1}] ${decodeHtml(c.title)}\n${decodeHtml(c.content)}\n(${c.url})`).join("\n\n---\n\n");
  } catch (e) { return `Knowledge base search failed: ${e}`; }
}

// ─── Decision parsing ─────────────────────────────────────────────────────────

type Decision =
  | { action: "search_web"; query: string }
  | { action: "search_knowledge_base"; query: string }
  | { action: "fetch_url"; url: string }
  | { action: "answer"; text: string };

function parseDecision(raw: string): Decision | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (obj.action === "answer" && obj.text) return obj as Decision;
    if (obj.action === "search_web" && obj.query) return obj as Decision;
    if (obj.action === "search_knowledge_base" && obj.query) return obj as Decision;
    if (obj.action === "fetch_url" && obj.url) return obj as Decision;
    return null;
  } catch { return null; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeHtml(str: string): string {
  return str
    .replace(/&#8217;/g, "'").replace(/&#8216;/g, "'").replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "–").replace(/&#8212;/g, "—").replace(/&#038;/g, "&").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#\d+;/g, "");
}

function summarise(text: string, len = 200): string {
  const clean = decodeHtml(text);
  if (clean.length <= len) return clean;
  // Try to cut at a sentence boundary
  const cut = clean.slice(0, len);
  const lastPeriod = cut.lastIndexOf(".");
  return lastPeriod > len * 0.6 ? cut.slice(0, lastPeriod + 1) : cut + "…";
}



const PLANNER_SYSTEM = `You are a research agent for Fujifilm X-E5 photography. Gather information step by step before writing a final answer.

Each response must be a single JSON object. Choose one action:

Search the web: {"action": "search_web", "query": "specific query"}
Search knowledge base: {"action": "search_knowledge_base", "query": "query"}
Read a URL: {"action": "fetch_url", "url": "https://..."}
Final answer: {"action": "answer", "text": "your complete markdown answer"}

Start with search_knowledge_base. Use search_web for prices (include AUD). After 2-3 searches, write your answer. Never repeat a search. Respond with JSON only.`;

// ─── Main loop ────────────────────────────────────────────────────────────────

export async function runComparisonAgent(
  message: string,
  systemPrompt: string,
  memorySummary: string,
  send: (data: object) => void
): Promise<{ answer: string; steps: AgentStep[] }> {
  send({ type: "status", text: "🤔 Planning research strategy..." });

  const researchMessages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: `Research this question: ${message}` },
  ];

  const agentSteps: AgentStep[] = [];
  let researchSummary = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    send({ type: "status", text: `Research step ${step + 1}...` });

    let raw = "";
    try {
      const res = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: PLANNER_SYSTEM }, ...researchMessages],
        max_tokens: 400,
        temperature: 0.1,
      });
      raw = res.choices[0].message.content || "";
    } catch (e) {
      console.log("[agentLoop] planner error:", e);
      break;
    }

    console.log("[agentLoop] step", step + 1, ":", raw.slice(0, 150));
    const decision = parseDecision(raw);

    if (!decision) {
      console.log("[agentLoop] could not parse decision");
      break;
    }

    if (decision.action === "answer") {
      researchSummary = decision.text;
      break;
    }

    let toolResult = "";
    let toolInput = "";

    if (decision.action === "search_web") {
      toolInput = decision.query;
      toolResult = await searchWeb(decision.query, send);
    } else if (decision.action === "search_knowledge_base") {
      toolInput = decision.query;
      toolResult = await searchKnowledgeBase(decision.query, send);
    } else if (decision.action === "fetch_url") {
      toolInput = decision.url;
      toolResult = await fetchUrl(decision.url, send);
    }

    agentSteps.push({
      step: agentSteps.length + 1,
      tool: decision.action,
      input: toolInput,
      result_summary: summarise(toolResult),
    });

    researchMessages.push({ role: "assistant", content: raw });
    researchMessages.push({
      role: "user",
      content: `Tool result:\n${toolResult.slice(0, 2000)}\n\nContinue researching or write your final answer as JSON.`,
    });
  }

  // Synthesise final answer using the agent's full system prompt
  let finalAnswer = researchSummary;

  if (!finalAnswer) {
    send({ type: "status", text: "Synthesising findings..." });

    const researchContext = researchMessages
      .filter(m => m.role === "user" && m.content.startsWith("Tool result:"))
      .map((m, i) => `[Research ${i + 1}]\n${m.content.replace("Tool result:\n", "").replace(/\n\nContinue.*$/, "")}`)
      .join("\n\n---\n\n");

    const synthRes = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt + memorySummary },
        {
          role: "user",
          content: researchContext
            ? `[RESEARCH GATHERED]\n${researchContext}\n\n---\n[QUESTION]\n${message}`
            : message,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });
    finalAnswer = synthRes.choices[0].message.content || "";
  }

  return { answer: finalAnswer, steps: agentSteps };
}