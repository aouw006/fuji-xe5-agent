import { NextRequest } from "next/server";
import {
  getActiveProvider,
  setActiveProvider,
  getTavilyLimit,
  setTavilyLimit,
  type SearchProvider,
} from "@/lib/searchProvider";

export async function GET() {
  const [provider, limit] = await Promise.all([getActiveProvider(), getTavilyLimit()]);
  return Response.json({ provider, tavilyLimit: limit });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const valid: SearchProvider[] = ["tavily", "none"];

    if (body.provider !== undefined) {
      if (!valid.includes(body.provider)) {
        return Response.json({ error: "Invalid provider" }, { status: 400 });
      }
      await setActiveProvider(body.provider);
    }

    if (body.tavilyLimit !== undefined) {
      await setTavilyLimit(parseInt(body.tavilyLimit) || 1000);
    }

    const [provider, limit] = await Promise.all([getActiveProvider(), getTavilyLimit()]);
    return Response.json({ provider, tavilyLimit: limit });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
