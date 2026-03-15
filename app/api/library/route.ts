import { NextResponse } from "next/server";
import crypto from "crypto";

function createJWT(clientEmail: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(privateKey, "base64url");

  return `${header}.${payload}.${signature}`;
}

async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const jwt = createJWT(clientEmail, privateKey);
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

export async function GET() {
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const folderId = process.env.GOOGLE_DRIVE_LIBRARY_FOLDER;

    if (!raw || !folderId) {
      return NextResponse.json({ error: "Google Drive not configured" }, { status: 500 });
    }

    const sa = JSON.parse(raw);
    const privateKey = sa.private_key.replace(/\\n/g, "\n");
    const accessToken = await getAccessToken(sa.client_email, privateKey);

    // List all PDFs in the folder
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: "files(id,name,size,modifiedTime,webViewLink,thumbnailLink)",
      pageSize: "500",
      orderBy: "name",
    });

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error?.message || "Drive API error" }, { status: 500 });

    const files = (data.files || []).map((f: {
      id: string;
      name: string;
      size?: string;
      modifiedTime?: string;
      webViewLink?: string;
      thumbnailLink?: string;
    }) => ({
      id: f.id,
      name: f.name,
      size: f.size ? parseInt(f.size) : null,
      modifiedTime: f.modifiedTime || null,
      webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
      // Bump thumbnail resolution from default s220 to s400
      thumbnailLink: f.thumbnailLink ? f.thumbnailLink.replace(/=s\d+$/, "=s400") : null,
    }));

    return NextResponse.json({ files, total: files.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
