import { useMemo } from 'react';
import { teamStyles } from '../teamStyles';
import type { TeamSeries, DayPoint } from './StandingsViz';
import type { RankField } from './rankField';


interface Props {
  teams: TeamSeries[];
  scrubDate: string;
  highlightedTeam: string | null;
  hoveredTeam: string | null;
  onHighlight: (triCode: string | null) => void;
  rankField: RankField;
  dateRange: [string, string];
  allDates: string[];
}

interface TeamRow {
  triCode: string;
  name: string;
  conference: string;
  conferenceAbbrev: string;
  division: string;
  divisionAbbrev: string;
  snap: DayPoint;
}

export function StandingsTable({ teams, scrubDate, highlightedTeam, hoveredTeam, onHighlight, rankField, dateRange, allDates }: Props) {
  const rows = useMemo<TeamRow[]>(() => {
    return teams
      .map(t => {
        const snap = t.data.find(d => d.date === scrubDate) ?? t.data[0];
        return { triCode: t.triCode, name: t.name, conference: t.conference, conferenceAbbrev: t.conferenceAbbrev, division: t.division, divisionAbbrev: t.divisionAbbrev, snap };
      })
      .filter(r => r.snap != null);
  }, [teams, scrubDate]);

  const showRankDelta = useMemo(() => {
    if (!allDates.length || !dateRange[0] || scrubDate === dateRange[0]) return false;
    const firstMs = new Date(allDates[0] + 'T12:00:00Z').getTime();
    const startMs = new Date(dateRange[0] + 'T12:00:00Z').getTime();
    return (startMs - firstMs) > 7 * 24 * 60 * 60 * 1000;
  }, [allDates, dateRange, scrubDate]);

  const startSnaps = useMemo(() => {
    const map = new Map<string, DayPoint>();
    teams.forEach(t => {
      const s = t.data.find(d => d.date === dateRange[0]) ?? t.data[0];
      if (s) map.set(t.triCode, s);
    });
    return map;
  }, [teams, dateRange]);

  // Compute global playoff set (used by all views)
  const inPlayoffsSet = useMemo(() => {
    const set = new Set<string>();
    (['Eastern', 'Western'] as const).forEach(conf => {
      const confRows = rows.filter(r => r.conference === conf);
      const divisions = Array.from(new Set(confRows.map(r => r.division))).sort();
      const divLeaders = new Set<string>();
      divisions.forEach(div => {
        confRows
          .filter(r => r.division === div)
          .sort((a, b) => a.snap.divisionRank - b.snap.divisionRank || b.snap.points - a.snap.points)
          .slice(0, 3)
          .forEach(r => divLeaders.add(r.triCode));
      });
      const wcPool = confRows
        .filter(r => !divLeaders.has(r.triCode))
        .sort((a, b) => a.snap.conferenceRank - b.snap.conferenceRank || b.snap.points - a.snap.points);
      divLeaders.forEach(tc => set.add(tc));
      if (wcPool[0]) set.add(wcPool[0].triCode);
      if (wcPool[1]) set.add(wcPool[1].triCode);
    });
    return set;
  }, [rows]);

  // League view: flat list sorted by points
  if (rankField === 'leagueRank') {
    const sorted = [...rows].sort((a, b) => b.snap.points - a.snap.points || a.snap.leagueRank - b.snap.leagueRank);

    return (
      <div className="standings-table">
        <div className="standings-date">{formatDate(scrubDate)}</div>
        <div className="conf-section">
          {sorted.map((row, i) => (
            <TeamRowItem
              key={row.triCode}
              row={row}
              rankLabel={`${i + 1}`}
              inPlayoffs={inPlayoffsSet.has(row.triCode)}
              isEliminated={!inPlayoffsSet.has(row.triCode)}
              isHighlighted={highlightedTeam === row.triCode}
              isDimmed={!!hoveredTeam && hoveredTeam !== row.triCode}
              rankDelta={showRankDelta ? getRankDelta(startSnaps.get(row.triCode), row.snap, rankField) : undefined}
              onClick={() => onHighlight(row.triCode)}
            />
          ))}
        </div>
      </div>
    );
  }

  // Division view: conferences as headers, divisions nested within
  if (rankField === 'divisionRank') {
    const CONFERENCE_ORDER = ['Eastern', 'Western'] as const;
    const CONF_DIVISIONS: Record<string, string[]> = {
      Eastern: ['Atlantic', 'Metropolitan'],
      Western: ['Central', 'Pacific'],
    };
    return (
      <div className="standings-table">
        <div className="standings-date">{formatDate(scrubDate)}</div>
        {CONFERENCE_ORDER.map(conf => (
          <div key={conf} className="conf-section">
            <div className="conf-header">{conf} Conference</div>
            {CONF_DIVISIONS[conf].map(div => {
              const divRows = rows
                .filter(r => r.division === div)
                .sort((a, b) => a.snap.divisionRank - b.snap.divisionRank || b.snap.points - a.snap.points);
              return (
                <div key={div} className="division-section">
                  <div className="division-header">{div}</div>
                  {divRows.map((row, i) => {
                    const inPlayoffs = inPlayoffsSet.has(row.triCode);
                    return (
                      <TeamRowItem
                        key={row.triCode}
                        row={row}
                        rankLabel={`${i + 1}`}
                        inPlayoffs={inPlayoffs}
                        isEliminated={!inPlayoffs}
                        isHighlighted={highlightedTeam === row.triCode}
                        isDimmed={!!hoveredTeam && hoveredTeam !== row.triCode}
                        showPlayoffLine={i === 2}
                        rankDelta={showRankDelta ? getRankDelta(startSnaps.get(row.triCode), row.snap, rankField) : undefined}
                        onClick={() => onHighlight(row.triCode)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // Conference view: flat ranked list per conference, playoff line after position 8
  if (rankField === 'conferenceRank') {
    const conferences = ['Eastern', 'Western'] as const;
    return (
      <div className="standings-table">
        <div className="standings-date">{formatDate(scrubDate)}</div>
        {conferences.map(conf => {
          const confRows = rows
            .filter(r => r.conference === conf)
            .sort((a, b) => a.snap.conferenceRank - b.snap.conferenceRank || b.snap.points - a.snap.points);
          return (
            <div key={conf} className="conf-section">
              <div className="conf-header">{conf} Conference</div>
              {confRows.map((row, i) => {
                const inPlayoffs = inPlayoffsSet.has(row.triCode);
                return (
                  <TeamRowItem
                    key={row.triCode}
                    row={row}
                    rankLabel={`${i + 1}`}
                    inPlayoffs={inPlayoffs}
                    isEliminated={!inPlayoffs}
                    isHighlighted={highlightedTeam === row.triCode}
                    isDimmed={!!hoveredTeam && hoveredTeam !== row.triCode}
                    showPlayoffLine={i === 7}
                    rankDelta={showRankDelta ? getRankDelta(startSnaps.get(row.triCode), row.snap, rankField) : undefined}
                    onClick={() => onHighlight(row.triCode)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // Wild Card view: top 3 per division under division headers, rest in Wild Card section
  const conferences = ['Eastern', 'Western'] as const;

  return (
    <div className="standings-table">
      <div className="standings-date">{formatDate(scrubDate)}</div>

      {conferences.map(conf => {
        const confRows = rows.filter(r => r.conference === conf);
        const divisions = Array.from(new Set(confRows.map(r => r.division))).sort();

        const divisionLeaders = new Set<string>();
        divisions.forEach(div => {
          confRows
            .filter(r => r.division === div)
            .sort((a, b) => a.snap.divisionRank - b.snap.divisionRank || b.snap.points - a.snap.points)
            .slice(0, 3)
            .forEach(r => divisionLeaders.add(r.triCode));
        });

        const wildcardPool = confRows
          .filter(r => !divisionLeaders.has(r.triCode))
          .sort((a, b) => a.snap.conferenceRank - b.snap.conferenceRank || b.snap.points - a.snap.points);

        return (
          <div key={conf} className="conf-section">
            <div className="conf-header">{conf} Conference</div>

            {divisions.map(div => {
              const divRows = confRows
                .filter(r => r.division === div)
                .sort((a, b) => a.snap.divisionRank - b.snap.divisionRank || b.snap.points - a.snap.points);

              return (
                <div key={div} className="division-section">
                  <div className="division-header">{div}</div>
                  {divRows.slice(0, 3).map((row, i) => (
                    <TeamRowItem
                      key={row.triCode}
                      row={row}
                      rankLabel={`${i + 1}`}
                      inPlayoffs={inPlayoffsSet.has(row.triCode)}
                      isHighlighted={highlightedTeam === row.triCode}
                      isDimmed={!!hoveredTeam && hoveredTeam !== row.triCode}
                      rankDelta={showRankDelta ? getRankDelta(startSnaps.get(row.triCode), row.snap, rankField) : undefined}
                      onClick={() => onHighlight(row.triCode)}
                    />
                  ))}
                </div>
              );
            })}

            <div className="division-section">
              <div className="division-header wildcard-header">Wild Card</div>
              {wildcardPool.map((row, i) => {
                const isWC = i < 2;
                const rankLabel = i === 0 ? 'WC1' : i === 1 ? 'WC2' : '–';
                const inPlayoffs = inPlayoffsSet.has(row.triCode);
                return (
                  <TeamRowItem
                    key={row.triCode}
                    row={row}
                    rankLabel={rankLabel}
                    inPlayoffs={inPlayoffs}
                    isWildcard={isWC}
                    isEliminated={!inPlayoffs}
                    isHighlighted={highlightedTeam === row.triCode}
                    isDimmed={!!hoveredTeam && hoveredTeam !== row.triCode}
                    showPlayoffLine={i === 1}
                    rankDelta={showRankDelta ? getRankDelta(startSnaps.get(row.triCode), row.snap, rankField) : undefined}
                    onClick={() => onHighlight(row.triCode)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TeamRowItem({
  row, rankLabel, inPlayoffs, isWildcard = false, isEliminated = false,
  isHighlighted, isDimmed = false, showPlayoffLine = false, rankDelta, onClick,
}: {
  row: TeamRow;
  rankLabel: string;
  inPlayoffs: boolean;
  isWildcard?: boolean;
  isEliminated?: boolean;
  isHighlighted: boolean;
  isDimmed?: boolean;
  showPlayoffLine?: boolean;
  rankDelta?: number;
  onClick: () => void;
}) {
  const { snap, triCode, name } = row;
  const style = teamStyles[triCode];
  const color = style?.primaryColor ?? '#888';
  const record = `${snap.wins}-${snap.losses}-${snap.otLosses}`;

  return (
    <>
      <div
        className={[
          'team-row',
          isWildcard     ? 'team-row--wc'        : '',
          isEliminated   ? 'team-row--eliminated' : '',
          inPlayoffs     ? 'team-row--playoff'    : '',
          isHighlighted  ? 'team-row--highlighted': '',
          rankDelta !== undefined ? 'team-row--has-delta' : '',
        ].filter(Boolean).join(' ')}
        style={isDimmed ? { opacity: 0.72 } : undefined}
        onClick={onClick}
        title={`Click to ${isHighlighted ? 'deselect' : 'highlight'} ${name}`}
      >
        <span className="team-rank">{rankLabel}</span>
        <span className="team-logo-wrap">
          <img
            src={`${import.meta.env.BASE_URL}img/${triCode}/${triCode}_light.svg`}
            alt={name}
            className="team-logo"
          />
        </span>
        <span className="team-abbrev" style={{ color }}>{triCode}</span>
        <span className="team-record">{record}</span>
        <span className="team-pts">{snap.points}</span>
        {rankDelta !== undefined && (
          <span className={`team-rank-delta ${rankDelta > 0 ? 'delta-up' : rankDelta < 0 ? 'delta-down' : 'delta-flat'}`}>
            {rankDelta > 0 ? `+${rankDelta}` : rankDelta < 0 ? `${rankDelta}` : '–'}
          </span>
        )}
      </div>
      {showPlayoffLine && <div className="playoff-line" />}
    </>
  );
}

function getRankDelta(startSnap: DayPoint | undefined, currentSnap: DayPoint, rf: RankField): number {
  if (!startSnap) return 0;
  const get = (s: DayPoint): number => rf === 'wildcardRank' ? s.wildcardRank : (s as unknown as Record<string, number>)[rf];
  const start = get(startSnap);
  const cur = get(currentSnap);
  if (!start || !cur) return 0;
  return start - cur; // positive = moved up (lower rank number is better)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
