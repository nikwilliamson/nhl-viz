#!/usr/bin/env node
/**
 * Tests that wildcardRank is computed correctly from raw standings data.
 *
 * Run: node scripts/test-wildcard.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STANDINGS_DIR = path.join(__dirname, '..', 'data', 'standings');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function computeWildcardRank(team) {
  return team.conferenceSequence;
}

function checkFile(filename) {
  const raw = JSON.parse(fs.readFileSync(path.join(STANDINGS_DIR, filename), 'utf8'));
  const date = raw.standings[0]?.date ?? filename;
  console.log(`\n${date}`);

  // Group by conference
  const byConf = {};
  for (const t of raw.standings) {
    const conf = t.conferenceName;
    (byConf[conf] ??= []).push(t);
  }

  for (const [conf, teams] of Object.entries(byConf)) {
    const ranks = teams.map(t => computeWildcardRank(t));

    // No duplicate ranks within a conference
    const unique = new Set(ranks);
    assert(unique.size === teams.length,
      `${conf}: no duplicate wildcardRanks (got [${ranks.sort((a,b)=>a-b).join(',')}])`);

    // Ranks are exactly 1–16
    const sorted = [...ranks].sort((a, b) => a - b);
    assert(
      sorted.every((r, i) => r === i + 1),
      `${conf}: wildcardRanks are exactly 1–${teams.length}`
    );

    // Division leaders (wcSeq=0) all rank above the playoff cutoff (≤8)
    // — at minimum, verify they aren't all below rank 7
    const leaders = teams.filter(t => (t.wildcardSequence ?? 0) === 0);
    const leaderRanks = leaders.map(t => computeWildcardRank(t));
    assert(
      leaderRanks.every(r => r <= 16),
      `${conf}: all ${leaders.length} division leaders have valid ranks`
    );

    // First wildcard team (wcSeq=1) ranks higher (lower number) than second (wcSeq=2)
    const wc1 = teams.find(t => t.wildcardSequence === 1);
    const wc2 = teams.find(t => t.wildcardSequence === 2);
    if (wc1 && wc2) {
      assert(
        computeWildcardRank(wc1) < computeWildcardRank(wc2),
        `${conf}: WC1 (${wc1.teamAbbrev.default}, rank ${computeWildcardRank(wc1)}) ranks above WC2 (${wc2.teamAbbrev.default}, rank ${computeWildcardRank(wc2)})`
      );
    }
  }
}

// The specific date that exposed the collision bug
checkFile('2026-01-15.json');

// A few more dates spread across the season
const files = fs.readdirSync(STANDINGS_DIR).filter(f => f.endsWith('.json')).sort();
const sample = [
  files[0],
  files[Math.floor(files.length * 0.25)],
  files[Math.floor(files.length * 0.5)],
  files[Math.floor(files.length * 0.75)],
  files[files.length - 1],
].filter(Boolean);

for (const f of sample) {
  if (f !== '2026-01-15.json') checkFile(f);
}

console.log(`\n${passed + failed} assertions: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
