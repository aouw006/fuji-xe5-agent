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
  // Always inject Fujifilm context so generic terms like "recipes" don't hit food results
  const fujiQuery = /fuji|x-e5|film simulation|xf lens|fujifilm/i.test(query)
    ? query
    : `Fujifilm X-E5 ${query}`;
  send({ type: "status", text: `🔍 Searching: "${fujiQuery}"` });
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_KEY, query: fujiQuery, max_results: 5 }),
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
    if (chunks.length === 0) {
      send({ type: "status", text: `📚 Knowledge base: no results for "${query}"` });
      return "No relevant results found in knowledge base.";
    }
    send({ type: "status", text: `📚 Knowledge base: ${chunks.length} chunks found` });
    return chunks.map((c, i) => `[${i + 1}] ${decodeHtml(c.title)}\nURL: ${c.url}\n${decodeHtml(c.content)}`).join("\n\n---\n\n");
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



const PLANNER_SYSTEM = `You are a research agent for the Fujifilm X-E5 mirrorless camera. You help photographers compare film simulation recipes, lenses, settings, and accessories. 

IMPORTANT DOMAIN CONTEXT:
- "recipes" ALWAYS means Fujifilm film simulation recipes (camera color profiles), NEVER food
- "film recipes" = Fujifilm in-camera color grading presets like Classic Chrome, Eterna, etc.
- All searches are about photography: cameras, lenses, film simulations, settings, accessories
- Always include "Fujifilm" or "film simulation" in your search queries to avoid off-topic results

Each response must be a single JSON object. Available actions:

{"action": "search_knowledge_base", "query": "...", "reasoning": "..."}
{"action": "search_web", "query": "...", "reasoning": "..."}
{"action": "fetch_url", "url": "https://...", "reasoning": "..."}
{"action": "answer", "text": "your full markdown answer", "reasoning": "..."}

DECISION STRATEGY:
1. Start with search_knowledge_base — check curated Fujifilm articles first
2. Always do a SECOND knowledge_base search with a different angle (e.g. first search specs, second search real-world use or reviews)
3. Always do at least TWO web searches — one for specs/reviews, one specifically for prices in AUD
4. Use fetch_url when you spot a promising URL in search results — full article content beats snippets
5. For comparisons: cover specs, real-world use, AND prices for EACH item

MINIMUM BEFORE ANSWERING:
- 2 × search_knowledge_base (different queries)
- 2 × search_web (one for content, one for "price AUD")
- 1 × fetch_url on the most relevant URL found
- Only call "answer" once ALL of the above are done

WHAT GOOD REASONING LOOKS LIKE:
- "I've done one KB search — I need a second with a different angle before searching the web"
- "Search result [2] links to a full lens review — I'll fetch that for detailed specs"
- "I now have 2 KB searches, 2 web searches, and a fetched article — I have enough to answer"

Respond with valid JSON only. No other text.`;

// ─── Main loop ────────────────────────────────────────────────────────────────

export interface SourceEntry {
  title: string;
  url: string;
}

export async function runComparisonAgent(
  message: string,
  systemPrompt: string,
  memorySummary: string,
  send: (data: object) => void
): Promise<{ answer: string; steps: AgentStep[]; sources: SourceEntry[] }> {
  send({ type: "status", text: "🤔 Planning research strategy..." });

  const researchMessages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: `Research this question: ${message}` },
  ];

  const agentSteps: AgentStep[] = [];
  let researchSummary = "";

  // Track how many times each tool has been used
  const toolCounts = { search_knowledge_base: 0, search_web: 0, fetch_url: 0 };

  // Collect titled sources discovered during research
  const discoveredSources = new Map<string, string>(); // url -> title

  function getMissingTools(): string | null {
    const missing: string[] = [];
    if (toolCounts.search_knowledge_base < 2) missing.push(`${2 - toolCounts.search_knowledge_base} more search_knowledge_base (use a different query angle)`);
    if (toolCounts.search_web < 2) missing.push(`${2 - toolCounts.search_web} more search_web (include one for price in AUD)`);
    if (toolCounts.fetch_url < 1) missing.push("1 fetch_url on the most relevant URL found so far");
    return missing.length > 0 ? missing.join("; ") : null;
  }

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
      const missing = getMissingTools();
      if (missing) {
        // Not ready to answer — tell the agent what's still missing
        send({ type: "status", text: `🔄 More research needed...` });
        researchMessages.push({ role: "assistant", content: raw });
        researchMessages.push({
          role: "user",
          content: `You tried to answer but you haven't completed the minimum research yet. You still need: ${missing}. Continue researching.`,
        });
        continue;
      }
      researchSummary = decision.text;
      break;
    }

    let toolResult = "";
    let toolInput = "";

    if (decision.action === "search_web") {
      toolInput = decision.query;
      toolResult = await searchWeb(decision.query, send);
      toolCounts.search_web++;
      // Extract title+URL pairs from search results
      const titleMatches = [...toolResult.matchAll(/\[\d+\] (.+)\nURL: (https?:\/\/[^\s\n]+)/g)];
      for (const m of titleMatches) discoveredSources.set(m[2], m[1].trim());
    } else if (decision.action === "search_knowledge_base") {
      toolInput = decision.query;
      toolResult = await searchKnowledgeBase(decision.query, send);
      toolCounts.search_knowledge_base++;
      const titleMatches = [...toolResult.matchAll(/\[\d+\] (.+)\nURL: (https?:\/\/[^\s\n]+)/g)];
      for (const m of titleMatches) discoveredSources.set(m[2], m[1].trim());
    } else if (decision.action === "fetch_url") {
      toolInput = decision.url;
      toolResult = await fetchUrl(decision.url, send);
      toolCounts.fetch_url++;
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

  // Build the approved sources list for the synthesiser
  const approvedSources = [...discoveredSources.entries()].map(([url, title]) => ({ title, url }));
  const sourcesBlock = approvedSources.length > 0
    ? `\n\n[APPROVED SOURCES — use ONLY these URLs, no others]\n` +
      approvedSources.map(s => `- ${s.title}: ${s.url}`).join("\n") +
      `\n\nLINKING INSTRUCTIONS:
- When you mention a specific article, recipe, or sample image gallery, link the relevant text inline using markdown: [link text](url)
- At the end of your answer, if you referenced 1-3 sources the user would genuinely benefit from visiting, add a ## Sources section with clean title links: [Title](url)
- Only include Sources if the links add real value (e.g. a recipe to follow, a sample gallery, a detailed review). Skip Sources if the answer is self-contained or all links are already inline.
- Never invent URLs. Only use URLs from the APPROVED SOURCES list above.`
    : "";

  // Synthesise final answer using the agent's full system prompt
  let finalAnswer = researchSummary
    // Strip any trailing JSON the agent leaked into the answer text
    ? researchSummary
        .replace(/\n*`{0,3}json[\s\S]*$/i, "")   // ```json ... blocks
        .replace(/\n*Next action:[\s\S]*$/i, "")   // "Next action:" sections
        .replace(/\n*\{[\s\S]*"action"[\s\S]*\}[\s\S]*$/i, "") // raw JSON objects
        .trim()
    : "";

  if (!finalAnswer) {
    send({ type: "status", text: "Synthesising findings..." });

    const researchContext = researchMessages
      .filter(m => m.role === "user" && m.content.startsWith("Tool result:"))
      .map((m, i) => `[Research ${i + 1}]\n${m.content.replace("Tool result:\n", "").replace(/\n\nContinue.*$/, "")}`)
      .join("\n\n---\n\n");

    const synthRes = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt + memorySummary + sourcesBlock + "\n\nIMPORTANT: Write your answer in clean markdown only. Never include JSON, code blocks, 'Next action:', or any structured data in your response." },
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

  return { answer: finalAnswer, steps: agentSteps, sources: approvedSources };
}