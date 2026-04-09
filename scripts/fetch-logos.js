#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEAMS_FILE = path.join(__dirname, '..', 'data', 'teams.json');
const ASSETS_DIR = path.join(__dirname, '..', 'nhl-viz', 'src', 'assets', 'img');

const teams = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8')).data;
const tricodes = [...new Set(teams.map(t => t.triCode))].sort();

async function downloadSvg(url, destPath) {
  const res = await fetch(url);
  if (res.status === 404) return 'not_found';
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(destPath, text);
  return 'saved';
}

async function main() {
  let saved = 0;
  let skipped = 0;
  let missing = 0;

  for (const code of tricodes) {
    const teamDir = path.join(ASSETS_DIR, code);
    fs.mkdirSync(teamDir, { recursive: true });

    for (const variant of ['light', 'dark']) {
      const filename = `${code}_${variant}.svg`;
      const destPath = path.join(teamDir, filename);

      if (fs.existsSync(destPath)) {
        console.log(`  ${filename} — skipped`);
        skipped++;
        continue;
      }

      const url = `https://assets.nhle.com/logos/nhl/svg/${filename}`;
      try {
        const result = await downloadSvg(url, destPath);
        if (result === 'not_found') {
          console.log(`  ${filename} — not found (404)`);
          missing++;
        } else {
          console.log(`  ${filename} — saved`);
          saved++;
        }
      } catch (err) {
        console.error(`  ${filename} — ERROR: ${err.message}`);
      }
    }
  }

  console.log(`\nDone. ${saved} saved, ${skipped} skipped, ${missing} not found.`);
}

main();
