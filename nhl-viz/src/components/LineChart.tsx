import { useEffect, useRef, useCallback, useState } from 'react';
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
  dateRange: [string, string];
}


const MARGIN_BASE = { top: 24, right: 24, left: 44 };

export function LineChart({ teams, scrubDate, highlightedTeam, onScrub, showXAxis = true, dateRange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawKey, setDrawKey] = useState(0);
  const clipId = useRef(`lc-clip-${Math.random().toString(36).slice(2, 8)}`).current;
  const scrubRef = useRef<string>(scrubDate);
  const onScrubRef = useRef(onScrub);
  const highlightedTeamRef = useRef<string | null>(highlightedTeam);
  onScrubRef.current = onScrub;

  const xScaleRef = useRef<d3.ScaleTime<number, number> | null>(null);
  const yScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);
  const xAxisGroupRef = useRef<SVGGElement | null>(null);
  const linesGRef = useRef<SVGGElement | null>(null);
  const visibleDatesRef = useRef<string[]>([]);

  const allDates = useCallback(() => {
    const set = new Set<string>();
    teams.forEach(t => t.data.forEach(d => set.add(d.date)));
    return Array.from(set).sort();
  }, [teams]);

  const parseDate = (s: string) => new Date(s + 'T12:00:00Z');

  // ── Redraw on container resize ───────────────────────────────────────────
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    let frame: number;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setDrawKey(k => k + 1));
    });
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  // ── Draw chart ──────────────────────────────────────────────────────────
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
    const rangeStart = dateRange[0] || dates[0];
    const rangeEnd   = dateRange[1] || dates[dates.length - 1];

    // x-domain = currently brushed range (focus view)
    const xScale = d3.scaleTime()
      .domain([parseDate(rangeStart), parseDate(rangeEnd)])
      .range([0, width]);
    xScaleRef.current = xScale;

    // y-domain: max points across ALL data (keeps scale stable while panning)
    const maxPoints = d3.max(teams, t => d3.max(t.data, d => d.points)) ?? 120;
    const yScale = d3.scaleLinear()
      .domain([0, maxPoints]).range([height, 0]).nice();
    yScaleRef.current = yScale;

    // Visible dates for this range
    visibleDatesRef.current = dates.filter(d => d >= rangeStart && d <= rangeEnd);

    // Clip path — clips lines to chart bounds (static, not animated)
    svg.append('defs').append('clipPath')
      .attr('id', clipId)
      .append('rect')
      .attr('x', 0).attr('y', -10)
      .attr('width', width)
      .attr('height', height + 20);

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Axes
    if (showXAxis) {
      const xAxisG = g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(
          d3.axisBottom(xScale)
            .ticks(d3.timeMonth.every(1))
            .tickFormat(d => d3.timeFormat('%b')(d as Date))
        )
        .call(ax => ax.select('.domain').remove())
        .call(ax => ax.selectAll('line').attr('stroke', C.color.axisTickLine))
        .call(ax => ax.selectAll('text').attr('fill', C.color.axisText).attr('font-size', C.fontSize.axisText));
      xAxisGroupRef.current = xAxisG.node();
    } else {
      xAxisGroupRef.current = null;
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
      .curve(d3.curveLinear);

    const linesG = g.append('g')
      .attr('class', 'lines')
      .attr('clip-path', `url(#${clipId})`);
    linesGRef.current = linesG.node();

    teams.forEach(team => {
      const color = teamStyles[team.triCode]?.primaryColor ?? C.color.teamFallback;
      const baseOpacity = highlightedTeamRef.current
        ? (highlightedTeamRef.current === team.triCode ? C.opacity.lineHighlighted : C.opacity.lineDimmed)
        : C.opacity.lineDefault;

      const teamG = linesG.append('g')
        .attr('class', `team-group team-group-${team.triCode}`)
        .style('cursor', 'pointer')
        .on('mouseenter', function () {
          const ht = d3.transition().duration(180).ease(d3.easeCubicOut);
          if (highlightedTeamRef.current) {
            if (team.triCode !== highlightedTeamRef.current) {
              linesG.selectAll(`.line-${team.triCode}`).transition(ht).attr('opacity', C.opacity.lineHoverActive);
              d3.select(this).raise();
            }
            return;
          }
          linesG.selectAll('.line').transition(ht).attr('opacity', C.opacity.lineDimmed).attr('stroke-width', C.line.widthDimmed);
          linesG.selectAll(`.line-${team.triCode}`).transition(ht).attr('opacity', C.opacity.lineHighlighted).attr('stroke-width', C.line.widthHighlighted);
          d3.select(this).raise();
        })
        .on('mouseleave', function () {
          const ht = d3.transition().duration(180).ease(d3.easeCubicOut);
          if (highlightedTeamRef.current) {
            if (team.triCode !== highlightedTeamRef.current) {
              linesG.selectAll(`.line-${team.triCode}`).transition(ht).attr('opacity', C.opacity.lineDimmed);
            }
            return;
          }
          linesG.selectAll('.line').transition(ht).attr('opacity', C.opacity.lineDefault).attr('stroke-width', C.line.widthDefault);
        });

      teamG.append('path')
        .datum(team.data)
        .attr('class', `line line-${team.triCode}`)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', C.line.widthDefault)
        .attr('opacity', baseOpacity)
        .attr('d', line as d3.ValueFn<SVGPathElement, DayPoint[], string>);
    });

    // Scrubber
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

    // Mouse overlay — hover to set highlighted date for the table
    // Uses refs so the handler stays correct after brush range changes
    g.append('rect')
      .attr('width', width).attr('height', height)
      .attr('fill', 'transparent')
      .on('mousemove', function (event) {
        const [mx] = d3.pointer(event);
        const target = xScaleRef.current!.invert(mx).getTime();
        const nearest = visibleDatesRef.current.reduce((best, d) =>
          Math.abs(parseDate(d).getTime() - target) < Math.abs(parseDate(best).getTime() - target) ? d : best
        );
        onScrubRef.current(nearest);
      });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, showXAxis, drawKey]);

  // ── Animate date range changes ───────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !xScaleRef.current || !linesGRef.current) return;

    const dates = allDates();
    const rangeStart = dateRange[0] || dates[0];
    const rangeEnd   = dateRange[1] || dates[dates.length - 1];

    visibleDatesRef.current = dates.filter(d => d >= rangeStart && d <= rangeEnd);
    xScaleRef.current.domain([parseDate(rangeStart), parseDate(rangeEnd)]);

    const t = d3.transition().duration(450).ease(d3.easeCubicInOut);

    if (showXAxis && xAxisGroupRef.current) {
      d3.select(xAxisGroupRef.current).transition(t)
        .call(
          d3.axisBottom(xScaleRef.current)
            .ticks(d3.timeMonth.every(1))
            .tickFormat(d => d3.timeFormat('%b')(d as Date))
        )
        .call(ax => ax.select('.domain').remove())
        .call(ax => ax.selectAll('line').attr('stroke', C.color.axisTickLine))
        .call(ax => ax.selectAll('text').attr('fill', C.color.axisText).attr('font-size', C.fontSize.axisText));
    }

    const lineGen = d3.line<DayPoint>()
      .x(d => xScaleRef.current!(parseDate(d.date)))
      .y(d => yScaleRef.current!(d.points))
      .defined(d => d.points != null)
      .curve(d3.curveLinear);

    d3.select(linesGRef.current)
      .selectAll<SVGPathElement, DayPoint[]>('.line')
      .transition(t)
      .attr('d', lineGen);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange[0], dateRange[1]]);

  // ── Update scrubber position ─────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !scrubDate || !xScaleRef.current || !yScaleRef.current) return;
    scrubRef.current = scrubDate;

    const xScale = xScaleRef.current;
    const yScale = yScaleRef.current;
    const x = xScale(parseDate(scrubDate));
    const svg = d3.select(svgRef.current);

    svg.select('.scrub-line').attr('x1', x).attr('x2', x);
    svg.select('.scrub-label').attr('x', x).text(d3.timeFormat('%b %d, %Y')(parseDate(scrubDate)));

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
  // Re-run when dateRange changes so scrubber x-position recalculates against new xScale
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubDate, teams, dateRange[0], dateRange[1]]);

  // ── Apply / remove team highlight ───────────────────────────────────────
  useEffect(() => {
    highlightedTeamRef.current = highlightedTeam;
    if (!svgRef.current) return;

    const linesG = d3.select(svgRef.current).select('.lines');
    const t = d3.transition().duration(180).ease(d3.easeCubicOut);
    if (highlightedTeam) {
      linesG.selectAll('.line').transition(t).attr('opacity', C.opacity.lineDimmed).attr('stroke-width', C.line.widthDimmed);
      linesG.selectAll(`.line-${highlightedTeam}`).transition(t).attr('opacity', C.opacity.lineHighlighted).attr('stroke-width', C.line.widthHighlighted);
      linesG.select(`.team-group-${highlightedTeam}`).raise();
    } else {
      linesG.selectAll('.line').transition(t).attr('opacity', C.opacity.lineDefault).attr('stroke-width', C.line.widthDefault);
    }

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
