import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fileId } = await params;
  const fileName = req.nextUrl.searchParams.get("name") || `${fileId}.pdf`;

  const token = await getToken();
  if (!token) return new NextResponse("Auth failed", { status: 503 });

  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!driveRes.ok) return new NextResponse("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
    "Cache-Control": "private, max-age=3600",
  };
  const cl = driveRes.headers.get("Content-Length");
  if (cl) headers["Content-Length"] = cl;

  return new NextResponse(driveRes.body, { headers });
}
