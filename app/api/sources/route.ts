import { getAgentSources, addAgentSource, deleteAgentSource } from "@/lib/analytics";

export async function GET() {
  const sources = await getAgentSources();
  return Response.json({ sources });
}

export async function POST(req: Request) {
  const { agentId, domain } = await req.json();
  if (!agentId || !domain) return Response.json({ error: "Missing fields" }, { status: 400 });
  const source = await addAgentSource(agentId, domain);
  return Response.json({ source });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  await deleteAgentSource(id);
  return Response.json({ ok: true });
}
