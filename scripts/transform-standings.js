#!/usr/bin/env node

/**
 * Transforms daily standings JSON files into a team-keyed timeseries.
 *
 * Usage:
 *   node scripts/transform-standings.js              # process all files
 *   node scripts/transform-standings.js --limit 10   # dry-run on first N files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STANDINGS_DIR = path.join(__dirname, '..', 'data', 'standings');
const OUTPUT_FILE = path.join(__dirname, '..', 'nhl-viz', 'public', 'data', 'timeseries.json');

const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : Infinity;
const isDryRun = limit !== Infinity;

// Map: triCode -> { meta, data[] }
const teamMap = {};

function processFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const date = raw.standings[0]?.date ?? path.basename(filePath, '.json');

  // Build per-conference relative rank for division leaders (wcSeq === 0).
  // There are exactly 6 division leaders per conference (top 3 from each of
  // the 2 divisions). Rank them 1–6 by conference sequence so they always
  // occupy slots 1–6 in the wildcard view, with the wildcard pool at 7–16.
  const confLeaderRank = new Map(); // triCode -> wildcardRank
  const byConf = {};
  for (const t of raw.standings) {
    if ((t.wildcardSequence ?? 0) === 0) {
      (byConf[t.conferenceName] ??= []).push(t);
    }
  }
  for (const leaders of Object.values(byConf)) {
    leaders
      .sort((a, b) => a.conferenceSequence - b.conferenceSequence)
      .forEach((t, i) => confLeaderRank.set(t.teamAbbrev.default, i + 1));
  }

  for (const t of raw.standings) {
    const triCode = t.teamAbbrev.default;

    if (!teamMap[triCode]) {
      teamMap[triCode] = {
        triCode,
        name: t.teamName.default,
        conference: t.conferenceName,
        conferenceAbbrev: t.conferenceAbbrev,
        division: t.divisionName,
        divisionAbbrev: t.divisionAbbrev,
        data: [],
      };
    }

    const wcSeq = t.wildcardSequence ?? 0;
    // Division leaders get relative rank 1–6; wildcard pool follows at 7–16.
    const wildcardRank = wcSeq === 0 ? confLeaderRank.get(triCode) : 6 + wcSeq;

    teamMap[triCode].data.push({
      date,
      gp:               t.gamesPlayed,
      points:           t.points,
      pointPctg:        Math.round(t.pointPctg * 1000) / 1000,
      wins:             t.wins,
      losses:           t.losses,
      otLosses:         t.otLosses,
      goalFor:          t.goalFor,
      goalAgainst:      t.goalAgainst,
      goalDiff:         t.goalDifferential,
      leagueRank:       t.leagueSequence,
      conferenceRank:   t.conferenceSequence,
      divisionRank:     t.divisionSequence,
      wildcardSequence: wcSeq,
      wildcardRank,
      clinchIndicator:  t.clinchIndicator ?? null,
    });
  }
}

// Get all standings files sorted chronologically
let files = fs.readdirSync(STANDINGS_DIR)
  .filter(f => f.endsWith('.json'))
  .sort();

if (isDryRun) {
  files = files.slice(0, limit);
  console.log(`Dry-run mode: processing first ${files.length} files (${files[0]} → ${files.at(-1)})`);
} else {
  console.log(`Processing ${files.length} files...`);
}

for (const file of files) {
  processFile(path.join(STANDINGS_DIR, file));
  process.stdout.write(`  ${file}\r`);
}

const teams = Object.values(teamMap).sort((a, b) =>
  a.triCode.localeCompare(b.triCode)
);

const output = {
  generated: new Date().toISOString().slice(0, 10),
  dryRun: isDryRun,
  datesProcessed: files.length,
  dateRange: { start: files[0], end: files.at(-1) },
  teamCount: teams.length,
  teams,
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

if (isDryRun) {
  const outPath = OUTPUT_FILE.replace('.json', '.dry-run.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nDry-run output written to: nhl-viz/public/data/timeseries.dry-run.json`);
  console.log(`Teams found: ${teams.length}`);
  console.log(`Sample (${teams[0].triCode}):`, JSON.stringify(teams[0].data.slice(0, 3), null, 2));
} else {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nOutput written to: nhl-viz/public/data/timeseries.json`);
  console.log(`Teams: ${teams.length}, Dates: ${files.length}`);
}
