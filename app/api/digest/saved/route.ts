import { NextRequest } from "next/server";
import type { DigestData } from "@/app/api/digest/route";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path: string, options: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// GET — list all saved editions (metadata only, no full data)
export async function GET() {
  try {
    const rows = await sb("/saved_digests?select=id,date_label,generated_at,created_at&order=created_at.desc&limit=30");
    return Response.json({ editions: rows || [] });
  } catch {
    return Response.json({ editions: [] });
  }
}

// POST — save a new edition
export async function POST(req: NextRequest) {
  try {
    const { data, dateLabel } = await req.json() as { data: DigestData; dateLabel: string };
    if (!data || !dateLabel) return Response.json({ error: "Missing data or dateLabel" }, { status: 400 });

    // Don't save duplicates
    const existing = await sb(`/saved_digests?generated_at=eq.${encodeURIComponent(data.generatedAt)}&select=id`);
    if (existing?.length > 0) return Response.json({ id: existing[0].id, duplicate: true });

    const result = await sb("/saved_digests", {
      method: "POST",
      body: JSON.stringify({ date_label: dateLabel, generated_at: data.generatedAt, data }),
    });
    return Response.json({ id: result?.[0]?.id, saved: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

// GET single edition with full data — /api/digest/saved?id=xxx
// (handled via query param on the same GET route)
export async function PATCH(req: NextRequest) {
  // Used to fetch a single edition's full data by id
  const { id } = await req.json();
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  try {
    const rows = await sb(`/saved_digests?id=eq.${id}&select=id,date_label,generated_at,data,created_at`);
    if (!rows?.length) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(rows[0]);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE — remove a saved edition
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    await sb(`/saved_digests?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    return Response.json({ deleted: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
