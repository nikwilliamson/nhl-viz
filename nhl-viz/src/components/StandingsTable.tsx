import { useMemo } from 'react';
import { teamStyles } from '../teamStyles';
import type { TeamSeries, DayPoint } from './StandingsViz';
import type { RankField } from './BumpChart';

const DIVISION_ORDER = ['Atlantic', 'Metropolitan', 'Central', 'Pacific'];

interface Props {
  teams: TeamSeries[];
  scrubDate: string;
  highlightedTeam: string | null;
  onHighlight: (triCode: string | null) => void;
  rankField: RankField;
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

export function StandingsTable({ teams, scrubDate, highlightedTeam, onHighlight, rankField }: Props) {
  const rows = useMemo<TeamRow[]>(() => {
    return teams
      .map(t => {
        const snap = t.data.find(d => d.date === scrubDate) ?? t.data[0];
        return { triCode: t.triCode, name: t.name, conference: t.conference, conferenceAbbrev: t.conferenceAbbrev, division: t.division, divisionAbbrev: t.divisionAbbrev, snap };
      })
      .filter(r => r.snap != null);
  }, [teams, scrubDate]);

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
              onClick={() => onHighlight(row.triCode)}
            />
          ))}
        </div>
      </div>
    );
  }

  // Division view: 4 division sections in canonical order
  if (rankField === 'divisionRank') {
    return (
      <div className="standings-table">
        <div className="standings-date">{formatDate(scrubDate)}</div>
        {DIVISION_ORDER.map(div => {
          const divRows = rows
            .filter(r => r.division === div)
            .sort((a, b) => a.snap.divisionRank - b.snap.divisionRank || b.snap.points - a.snap.points);
          return (
            <div key={div} className="conf-section">
              <div className="conf-header">{div}</div>
              {divRows.map((row, i) => {
                const inPlayoffs = inPlayoffsSet.has(row.triCode);
                const isDivLeader = i < 3;
                return (
                  <TeamRowItem
                    key={row.triCode}
                    row={row}
                    rankLabel={isDivLeader ? `${i + 1}` : '–'}
                    inPlayoffs={inPlayoffs}
                    isEliminated={!inPlayoffs}
                    isHighlighted={highlightedTeam === row.triCode}
                    showPlayoffLine={i === 2}
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

  // Conference view: division leaders + wildcard, sorted by seed position then points
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

        const wc1 = wildcardPool[0];
        const wc2 = wildcardPool[1];
        const confInPlayoffs = new Set([...divisionLeaders, wc1?.triCode, wc2?.triCode].filter(Boolean));

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
                      inPlayoffs={true}
                      isHighlighted={highlightedTeam === row.triCode}
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
                return (
                  <TeamRowItem
                    key={row.triCode}
                    row={row}
                    rankLabel={rankLabel}
                    inPlayoffs={confInPlayoffs.has(row.triCode)}
                    isWildcard={isWC}
                    isEliminated={!confInPlayoffs.has(row.triCode)}
                    isHighlighted={highlightedTeam === row.triCode}
                    showPlayoffLine={i === 1}
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
  isHighlighted, showPlayoffLine = false, onClick,
}: {
  row: TeamRow;
  rankLabel: string;
  inPlayoffs: boolean;
  isWildcard?: boolean;
  isEliminated?: boolean;
  isHighlighted: boolean;
  showPlayoffLine?: boolean;
  onClick: () => void;
}) {
  const { snap, triCode, name } = row;
  const style = teamStyles[triCode];
  const color = style?.primaryColor ?? '#888';
  const record = `${snap.wins}-${snap.losses}-${snap.otLosses}`;
  const diff = snap.goalDiff > 0 ? `+${snap.goalDiff}` : `${snap.goalDiff}`;

  return (
    <>
      <div
        className={[
          'team-row',
          isWildcard     ? 'team-row--wc'        : '',
          isEliminated   ? 'team-row--eliminated' : '',
          inPlayoffs     ? 'team-row--playoff'    : '',
          isHighlighted  ? 'team-row--highlighted': '',
        ].filter(Boolean).join(' ')}
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
        <span className={`team-diff ${snap.goalDiff > 0 ? 'pos' : snap.goalDiff < 0 ? 'neg' : ''}`}>
          {snap.gp > 0 ? diff : '—'}
        </span>
      </div>
      {showPlayoffLine && <div className="playoff-line" />}
    </>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
