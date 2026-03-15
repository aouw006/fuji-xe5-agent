import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Module-level token cache (lives for the duration of the serverless instance)
let tokenCache: { token: string; expires: number } | null = null;

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

async function getToken(): Promise<string | null> {
  if (tokenCache && Date.now() < tokenCache.expires - 120_000) return tokenCache.token;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    const jwt = createJWT(sa.client_email, sa.private_key.replace(/\\n/g, "\n"));
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    const data = await res.json();
    if (!data.access_token) return null;
    tokenCache = { token: data.access_token, expires: Date.now() + 3_600_000 };
    return data.access_token;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src");
  if (!src) return new NextResponse(null, { status: 400 });

  const token = await getToken();
  if (!token) return new NextResponse(null, { status: 503 });

  try {
    const imgRes = await fetch(decodeURIComponent(src), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!imgRes.ok) return new NextResponse(null, { status: 404 });

    const buffer = await imgRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": imgRes.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400", // browser caches for 24h
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
