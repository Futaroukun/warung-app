#!/usr/bin/env node
/**
 * sync-android.js
 * Copy public/* ke android assets, lalu patch index.html:
 * - path absolute (/css/, /js/, /icon.png, /manifest.json) → relative (tanpa leading slash)
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../public');
const DEST = path.resolve(__dirname, '../android/app/src/main/assets');

// ── 1. Copy semua file dari public/ ke assets/ ──────────────────────────────
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}
copyDir(SRC, DEST);
console.log('✓ Copied public/ → android assets');

// ── 2. Patch index.html: absolute path → relative path ─────────────────────
const htmlPath = path.join(DEST, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// href="/xxx" → href="xxx"  |  src="/xxx" → src="xxx"
html = html.replace(/(href|src)="\//g, '$1="');

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('✓ Patched index.html: absolute paths → relative');

// ── 3. Patch api.js di assets: inject APK base URL detection ───────────────
const apiPath = path.join(DEST, 'js', 'api.js');
if (fs.existsSync(apiPath)) {
  let api = fs.readFileSync(apiPath, 'utf8');
  // Ganti baris API_BASE
  api = api.replace(
    /^const API_BASE\s*=\s*['"][^'"]*['"];?/m,
    `const API_BASE = (location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';`
  );
  fs.writeFileSync(apiPath, api, 'utf8');
  console.log('✓ Patched api.js: file:// → localhost:3000/api');
}

console.log('✓ sync-android done');
