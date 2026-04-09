import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { teamStyles } from '../teamStyles';
import { chartConfig as C } from '../chartConfig';
import type { TeamSeries, DayPoint } from './StandingsViz';

interface Segment {
  inPlayoffs: boolean;
  points: DayPoint[];
}

function getSegments(data: DayPoint[]): Segment[] {
  if (data.length === 0) return [];
  const segments: Segment[] = [];
  const isIn = (pt: DayPoint) => pt.conferenceRank > 0 && pt.conferenceRank <= 8;
  let current: Segment = { inPlayoffs: isIn(data[0]), points: [data[0]] };
  for (let i = 1; i < data.length; i++) {
    const pt = data[i];
    const status = isIn(pt);
    if (status !== current.inPlayoffs) {
      current.points.push(pt); // share transition point for smooth join
      segments.push(current);
      current = { inPlayoffs: status, points: [pt] };
    } else {
      current.points.push(pt);
    }
  }
  segments.push(current);
  return segments;
}

export type RankField = 'leagueRank' | 'conferenceRank' | 'divisionRank';

export const RANK_LABELS: Record<RankField, string> = {
  leagueRank:     'League',
  conferenceRank: 'Conference',
  divisionRank:   'Division',
};

const RANK_MAX: Record<RankField, number> = {
  leagueRank:     32,
  conferenceRank: 16,
  divisionRank:   8,
};

interface Props {
  teams: TeamSeries[];
  scrubDate: string;
  highlightedTeam: string | null;
  rankField: RankField;
  onScrub: (date: string) => void;
  showXAxis?: boolean;
}

const MARGIN_BASE = { top: 20, right: 24, left: 44 };

export function BumpChart({ teams, scrubDate, highlightedTeam, rankField, onScrub, showXAxis = true }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = useRef(`bc-clip-${Math.random().toString(36).slice(2, 8)}`).current;
  const scrubRef = useRef<string>(scrubDate);
  const onScrubRef = useRef(onScrub);
  const highlightedTeamRef = useRef<string | null>(highlightedTeam);
  const rankFieldRef = useRef<RankField>(rankField);
  onScrubRef.current = onScrub;

  const xScaleRef = useRef<d3.ScaleTime<number, number> | null>(null);
  const yScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);

  const allDates = useCallback(() => {
    const set = new Set<string>();
    teams.forEach(t => t.data.forEach(d => set.add(d.date)));
    return Array.from(set).sort();
  }, [teams]);

  const parseDate = (s: string) => new Date(s + 'T12:00:00Z');

  // ── Draw ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || teams.length === 0) return;

    rankFieldRef.current = rankField;

    const MARGIN = { ...MARGIN_BASE, bottom: showXAxis ? 36 : 8 };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const rect = svgRef.current.getBoundingClientRect();
    const W = rect.width || 900;
    const H = rect.height || 200;
    const width  = W - MARGIN.left - MARGIN.right;
    const height = H - MARGIN.top - MARGIN.bottom;

    const dates = allDates();

    const xScale = d3.scaleTime()
      .domain([parseDate(dates[0]), parseDate(dates[dates.length - 1])])
      .range([0, width]);
    xScaleRef.current = xScale;

    const maxRank = RANK_MAX[rankField];
    const yScale = d3.scaleLinear()
      .domain([1, maxRank])
      .range([0, height]);
    yScaleRef.current = yScale;

    // Clip path
    svg.append('defs').append('clipPath')
      .attr('id', clipId)
      .append('rect')
      .attr('class', 'clip-rect')
      .attr('x', 0).attr('y', -10)
      .attr('width', scrubRef.current ? xScale(parseDate(scrubRef.current)) : 0)
      .attr('height', height + 20);

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Grid lines
    const tickEvery = maxRank <= 8 ? 1 : maxRank <= 16 ? 2 : 4;
    const ticks = d3.range(1, maxRank + 1, tickEvery);

    g.append('g').attr('class', 'grid')
      .selectAll('line').data(ticks).join('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
      .attr('stroke', C.color.gridBumpChart).attr('stroke-width', 1);

    // Playoff cutoff
    const playoffCutoff = maxRank <= 8 ? 3.5 : maxRank <= 16 ? 8.5 : 16.5;
    g.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', yScale(playoffCutoff)).attr('y2', yScale(playoffCutoff))
      .attr('stroke', C.color.playoffCutoff).attr('stroke-width', 1)
      .attr('stroke-dasharray', C.dash.playoffCutoff);

    // X axis (only on bottom chart)
    if (showXAxis) {
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(
          d3.axisBottom(xScale)
            .ticks(d3.timeMonth.every(1))
            .tickFormat(d => d3.timeFormat('%b')(d as Date))
        )
        .call(ax => ax.select('.domain').remove())
        .call(ax => ax.selectAll('line').attr('stroke', C.color.axisTickLine))
        .call(ax => ax.selectAll('text').attr('fill', C.color.axisText).attr('font-size', C.fontSize.axisText));
    }

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale)
        .tickValues(ticks).tickSize(-width)
        .tickFormat(d => `${d}`)
      )
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('line').attr('stroke', 'none'))
      .call(ax => ax.selectAll('text').attr('fill', C.color.yAxisTextBump).attr('font-size', C.fontSize.yAxisTextBump));

    // Lines
    const line = d3.line<{ date: string } & Record<string, number>>()
      .x(d => xScale(parseDate(d.date)))
      .y(d => yScale(d[rankField]))
      .defined(d => d[rankField] != null && d[rankField] > 0)
      .curve(d3.curveMonotoneX);

    const linesG = g.append('g')
      .attr('class', 'lines')
      .attr('clip-path', `url(#${clipId})`);

    teams.forEach(team => {
      const color = teamStyles[team.triCode]?.primaryColor ?? C.color.teamFallback;
      const baseOpacity = highlightedTeamRef.current
        ? (highlightedTeamRef.current === team.triCode ? C.opacity.lineHighlighted : C.opacity.lineDimmed) : C.opacity.lineDefault;
      const segments = getSegments(team.data);

      const teamG = linesG.append('g')
        .attr('class', `team-group team-group-${team.triCode}`)
        .style('cursor', 'pointer')
        .on('mouseenter', function () {
          if (highlightedTeamRef.current) return;
          linesG.selectAll('.line').attr('opacity', C.opacity.lineDimmed).attr('stroke-width', C.line.widthDimmed);
          linesG.selectAll('.bump-dot').attr('opacity', C.opacity.lineDimmed);
          linesG.selectAll(`.line-${team.triCode}`).attr('opacity', C.opacity.lineHighlighted).attr('stroke-width', C.line.widthHighlighted);
          linesG.selectAll(`.bump-dot-${team.triCode}`).attr('opacity', C.opacity.lineHighlighted);
          d3.select(this).raise();
        })
        .on('mouseleave', function () {
          if (highlightedTeamRef.current) return;
          linesG.selectAll('.line').attr('opacity', C.opacity.lineDefault).attr('stroke-width', C.line.widthDefault);
          linesG.selectAll('.bump-dot').attr('opacity', C.opacity.lineDefault);
        });

      segments.forEach(seg => {
        teamG.append('path')
          .datum(seg.points as (typeof team.data[0] & Record<string, number>)[])
          .attr('class', `line line-${team.triCode}`)
          .attr('fill', 'none').attr('stroke', color)
          .attr('stroke-width', C.line.widthDefault)
          .attr('opacity', baseOpacity)
          .attr('stroke-dasharray', seg.inPlayoffs ? null : C.dash.nonPlayoffLine)
          .attr('d', line as d3.ValueFn<SVGPathElement, unknown, string>);
      });

      // Per-day dots
      team.data.forEach(pt => {
        const rank = (pt as unknown as Record<string, number>)[rankField];
        if (!rank || rank <= 0) return;
        teamG.append('circle')
          .attr('class', `bump-dot bump-dot-${team.triCode}`)
          .attr('cx', xScale(parseDate(pt.date)))
          .attr('cy', yScale(rank))
          .attr('r', 2)
          .attr('fill', color)
          .attr('opacity', baseOpacity);
      });
    });

    // Scrubber
    const scrubG = g.append('g').attr('class', 'scrubber').style('pointer-events', 'none');
    scrubG.append('line').attr('class', 'scrub-line')
      .attr('y1', 0).attr('y2', height)
      .attr('stroke', C.color.scrubberLine).attr('stroke-width', 1).attr('opacity', C.opacity.scrubberLine);
    scrubG.append('text').attr('class', 'scrub-label')
      .attr('y', -6).attr('text-anchor', 'middle')
      .attr('fill', C.color.scrubberLabelBump).attr('font-size', C.fontSize.scrubberLabelBump);
    scrubG.append('g').attr('class', 'scrub-dots');

    // Mouse overlay
    g.append('rect')
      .attr('width', width).attr('height', height)
      .attr('fill', 'transparent')
      .on('mousemove', function (event) {
        const [mx] = d3.pointer(event);
        const nearest = dates.reduce((best, d) => {
          const bd = Math.abs(parseDate(best).getTime() - xScale.invert(mx).getTime());
          const cd = Math.abs(parseDate(d).getTime()   - xScale.invert(mx).getTime());
          return cd < bd ? d : best;
        });
        onScrubRef.current(nearest);
      });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, rankField, showXAxis]);

  // ── Update scrubber + clip rect ─────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !scrubDate || !xScaleRef.current || !yScaleRef.current) return;
    scrubRef.current = scrubDate;

    const x = xScaleRef.current(parseDate(scrubDate));
    const yScale = yScaleRef.current;
    const rf = rankFieldRef.current;
    const svg = d3.select(svgRef.current);

    svg.select(`#${clipId} .clip-rect`).attr('width', x);
    svg.select('.scrub-line').attr('x1', x).attr('x2', x);
    svg.select('.scrub-label').attr('x', x).text(d3.timeFormat('%b %d, %Y')(parseDate(scrubDate)));

    const dotsG = svg.select('.scrub-dots');
    dotsG.selectAll('*').remove();
    const hl = highlightedTeamRef.current;
    teams.forEach(team => {
      const pt = team.data.find(d => d.date === scrubDate);
      if (!pt) return;
      const rank = (pt as unknown as Record<string, number>)[rf];
      if (!rank) return;
      const color = teamStyles[team.triCode]?.primaryColor ?? C.color.teamFallback;
      dotsG.append('circle')
        .attr('cx', x).attr('cy', yScale(rank))
        .attr('r', hl ? (hl === team.triCode ? C.dot.radiusHighlighted : C.dot.radiusDimmed) : C.dot.radiusDefault)
        .attr('fill', color)
        .attr('opacity', hl ? (hl === team.triCode ? C.opacity.dotHighlighted : C.opacity.dotDimmed) : C.opacity.dotDefault);
    });
  }, [scrubDate, teams]);

  // ── Highlight ───────────────────────────────────────────────────────────
  useEffect(() => {
    highlightedTeamRef.current = highlightedTeam;
    if (!svgRef.current) return;

    const linesG = d3.select(svgRef.current).select('.lines');
    if (highlightedTeam) {
      linesG.selectAll('.line').attr('opacity', C.opacity.lineDimmed).attr('stroke-width', C.line.widthDimmed);
      linesG.selectAll('.bump-dot').attr('opacity', C.opacity.lineDimmed);
      linesG.selectAll(`.line-${highlightedTeam}`).attr('opacity', C.opacity.lineHighlighted).attr('stroke-width', C.line.widthHighlighted);
      linesG.selectAll(`.bump-dot-${highlightedTeam}`).attr('opacity', C.opacity.lineHighlighted);
      linesG.select(`.team-group-${highlightedTeam}`).raise();
    } else {
      linesG.selectAll('.line').attr('opacity', C.opacity.lineDefault).attr('stroke-width', C.line.widthDefault);
      linesG.selectAll('.bump-dot').attr('opacity', C.opacity.lineDefault);
    }

    if (!scrubRef.current || !xScaleRef.current || !yScaleRef.current) return;
    const x = xScaleRef.current(parseDate(scrubRef.current));
    const yScale = yScaleRef.current;
    const rf = rankFieldRef.current;
    const dotsG = d3.select(svgRef.current).select('.scrub-dots');
    dotsG.selectAll('*').remove();
    teams.forEach(team => {
      const pt = team.data.find(d => d.date === scrubRef.current);
      if (!pt) return;
      const rank = (pt as unknown as Record<string, number>)[rf];
      if (!rank) return;
      const color = teamStyles[team.triCode]?.primaryColor ?? C.color.teamFallback;
      dotsG.append('circle')
        .attr('cx', x).attr('cy', yScale(rank))
        .attr('r', highlightedTeam ? (highlightedTeam === team.triCode ? C.dot.radiusHighlighted : C.dot.radiusDimmed) : C.dot.radiusDefault)
        .attr('fill', color)
        .attr('opacity', highlightedTeam ? (highlightedTeam === team.triCode ? C.opacity.dotHighlighted : C.opacity.dotDimmed) : C.opacity.dotDefault);
    });
  }, [highlightedTeam, teams]);

  return <svg ref={svgRef} className="line-chart-svg" />;
}
