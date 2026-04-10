#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'standings');

const START_DATE = '2025-10-07';
const END_DATE = new Date().toISOString().slice(0, 10);

function generateDates(start, end) {
  const dates = [];
  const current = new Date(start + 'T12:00:00Z');
  const last = new Date(end + 'T12:00:00Z');
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
  return Math.floor(Math.random() * 9000 + 1000); // 1000–10000 ms
}

async function fetchStandings(date) {
  const url = `https://api-web.nhle.com/v1/standings/${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const dates = generateDates(START_DATE, END_DATE);
  console.log(`Fetching standings for ${dates.length} dates (${START_DATE} → ${END_DATE})`);

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const outPath = path.join(OUTPUT_DIR, `${date}.json`);

    if (fs.existsSync(outPath)) {
      console.log(`[${i + 1}/${dates.length}] ${date} — skipped (already exists)`);
      continue;
    }

    try {
      const data = await fetchStandings(date);
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
      console.log(`[${i + 1}/${dates.length}] ${date} — saved`);
    } catch (err) {
      console.error(`[${i + 1}/${dates.length}] ${date} — ERROR: ${err.message}`);
    }

    if (i < dates.length - 1) {
      const delay = randomDelay();
      console.log(`  waiting ${(delay / 1000).toFixed(1)}s...`);
      await sleep(delay);
    }
  }

  console.log('Done.');
}

main();
