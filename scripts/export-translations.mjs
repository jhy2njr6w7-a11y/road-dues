// Run: node scripts/export-translations.mjs
// Writes translations/review-<lang>.csv (opens in Excel) for native speakers to check:
// English text, current translation, and an empty column for their correction.
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-i18n-'));
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
for (const f of ['i18n.js', 'i18n-extra.js', 'i18n-campaigns.js']) {
  const src = fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
  fs.writeFileSync(path.join(tmp, f), src.replace(/from '\.\/(i18n-\w+)'/g, "from './$1.js'"));
}
const { T } = await import(path.join(tmp, 'i18n.js'));

const NAMES = { ar: 'Arabic', hi: 'Hindi', zh: 'Chinese (Simplified)', ru: 'Russian' };
const cell = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
const outDir = new URL('../translations/', import.meta.url);
fs.mkdirSync(outDir, { recursive: true });
for (const [lang, name] of Object.entries(NAMES)) {
  const rows = [['Key', 'English', name, 'Correction (leave empty if fine)', 'Comment']];
  for (const k of Object.keys(T.en)) rows.push([k, T.en[k], T[lang][k], '', '']);
  // BOM so Excel on Windows reads the file as UTF-8
  fs.writeFileSync(new URL(`review-${lang}.csv`, outDir), '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n');
  console.log(`translations/review-${lang}.csv: ${rows.length - 1} strings`);
}
