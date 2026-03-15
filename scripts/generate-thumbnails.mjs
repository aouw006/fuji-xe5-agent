#!/usr/bin/env node
/**
 * generate-thumbnails.mjs
 *
 * One-time script to generate JPEG thumbnails for all Drive PDFs.
 * Thumbnails are saved to public/thumbnails/{fileId}.jpg and served as
 * static assets by Next.js. Run monthly for new issues.
 *
 * Usage:
 *   npm install pdfjs-dist canvas   (first time only)
 *   node scripts/generate-thumbnails.mjs
 *
 * Then commit and push:
 *   git add public/thumbnails && git commit -m "Add magazine thumbnails" && git push
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── .env.local loader ─────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const lines = readFileSync(join(ROOT, ".env.local"), "utf8").split("\n");
    for (const line of lines) {
      const eqIdx = line.indexOf("=");
      if (eqIdx < 1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch {
    console.warn("Could not load .env.local — using process environment");
  }
}

// ── Google Drive auth ─────────────────────────────────────────────────────────
function createJWT(email, key) {
  const now = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  ).toString("base64url");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${h}.${p}`);
  return `${h}.${p}.${sign.sign(key, "base64url")}`;
}

async function getAccessToken(email, key) {
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

// ── Drive file listing ────────────────────────────────────────────────────────
async function listDriveFiles(token, folderId) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
    fields: "files(id,name,size)",
    pageSize: "500",
    orderBy: "name",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Drive list failed");
  return data.files || [];
}

// ── PDF download (first N bytes only) ────────────────────────────────────────
async function downloadPdfStart(token, fileId, bytes = 6 * 1024 * 1024) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Range: `bytes=0-${bytes - 1}`,
      },
    }
  );
  // 206 Partial Content is success for Range requests
  if (res.status !== 200 && res.status !== 206) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ── PDF page 1 → JPEG ─────────────────────────────────────────────────────────
async function renderFirstPage(pdfBuffer) {
  const { createCanvas } = await import("canvas");

  // Try legacy build first (better Node.js compat), fall back to main
  let getDocument;
  try {
    const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
    getDocument = mod.getDocument;
  } catch {
    try {
      const mod = await import("pdfjs-dist/legacy/build/pdf.js");
      getDocument = mod.getDocument;
    } catch {
      const mod = await import("pdfjs-dist");
      getDocument = mod.getDocument;
    }
  }

  // Minimal canvas factory required by pdfjs in Node.js
  const canvasFactory = {
    create: (w, h) => {
      const canvas = createCanvas(w, h);
      return { canvas, context: canvas.getContext("2d") };
    },
    reset: (obj, w, h) => {
      obj.canvas.width = w;
      obj.canvas.height = h;
    },
    destroy: (obj) => {
      obj.canvas.width = 0;
      obj.canvas.height = 0;
    },
  };

  const pdf = await getDocument({
    data: new Uint8Array(pdfBuffer),
    canvasFactory,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const page = await pdf.getPage(1);

  // Render at ~400px wide
  const naturalViewport = page.getViewport({ scale: 1 });
  const scale = 400 / naturalViewport.width;
  const viewport = page.getViewport({ scale });

  const { canvas, context } = canvasFactory.create(
    Math.round(viewport.width),
    Math.round(viewport.height)
  );

  await page.render({ canvasContext: context, viewport }).promise;
  await pdf.destroy();

  return canvas.toBuffer("image/jpeg", { quality: 0.85 });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  loadEnv();

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const folderId = process.env.GOOGLE_DRIVE_LIBRARY_FOLDER;

  if (!serviceAccountJson || !folderId) {
    console.error(
      "❌  Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_DRIVE_LIBRARY_FOLDER in .env.local"
    );
    process.exit(1);
  }

  const sa = JSON.parse(serviceAccountJson);
  const privateKey = sa.private_key.replace(/\\n/g, "\n");

  console.log("🔑  Getting Drive access token...");
  const token = await getAccessToken(sa.client_email, privateKey);

  console.log("📂  Listing Drive files...");
  const files = await listDriveFiles(token, folderId);
  console.log(`    Found ${files.length} PDFs\n`);

  const thumbDir = join(ROOT, "public", "thumbnails");
  mkdirSync(thumbDir, { recursive: true });

  let generated = 0,
    skipped = 0,
    failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const thumbPath = join(thumbDir, `${file.id}.jpg`);
    const sizeMb = (parseInt(file.size || "0") / 1024 / 1024).toFixed(1);
    const prefix = `  [${String(i + 1).padStart(3)}/${files.length}]`;

    if (existsSync(thumbPath)) {
      console.log(`${prefix} ✓ SKIP   ${file.name}`);
      skipped++;
      continue;
    }

    process.stdout.write(`${prefix} ⟳ GEN    ${file.name} (${sizeMb} MB)...`);

    try {
      const pdfBuffer = await downloadPdfStart(token, file.id);
      const jpeg = await renderFirstPage(pdfBuffer);
      writeFileSync(thumbPath, jpeg);
      process.stdout.write(` ✓\n`);
      generated++;
    } catch (e) {
      process.stdout.write(` ✗ ${e.message}\n`);
      failed++;
    }
  }

  console.log(
    `\n📊  Done — ${generated} generated, ${skipped} already existed, ${failed} failed`
  );

  if (generated > 0) {
    console.log(`\n📁  Thumbnails saved to: public/thumbnails/`);
    console.log(
      `    Commit & push:\n    git add public/thumbnails && git commit -m "Add magazine thumbnails" && git push`
    );
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
