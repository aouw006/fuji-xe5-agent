import { NextResponse } from "next/server";
import { getPromptHistory } from "@/lib/memory";

export async function GET() {
  const history = await getPromptHistory(30);
  return NextResponse.json(history);
}
