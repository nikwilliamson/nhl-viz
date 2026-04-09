import { useEffect, useState, useMemo, useCallback } from 'react';
import { LineChart } from './LineChart';
import { BumpChart } from './BumpChart';
import { RANK_LABELS } from './rankField';
import type { RankField } from './rankField';
import { StandingsTable } from './StandingsTable';
import { TimelineBrush } from './TimelineBrush';
import { Tabs } from './Tabs';

type Tab = 'line' | 'bump';

type DatePreset = 'all' | '1w' | '1m' | 'pre-olympics' | 'post-olympics' | 'pre-deadline' | 'post-deadline';

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all',           label: 'All' },
  { key: '1w',            label: '1W' },
  { key: '1m',            label: '1M' },
  { key: 'pre-olympics',  label: 'Pre-OLY' },
  { key: 'post-olympics', label: 'Post-OLY' },
  { key: 'pre-deadline',  label: 'Pre-TDL' },
  { key: 'post-deadline', label: 'Post-TDL' },
];

function findNearest(target: string, dates: string[]): string {
  const t = new Date(target + 'T12:00:00Z').getTime();
  return dates.reduce((a, b) =>
    Math.abs(new Date(a + 'T12:00:00Z').getTime() - t) <=
    Math.abs(new Date(b + 'T12:00:00Z').getTime() - t) ? a : b
  );
}

export interface DayPoint {
  date: string;
  gp: number;
  points: number;
  pointPctg: number | null;
  wins: number;
  losses: number;
  otLosses: number;
  goalFor: number;
  goalAgainst: number;
  goalDiff: number;
  leagueRank: number;
  conferenceRank: number;
  divisionRank: number;
  wildcardSequence: number;
  wildcardRank: number;
  clinchIndicator: string | null;
}

export interface TeamSeries {
  triCode: string;
  name: string;
  conference: string;
  conferenceAbbrev: string;
  division: string;
  divisionAbbrev: string;
  data: DayPoint[];
}

interface TimeseriesFile {
  generated: string;
  dateRange: { start: string; end: string };
  teamCount: number;
  teams: TeamSeries[];
}

const DIVISION_ORDER = ['Atlantic', 'Metropolitan', 'Central', 'Pacific'];

export function StandingsViz() {
  const [teams, setTeams] = useState<TeamSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrubDate, setScrubDate] = useState<string>('');
  const [highlightedTeam, setHighlightedTeam] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('bump');
  const [rankField, setRankField] = useState<RankField>('wildcardRank');
  const [dateRange, setDateRange] = useState<[string, string]>(['', '']);
  const [activePreset, setActivePreset] = useState<DatePreset | null>('all');
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/timeseries.json`)
      .then(r => r.json())
      .then((d: TimeseriesFile) => {
        const allDates = Array.from(new Set(d.teams.flatMap(t => t.data.map(p => p.date)))).sort();
        const firstDate = allDates[0] ?? '';
        const lastDate  = allDates[allDates.length - 1] ?? '';
        setTeams(d.teams);
        setScrubDate(lastDate);
        setDateRange([firstDate, lastDate]);
        setActivePreset('all');
        setLoading(false);
      });
  }, []);

  const allDates = useMemo(() => {
    const set = new Set<string>();
    teams.forEach(t => t.data.forEach(d => set.add(d.date)));
    return Array.from(set).sort();
  }, [teams]);

  const handleScrub = useCallback((date: string) => {
    setScrubDate(date);
  }, []);

  const handleBrushChange = useCallback(([start, end]: [string, string]) => {
    setDateRange([start, end]);
    setActivePreset(null);
    // Clamp scrubDate to the new visible range
    setScrubDate(prev => {
      if (prev < start) return start;
      if (prev > end) return end;
      return prev;
    });
  }, []);

  const getPresetRange = useCallback((key: DatePreset): [string, string] => {
    const first = allDates[0];
    const last  = allDates[allDates.length - 1];
    switch (key) {
      case 'all': return [first, last];
      case '1w': {
        const d = new Date(last + 'T12:00:00Z');
        d.setDate(d.getDate() - 7);
        return [findNearest(d.toISOString().slice(0, 10), allDates), last];
      }
      case '1m': {
        const d = new Date(last + 'T12:00:00Z');
        d.setDate(d.getDate() - 30);
        return [findNearest(d.toISOString().slice(0, 10), allDates), last];
      }
      case 'pre-olympics':  return [first, findNearest('2026-02-05', allDates)];
      case 'post-olympics': return [findNearest('2026-02-24', allDates), last];
      case 'pre-deadline':  return [first, findNearest('2026-03-06', allDates)];
      case 'post-deadline': return [findNearest('2026-03-06', allDates), last];
    }
  }, [allDates]);

  const handlePresetClick = useCallback((key: DatePreset) => {
    const range = getPresetRange(key);
    setActivePreset(key);
    setDateRange(range);
    setScrubDate(prev => {
      if (prev < range[0]) return range[0];
      if (prev > range[1]) return range[1];
      return prev;
    });
  }, [getPresetRange]);

  const handleHighlight = useCallback((triCode: string | null) => {
    setHighlightedTeam(prev => prev === triCode ? null : triCode);
  }, []);

  const handleHover = useCallback((triCode: string | null) => {
    setHoveredTeam(triCode);
  }, []);

  // Groups for bump chart: 1 / 2 / 4 charts depending on rankField
  const bumpGroups = useMemo(() => {
    if (rankField === 'leagueRank') {
      return [{ label: '', teams }];
    }
    if (rankField === 'conferenceRank' || rankField === 'wildcardRank') {
      return ['Eastern', 'Western'].map(conf => ({
        label: conf,
        teams: teams.filter(t => t.conference === conf),
      }));
    }
    // divisionRank — 4 charts in canonical order
    return DIVISION_ORDER.map(div => ({
      label: div,
      teams: teams.filter(t => t.division === div),
    }));
  }, [rankField, teams]);

  if (loading) return <div className="loading">Loading standings…</div>;

  return (
    <div className="standings-viz">
      <div className="chart-header">
        <Tabs
          items={[
            { value: 'bump', label: 'Standings' },
            { value: 'line', label: 'Points' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
          layoutId="chart-tab-indicator"
        />

        <div className="date-presets">
          {DATE_PRESETS.map(({ key, label }) => (
            <button
              key={key}
              className={`date-preset-btn${activePreset === key ? ' active' : ''}`}
              onClick={() => handlePresetClick(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <Tabs
          items={(Object.keys(RANK_LABELS) as RankField[]).map(rf => ({ value: rf, label: RANK_LABELS[rf] }))}
          value={rankField}
          onChange={setRankField}
          layoutId="rank-tab-indicator"
        />
      </div>

      <div className="content-row">
        <div className="chart-pane">
          {activeTab === 'line' && (
            <div className="chart-stack">
              {bumpGroups.map((group, i) => (
                <div key={group.label || 'all'} className="chart-stack-item">
                  {group.label && <span className="chart-stack-label">{group.label}</span>}
                  <LineChart
                    teams={group.teams}
                    onScrub={handleScrub}
                    scrubDate={scrubDate}
                    highlightedTeam={highlightedTeam}
                    showXAxis={i === bumpGroups.length - 1}
                    dateRange={dateRange}
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'bump' && (
            <div className="chart-stack">
              {bumpGroups.map((group, i) => (
                <div key={group.label || 'all'} className="chart-stack-item">
                  {group.label && <span className="chart-stack-label">{group.label}</span>}
                  <BumpChart
                    teams={group.teams}
                    onScrub={handleScrub}
                    onHighlight={handleHighlight}
                    onHover={handleHover}
                    scrubDate={scrubDate}
                    highlightedTeam={highlightedTeam}
                    rankField={rankField}
                    showXAxis={i === bumpGroups.length - 1}
                    dateRange={dateRange}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="timeline-brush-strip">
            <TimelineBrush
              dates={allDates}
              range={dateRange}
              onChange={handleBrushChange}
              onScrub={handleScrub}
            />
          </div>
        </div>

        <div className="table-pane">
          <StandingsTable
            teams={teams}
            scrubDate={scrubDate}
            highlightedTeam={highlightedTeam}
            hoveredTeam={hoveredTeam}
            onHighlight={handleHighlight}
            rankField={rankField}
            dateRange={dateRange}
            allDates={allDates}
          />
        </div>
      </div>
    </div>
  );
}
