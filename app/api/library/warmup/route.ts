import { NextResponse } from "next/server";
import crypto from "crypto";

function createJWT(email: string, key: string): string {
  const now = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${h}.${p}`);
  return `${h}.${p}.${sign.sign(key, "base64url")}`;
}

async function getAccessToken(email: string, key: string): Promise<string> {
  const jwt = createJWT(email, key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

export async function POST() {
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const folderId = process.env.GOOGLE_DRIVE_LIBRARY_FOLDER;
    if (!raw || !folderId) return NextResponse.json({ error: "Not configured" }, { status: 500 });

    const sa = JSON.parse(raw);
    const privateKey = sa.private_key.replace(/\\n/g, "\n");
    const token = await getAccessToken(sa.client_email, privateKey);

    // Fetch all PDFs
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: "files(id,name,thumbnailLink)",
      pageSize: "500",
    });
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listData = await listRes.json();
    const files: { id: string; name: string; thumbnailLink?: string }[] = listData.files || [];

    const withoutThumb = files.filter(f => !f.thumbnailLink);
    let triggered = 0;

    // For each file without a thumbnail, make a minimal Range request.
    // Requesting the first byte of the file prompts Drive to process it
    // and queue thumbnail generation in the background.
    for (const file of withoutThumb) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Range: "bytes=0-0",
          },
        });
        triggered++;
      } catch {
        // ignore individual failures
      }
      // Slight delay to avoid hammering the API
      await new Promise(r => setTimeout(r, 50));
    }

    return NextResponse.json({
      total: files.length,
      alreadyHaveThumbnail: files.length - withoutThumb.length,
      triggered,
      message: triggered > 0
        ? `Triggered thumbnail generation for ${triggered} files. Reload the library in a minute or two.`
        : "All files already have thumbnails.",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
