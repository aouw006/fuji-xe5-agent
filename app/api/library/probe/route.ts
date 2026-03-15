import { NextRequest, NextResponse } from "next/server";
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

// GET /api/library/probe?id=FILE_ID
// Returns raw Drive metadata for a single file — useful for diagnosing missing thumbnails
export async function GET(req: NextRequest) {
  const fileId = req.nextUrl.searchParams.get("id");
  if (!fileId) return NextResponse.json({ error: "Pass ?id=FILE_ID" }, { status: 400 });

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const sa = JSON.parse(raw);
  const token = await getAccessToken(sa.client_email, sa.private_key.replace(/\\n/g, "\n"));

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,size,mimeType,hasThumbnail,thumbnailLink,thumbnailVersion,webViewLink,modifiedTime`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();
  return NextResponse.json(data);
}
