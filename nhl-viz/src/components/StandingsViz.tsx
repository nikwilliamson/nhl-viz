import { useEffect, useState, useMemo, useCallback } from 'react';
import { chartConfig as C } from '../chartConfig';
import { LineChart } from './LineChart';
import { BumpChart, RANK_LABELS } from './BumpChart';
import type { RankField } from './BumpChart';
import { StandingsTable } from './StandingsTable';

type Tab = 'line' | 'bump';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightedTeam, setHighlightedTeam] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('line');
  const [rankField, setRankField] = useState<RankField>('leagueRank');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/timeseries.json`)
      .then(r => r.json())
      .then((d: TimeseriesFile) => {
        setTeams(d.teams);
        setScrubDate(d.teams[0]?.data[0]?.date ?? '');
        setLoading(false);
      });
  }, []);

  const allDates = useMemo(() => {
    const set = new Set<string>();
    teams.forEach(t => t.data.forEach(d => set.add(d.date)));
    return Array.from(set).sort();
  }, [teams]);

  useEffect(() => {
    if (!isPlaying || allDates.length === 0) return;
    const idx = allDates.indexOf(scrubDate);
    if (idx >= allDates.length - 1) {
      const t = setTimeout(() => setIsPlaying(false), 0);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(() => setScrubDate(allDates[idx + 1]), C.playback.intervalMs);
    return () => clearTimeout(timer);
  }, [isPlaying, scrubDate, allDates]);

  const handleScrub = useCallback((date: string) => {
    setIsPlaying(false);
    setScrubDate(date);
  }, []);

  const handleHighlight = useCallback((triCode: string | null) => {
    setHighlightedTeam(prev => prev === triCode ? null : triCode);
  }, []);

  // Groups for bump chart: 1 / 2 / 4 charts depending on rankField
  const bumpGroups = useMemo(() => {
    if (rankField === 'leagueRank') {
      return [{ label: '', teams }];
    }
    if (rankField === 'conferenceRank') {
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

  const isAtEnd = scrubDate === allDates[allDates.length - 1];

  return (
    <div className="standings-viz">
      <div className="chart-pane">
        <div className="chart-header">
          <button
            className={`play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={() => {
              if (isAtEnd) setScrubDate(allDates[0]);
              setIsPlaying(p => !p);
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '❙❙' : isAtEnd ? '↺' : '▶'}
          </button>

          <div className="chart-tabs">
            <button className={`chart-tab ${activeTab === 'line' ? 'active' : ''}`} onClick={() => setActiveTab('line')}>Points</button>
            <button className={`chart-tab ${activeTab === 'bump' ? 'active' : ''}`} onClick={() => setActiveTab('bump')}>Rankings</button>
          </div>

          <div className="rank-toggle">
            {(Object.keys(RANK_LABELS) as RankField[]).map(rf => (
              <button
                key={rf}
                className={`rank-btn ${rankField === rf ? 'active' : ''}`}
                onClick={() => setRankField(rf)}
              >
                {RANK_LABELS[rf]}
              </button>
            ))}
          </div>
        </div>

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
                  scrubDate={scrubDate}
                  highlightedTeam={highlightedTeam}
                  rankField={rankField}
                  showXAxis={i === bumpGroups.length - 1}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="table-pane">
        <StandingsTable
          teams={teams}
          scrubDate={scrubDate}
          highlightedTeam={highlightedTeam}
          onHighlight={handleHighlight}
          rankField={rankField}
        />
      </div>
    </div>
  );
}
