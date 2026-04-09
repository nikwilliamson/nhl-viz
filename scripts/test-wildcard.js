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

function computeWildcardRank(team, leaderRankMap) {
  const wcSeq = team.wildcardSequence ?? 0;
  return wcSeq === 0 ? leaderRankMap.get(team.teamAbbrev.default) : 6 + wcSeq;
}

function buildLeaderRankMap(standings) {
  const byConf = {};
  for (const t of standings) {
    if ((t.wildcardSequence ?? 0) === 0) {
      (byConf[t.conferenceName] ??= []).push(t);
    }
  }
  const map = new Map();
  for (const leaders of Object.values(byConf)) {
    leaders
      .sort((a, b) => a.conferenceSequence - b.conferenceSequence)
      .forEach((t, i) => map.set(t.teamAbbrev.default, i + 1));
  }
  return map;
}

function checkFile(filename) {
  const raw = JSON.parse(fs.readFileSync(path.join(STANDINGS_DIR, filename), 'utf8'));
  const date = raw.standings[0]?.date ?? filename;
  console.log(`\n${date}`);

  const leaderRankMap = buildLeaderRankMap(raw.standings);

  // Group by conference
  const byConf = {};
  for (const t of raw.standings) {
    (byConf[t.conferenceName] ??= []).push(t);
  }

  for (const [conf, teams] of Object.entries(byConf)) {
    const ranks = teams.map(t => computeWildcardRank(t, leaderRankMap));

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

    // All 6 division leaders (wcSeq=0) occupy ranks 1–6
    const leaders = teams.filter(t => (t.wildcardSequence ?? 0) === 0);
    const leaderRanks = leaders.map(t => computeWildcardRank(t, leaderRankMap)).sort((a,b)=>a-b);
    assert(
      leaders.length === 6 && leaderRanks.every((r, i) => r === i + 1),
      `${conf}: 6 division leaders occupy ranks 1–6 (got [${leaderRanks.join(',')}])`
    );

    // Wildcard pool (wcSeq>0) starts at rank 7
    const pool = teams.filter(t => (t.wildcardSequence ?? 0) > 0);
    const poolRanks = pool.map(t => computeWildcardRank(t, leaderRankMap));
    assert(
      poolRanks.every(r => r >= 7),
      `${conf}: all wildcard pool teams rank 7 or higher (got [${poolRanks.sort((a,b)=>a-b).join(',')}])`
    );

    // WC1 (wcSeq=1) is at rank 7, WC2 (wcSeq=2) is at rank 8
    const wc1 = teams.find(t => t.wildcardSequence === 1);
    const wc2 = teams.find(t => t.wildcardSequence === 2);
    if (wc1 && wc2) {
      assert(
        computeWildcardRank(wc1, leaderRankMap) === 7,
        `${conf}: WC1 (${wc1.teamAbbrev.default}) is at rank 7`
      );
      assert(
        computeWildcardRank(wc2, leaderRankMap) === 8,
        `${conf}: WC2 (${wc2.teamAbbrev.default}) is at rank 8`
      );
    }

    // The date that exposed the original collision bug (Jan 15):
    // SEA (wcSeq=0, confSeq=7) must be rank 6, not 7
    // UTA (wcSeq=1) must be rank 7, not also 7
    if (conf === 'Western' && date === '2026-01-15') {
      const sea = teams.find(t => t.teamAbbrev.default === 'SEA');
      const uta = teams.find(t => t.teamAbbrev.default === 'UTA');
      if (sea && uta) {
        assert(computeWildcardRank(sea, leaderRankMap) === 6,
          `SEA (division leader, confSeq=7) gets wildcardRank 6, not 7`);
        assert(computeWildcardRank(uta, leaderRankMap) === 7,
          `UTA (WC1) gets wildcardRank 7, not also 7`);
      }
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
].filter(f => f && f !== '2026-01-15.json');

for (const f of sample) checkFile(f);

console.log(`\n${passed + failed} assertions: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
