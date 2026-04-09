import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { teamStyles } from '../teamStyles';
import { chartConfig as C } from '../chartConfig';
import type { TeamSeries, DayPoint } from './StandingsViz';

interface Props {
  teams: TeamSeries[];
  scrubDate: string;
  highlightedTeam: string | null;
  onScrub: (date: string) => void;
  showXAxis?: boolean;
}

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

const MARGIN_BASE = { top: 24, right: 24, left: 44 };

export function LineChart({ teams, scrubDate, highlightedTeam, onScrub, showXAxis = true }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = useRef(`lc-clip-${Math.random().toString(36).slice(2, 8)}`).current;
  const scrubRef = useRef<string>(scrubDate);
  const onScrubRef = useRef(onScrub);
  const highlightedTeamRef = useRef<string | null>(highlightedTeam);
  onScrubRef.current = onScrub;

  // Scales / dates are recomputed in multiple effects — memoize via refs
  const xScaleRef = useRef<d3.ScaleTime<number, number> | null>(null);
  const yScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);

  const allDates = useCallback(() => {
    const set = new Set<string>();
    teams.forEach(t => t.data.forEach(d => set.add(d.date)));
    return Array.from(set).sort();
  }, [teams]);

  const parseDate = (s: string) => new Date(s + 'T12:00:00Z');

  // ── Draw chart once on mount / data change ──────────────────────────────
  useEffect(() => {
    if (!svgRef.current || teams.length === 0) return;

    const MARGIN = { ...MARGIN_BASE, bottom: showXAxis ? 40 : 8 };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const rect = svgRef.current.getBoundingClientRect();
    const W = rect.width || 900;
    const H = rect.height || 500;
    const width  = W - MARGIN.left - MARGIN.right;
    const height = H - MARGIN.top - MARGIN.bottom;

    const dates = allDates();

    const xScale = d3.scaleTime()
      .domain([parseDate(dates[0]), parseDate(dates[dates.length - 1])])
      .range([0, width]);
    xScaleRef.current = xScale;

    const maxPoints = d3.max(teams, t => d3.max(t.data, d => d.points)) ?? 120;
    const yScale = d3.scaleLinear()
      .domain([0, maxPoints]).range([height, 0]).nice();
    yScaleRef.current = yScale;

    // Clip path — controls how much of each line is visible
    svg.append('defs').append('clipPath')
      .attr('id', clipId)
      .append('rect')
      .attr('class', 'clip-rect')
      .attr('x', 0).attr('y', -10)
      .attr('width', scrubRef.current ? xScale(parseDate(scrubRef.current)) : 0)
      .attr('height', height + 20);

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Axes
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

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(6).tickSize(-width))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('line').attr('stroke', C.color.gridLineChart).attr('stroke-dasharray', C.dash.gridLine))
      .call(ax => ax.selectAll('text').attr('fill', C.color.yAxisTextLine).attr('font-size', C.fontSize.axisText));

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2).attr('y', -32)
      .attr('text-anchor', 'middle')
      .attr('fill', C.color.yAxisLabelLine).attr('font-size', C.fontSize.yAxisLabelLine)
      .text('Points');

    const line = d3.line<DayPoint>()
      .x(d => xScale(parseDate(d.date)))
      .y(d => yScale(d.points))
      .defined(d => d.points != null)
      .curve(d3.curveMonotoneX);

    // Lines — drawn in full but clipped
    const linesG = g.append('g')
      .attr('class', 'lines')
      .attr('clip-path', `url(#${clipId})`);

    teams.forEach(team => {
      const color = teamStyles[team.triCode]?.primaryColor ?? C.color.teamFallback;
      const baseOpacity = highlightedTeamRef.current
        ? (highlightedTeamRef.current === team.triCode ? C.opacity.lineHighlighted : C.opacity.lineDimmed)
        : C.opacity.lineDefault;
      const segments = getSegments(team.data);

      const teamG = linesG.append('g')
        .attr('class', `team-group team-group-${team.triCode}`)
        .style('cursor', 'pointer')
        .on('mouseenter', function () {
          if (highlightedTeamRef.current) return;
          linesG.selectAll('.line').attr('opacity', C.opacity.lineDimmed).attr('stroke-width', C.line.widthDimmed);
          linesG.selectAll(`.line-${team.triCode}`).attr('opacity', C.opacity.lineHighlighted).attr('stroke-width', C.line.widthHighlighted);
          d3.select(this).raise();
        })
        .on('mouseleave', function () {
          if (highlightedTeamRef.current) return;
          linesG.selectAll('.line').attr('opacity', C.opacity.lineDefault).attr('stroke-width', C.line.widthDefault);
        });

      segments.forEach(seg => {
        teamG.append('path')
          .datum(seg.points)
          .attr('class', `line line-${team.triCode}`)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', C.line.widthDefault)
          .attr('opacity', baseOpacity)
          .attr('stroke-dasharray', seg.inPlayoffs ? null : C.dash.nonPlayoffLine)
          .attr('d', line as d3.ValueFn<SVGPathElement, DayPoint[], string>);
      });
    });

    // Scrubber — sits above clip path (not clipped)
    const scrubG = g.append('g').attr('class', 'scrubber').style('pointer-events', 'none');

    scrubG.append('line')
      .attr('class', 'scrub-line')
      .attr('y1', 0).attr('y2', height)
      .attr('stroke', C.color.scrubberLine).attr('stroke-width', 1).attr('opacity', C.opacity.scrubberLine);

    scrubG.append('text')
      .attr('class', 'scrub-label')
      .attr('y', -8).attr('text-anchor', 'middle')
      .attr('fill', C.color.scrubberLabelLine).attr('font-size', C.fontSize.axisText);

    scrubG.append('g').attr('class', 'scrub-dots');

    // Overlay for mouse scrubbing
    g.append('rect')
      .attr('width', width).attr('height', height)
      .attr('fill', 'transparent')
      .on('mousemove', function (event) {
        const [mx] = d3.pointer(event);
        const hoverDate = xScale.invert(mx);
        const nearest = dates.reduce((best, d) => {
          const bd = Math.abs(parseDate(best).getTime() - hoverDate.getTime());
          const cd = Math.abs(parseDate(d).getTime()   - hoverDate.getTime());
          return cd < bd ? d : best;
        });
        onScrubRef.current(nearest);
      });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, showXAxis]);

  // ── Update scrubber + clip rect whenever scrubDate changes ──────────────
  useEffect(() => {
    if (!svgRef.current || !scrubDate || !xScaleRef.current || !yScaleRef.current) return;
    scrubRef.current = scrubDate;

    const xScale = xScaleRef.current;
    const yScale = yScaleRef.current;
    const x = xScale(parseDate(scrubDate));
    const svg = d3.select(svgRef.current);

    // Advance clip rect
    svg.select(`#${clipId} .clip-rect`).attr('width', x);

    // Move scrubber
    svg.select('.scrub-line').attr('x1', x).attr('x2', x);
    svg.select('.scrub-label').attr('x', x).text(d3.timeFormat('%b %d, %Y')(parseDate(scrubDate)));

    // Update dots at the tip of each line
    const dotsG = svg.select('.scrub-dots');
    dotsG.selectAll('*').remove();
    const hl = highlightedTeamRef.current;
    teams.forEach(team => {
      const pt = team.data.find(d => d.date === scrubDate);
      if (!pt) return;
      const color = teamStyles[team.triCode]?.primaryColor ?? C.color.teamFallback;
      dotsG.append('circle')
        .attr('cx', x).attr('cy', yScale(pt.points))
        .attr('r', hl ? (hl === team.triCode ? C.dot.radiusHighlighted : C.dot.radiusDimmed) : C.dot.radiusDefault)
        .attr('fill', color)
        .attr('opacity', hl ? (hl === team.triCode ? C.opacity.dotHighlighted : C.opacity.dotDimmed) : C.opacity.dotDefault);
    });
  }, [scrubDate, teams]);

  // ── Apply / remove team highlight ───────────────────────────────────────
  useEffect(() => {
    highlightedTeamRef.current = highlightedTeam;
    if (!svgRef.current) return;

    const linesG = d3.select(svgRef.current).select('.lines');
    if (highlightedTeam) {
      linesG.selectAll('.line').attr('opacity', C.opacity.lineDimmed).attr('stroke-width', C.line.widthDimmed);
      linesG.selectAll(`.line-${highlightedTeam}`).attr('opacity', C.opacity.lineHighlighted).attr('stroke-width', C.line.widthHighlighted);
      linesG.select(`.team-group-${highlightedTeam}`).raise();
    } else {
      linesG.selectAll('.line').attr('opacity', C.opacity.lineDefault).attr('stroke-width', C.line.widthDefault);
    }

    // Refresh dots for new highlight state
    if (!scrubRef.current || !xScaleRef.current || !yScaleRef.current) return;
    const x = xScaleRef.current(parseDate(scrubRef.current));
    const yScale = yScaleRef.current;
    const dotsG = d3.select(svgRef.current).select('.scrub-dots');
    dotsG.selectAll('*').remove();
    teams.forEach(team => {
      const pt = team.data.find(d => d.date === scrubRef.current);
      if (!pt) return;
      const color = teamStyles[team.triCode]?.primaryColor ?? C.color.teamFallback;
      dotsG.append('circle')
        .attr('cx', x).attr('cy', yScale(pt.points))
        .attr('r', highlightedTeam ? (highlightedTeam === team.triCode ? C.dot.radiusHighlighted : C.dot.radiusDimmed) : C.dot.radiusDefault)
        .attr('fill', color)
        .attr('opacity', highlightedTeam ? (highlightedTeam === team.triCode ? C.opacity.dotHighlighted : C.opacity.dotDimmed) : C.opacity.dotDefault);
    });
  }, [highlightedTeam, teams]);

  return (
    <svg ref={svgRef} className="line-chart-svg" />
  );
}
