import { NextRequest, NextResponse } from "next/server";
import { loadAgentPrompts, saveAgentPrompt } from "@/lib/memory";
import { SUB_AGENTS } from "@/lib/agents";

export async function GET() {
  const dbPrompts = await loadAgentPrompts();
  // Merge DB overrides with hardcoded defaults
  const prompts: Record<string, string> = {};
  for (const id of Object.keys(SUB_AGENTS)) {
    prompts[id] = dbPrompts[id] || SUB_AGENTS[id].systemPrompt;
  }
  return NextResponse.json(prompts);
}

export async function POST(req: NextRequest) {
  const { agentId, prompt } = await req.json();
  if (!agentId || !prompt) return NextResponse.json({ error: "Missing agentId or prompt" }, { status: 400 });
  await saveAgentPrompt(agentId, prompt);
  return NextResponse.json({ ok: true });
}
