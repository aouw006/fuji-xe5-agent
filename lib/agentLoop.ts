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
const MAX_STEPS = 10;

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
  | { action: "search_web"; query: string; reasoning?: string }
  | { action: "search_knowledge_base"; query: string; reasoning?: string }
  | { action: "fetch_url"; url: string; reasoning?: string }
  | { action: "answer"; text: string; reasoning?: string };

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

function summarise(text: string, len = 220): string {
  const clean = decodeHtml(text);
  const lines = clean.split("\n")
    .map(l => l.trim())
    .filter(l =>
      l.length > 30 &&
      !l.match(/^\[\d+\]/) &&       // skip [1], [2] index markers
      !l.startsWith("URL:") &&
      !l.startsWith("(http") &&
      !l.match(/^https?:\/\//) &&
      !l.match(/camera with a .* lens/i) &&  // skip image alt text
      !l.match(/^image:/i) &&
      !l.match(/\.(jpg|jpeg|png|webp)/i)     // skip image filenames
    );
  const body = lines.join(" ");
  if (!body) return clean.replace(/\s+/g, " ").slice(0, len) + "…";
  if (body.length <= len) return body;
  const cut = body.slice(0, len);
  const lastPeriod = cut.lastIndexOf(".");
  return lastPeriod > len * 0.5 ? cut.slice(0, lastPeriod + 1) : cut + "…";
}



const PLANNER_SYSTEM = `You are a research agent for Fujifilm X-E5 photography. You research questions step by step, evaluating what you find before deciding what to do next.

Each response must be a single JSON object. Available actions:

{"action": "search_knowledge_base", "query": "...", "reasoning": "..."}
{"action": "search_web", "query": "...", "reasoning": "..."}
{"action": "fetch_url", "url": "https://...", "reasoning": "..."}
{"action": "answer", "text": "your full markdown answer", "reasoning": "..."}

DECISION STRATEGY:
1. Start with search_knowledge_base — check curated Fujifilm articles first
2. Evaluate the result:
   - If results are RELEVANT and detailed → you may have enough, consider answering or doing one more targeted search
   - If results are WEAK or off-topic → search the web instead
   - If a search result contains a URL that looks highly relevant (e.g. a specific lens review) → use fetch_url to read it in full
3. For comparisons: get specs for EACH item, then prices
4. For prices: always search_web with "AUD" in the query
5. Use fetch_url when you spot a promising URL in search results — it gives you full article content, not just snippets
6. Answer when you have concrete specs, prices, or recommendations — don't keep searching if you have enough

MINIMUM RESEARCH BEFORE ANSWERING:
- At least one knowledge_base search
- At least one web search
- At least one fetch_url (pick the most relevant URL from any search result)
- For comparisons: specs AND prices for EACH item being compared
- Only call "answer" once you have all of the above


- "The knowledge base returned weak results about X, so I'll search the web for current reviews"
- "Search result [2] links to a full lens review — I'll fetch that for detailed specs"
- "I now have specs for both lenses and AUD prices — I have enough to write a complete comparison"

Respond with valid JSON only. No other text.`;

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

  // Running knowledge ledger — builds up what the agent has found so far
  const knowledgeLedger: { step: number; tool: string; input: string; keyFindings: string }[] = [];

  async function updateLedger(step: number, tool: string, input: string, result: string) {
    // Ask the model to extract key findings from this result in context of the question
    try {
      const res = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `Extract the most important facts from this research result that are relevant to answering: "${message}". 
Be specific — extract actual values, prices, specs, names. Max 3 sentences. If the result has nothing useful, say "No useful findings."`,
          },
          { role: "user", content: result.slice(0, 1500) },
        ],
        max_tokens: 150,
        temperature: 0.1,
      });
      const findings = res.choices[0].message.content || "No useful findings.";
      knowledgeLedger.push({ step, tool, input, keyFindings: findings });
    } catch {
      knowledgeLedger.push({ step, tool, input, keyFindings: summarise(result, 150) });
    }
  }

  function buildLedgerContext(): string {
    if (knowledgeLedger.length === 0) return "";
    return `\n\n[RESEARCH SO FAR]\n` +
      knowledgeLedger.map(l =>
        `Step ${l.step} — ${l.tool} ("${l.input}"):\n${l.keyFindings}`
      ).join("\n\n") +
      `\n\n[GAPS] What is still missing to fully answer the question? Search for those gaps next.`;
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    send({ type: "status", text: `Research step ${step + 1}...` });

    // Build the first message with the running ledger injected
    const firstMsg = `Research this question: ${message}${buildLedgerContext()}`;
    const messagesWithLedger = [
      { role: "user" as const, content: firstMsg },
      ...researchMessages.slice(1), // skip original first message, replaced above
    ];

    let raw = "";
    try {
      const res = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: PLANNER_SYSTEM }, ...messagesWithLedger],
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
      reasoning: decision.reasoning || "",
      result_summary: summarise(toolResult),
    });

    // Update the knowledge ledger with key findings from this result
    await updateLedger(agentSteps.length, decision.action, toolInput, toolResult);

    // Update the last step's result_summary with the extracted key findings
    const lastLedger = knowledgeLedger[knowledgeLedger.length - 1];
    if (lastLedger && agentSteps.length > 0) {
      agentSteps[agentSteps.length - 1].result_summary = lastLedger.keyFindings;
    }

    researchMessages.push({ role: "assistant", content: raw });

    // Extract URLs from web search results so the agent can choose to fetch them
    const urlsFound = toolResult.match(/URL: (https?:\/\/[^\s\n]+)/g)
      ?.map(u => u.replace("URL: ", ""))
      .slice(0, 3) || [];

    const urlHint = urlsFound.length > 0
      ? `\n\nURLs found in results (you can fetch any of these for full content):\n${urlsFound.map((u, i) => `[${i + 1}] ${u}`).join("\n")}`
      : "";

    // Signal result quality to help the agent evaluate
    const resultQuality = toolResult.length < 200 || toolResult.includes("No relevant results")
      ? "\n\n⚠ Results were weak or empty — consider a different search or approach."
      : `\n\n✓ Got ${toolResult.split("---").length} result(s).`;

    researchMessages.push({
      role: "user",
      content: `Tool result:\n${toolResult.slice(0, 2000)}${urlHint}${resultQuality}\n\nEvaluate what you found. Then decide your next action as JSON.`,
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