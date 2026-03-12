import { getAllSessions, getSessionMessages, getDailyTokenUsage, getMonthlyTokenUsage } from "@/lib/analytics";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session");
  const type = searchParams.get("type");

  if (type === "tokens") {
    const usage = await getDailyTokenUsage();
    return Response.json(usage);
  }

  if (type === "monthly") {
    const usage = await getMonthlyTokenUsage();
    return Response.json(usage);
  }

  if (sessionId) {
    const messages = await getSessionMessages(sessionId);
    return Response.json({ messages });
  }

  const sessions = await getAllSessions();
  return Response.json({ sessions });
}

export async function DELETE(req: Request) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) return Response.json({ error: "Missing sessionId" }, { status: 400 });
    const { clearSession } = await import("@/lib/memory");
    await clearSession(sessionId);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
