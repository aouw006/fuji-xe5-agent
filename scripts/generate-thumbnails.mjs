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

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { tmpdir } from "os";
import crypto from "crypto";

const GS_BIN = `C:\\Program Files\\gs\\gs10.06.0\\bin\\gswin64c.exe`;

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

// Full download fallback for non-linearized PDFs
async function downloadPdfFull(token, fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Full download failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── PDF page 1 → JPEG via Ghostscript ────────────────────────────────────────
function renderFirstPage(pdfBuffer) {
  const id = crypto.randomBytes(8).toString("hex");
  const tmpPdf = join(tmpdir(), `thumb-${id}.pdf`);
  const tmpJpg = join(tmpdir(), `thumb-${id}.jpg`);

  try {
    writeFileSync(tmpPdf, pdfBuffer);

    execSync(
      `"${GS_BIN}" -dNOPAUSE -dBATCH -dSAFER` +
      ` -sDEVICE=jpeg -dJPEGQ=92 -r144` +
      ` -dFirstPage=1 -dLastPage=1` +
      ` -sOutputFile="${tmpJpg}" "${tmpPdf}"`,
      { stdio: "pipe" }
    );

    return readFileSync(tmpJpg);
  } finally {
    try { unlinkSync(tmpPdf); } catch { /* ignore */ }
    try { unlinkSync(tmpJpg); } catch { /* ignore */ }
  }
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
      let pdfBuffer = await downloadPdfStart(token, file.id);
      let jpeg;
      try {
        jpeg = renderFirstPage(pdfBuffer);
      } catch (renderErr) {
        // Ghostscript sometimes fails on partial downloads — retry with full file
        process.stdout.write(` [retrying full download]...`);
        pdfBuffer = await downloadPdfFull(token, file.id);
        jpeg = renderFirstPage(pdfBuffer);
      }
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
