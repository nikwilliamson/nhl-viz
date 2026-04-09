import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { chartConfig as C } from '../chartConfig';

interface Props {
  dates: string[];
  range: [string, string];
  onChange: (range: [string, string]) => void;
  onScrub?: (date: string) => void;
}

// Margins sourced from chartConfig to stay aligned with BumpChart / LineChart x-axes
const MARGIN   = C.margin.brush;
const BRUSH_H  = C.brush.height;
const TICK_GAP = C.brush.tickGap;

const parseDate = (s: string) => new Date(s + 'T12:00:00Z');

export function TimelineBrush({ dates, range, onChange, onScrub }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawKey, setDrawKey] = useState(0);
  const brushRef = useRef<d3.BrushBehavior<unknown> | null>(null);
  const xScaleRef = useRef<d3.ScaleTime<number, number> | null>(null);
  const rangeRef = useRef(range);
  const onChangeRef = useRef(onChange);
  const onScrubRef = useRef(onScrub);
  onChangeRef.current = onChange;
  onScrubRef.current = onScrub;

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

  useEffect(() => {
    if (!svgRef.current || dates.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const W = svgRef.current.getBoundingClientRect().width || 900;
    const width = W - MARGIN.left - MARGIN.right;

    const xScale = d3.scaleTime()
      .domain([parseDate(dates[0]), parseDate(dates[dates.length - 1])])
      .range([0, width]);
    xScaleRef.current = xScale;

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left}, 8)`);

    // Day ticks — one per data date
    g.append('g').attr('class', 'day-ticks')
      .selectAll('line').data(dates).join('line')
      .attr('x1', d => xScale(parseDate(d))).attr('x2', d => xScale(parseDate(d)))
      .attr('y1', BRUSH_H + TICK_GAP)
      .attr('y2', BRUSH_H + TICK_GAP + 3)
      .attr('stroke', '#666')
      .attr('stroke-width', 1);

    // Month ticks — short lines + labels, no axis line
    const months = d3.timeMonths(
      d3.timeMonth.floor(parseDate(dates[0])),
      d3.timeMonth.ceil(parseDate(dates[dates.length - 1]))
    );

    g.append('g').attr('class', 'tick-lines')
      .selectAll('line').data(months).join('line')
      .attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
      .attr('y1', BRUSH_H + TICK_GAP)
      .attr('y2', BRUSH_H + TICK_GAP + 4)
      .attr('stroke', '#2a2d35')
      .attr('stroke-width', 1);

    g.append('g').attr('class', 'tick-labels')
      .selectAll('text').data(months).join('text')
      .attr('x', d => xScale(d))
      .attr('y', BRUSH_H + TICK_GAP + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#444')
      .attr('font-size', '10px')
      .text(d => d3.timeFormat('%b')(d));

    // Snap px → nearest date string
    const findNearest = (px: number): string => {
      const target = xScale.invert(px).getTime();
      return dates.reduce((best, d) =>
        Math.abs(parseDate(d).getTime() - target) < Math.abs(parseDate(best).getTime() - target) ? d : best
      );
    };

    const brush = d3.brushX()
      .extent([[0, 0], [width, BRUSH_H]])
      .on('brush end', function (event) {
        if (!event.sourceEvent) return;
        const sel = event.selection as [number, number] | null;
        if (!sel) {
          const [s, e] = rangeRef.current;
          d3.select(this).call(brush.move, [xScale(parseDate(s)), xScale(parseDate(e))]);
          return;
        }
        const [x0, x1] = sel;
        const start = findNearest(x0);
        const end   = findNearest(x1);
        if (start === end) return;

        // Always snap brush handles to the nearest data date
        d3.select(this).call(brush.move, [xScale(parseDate(start)), xScale(parseDate(end))]);

        if (event.type === 'end') {
          // On release: commit the range change (triggers animated chart update)
          rangeRef.current = [start, end];
          onChangeRef.current([start, end]);
        } else {
          // During drag: scrub to the active edge so the table tracks the moving handle
          if (onScrubRef.current) {
            const [prevS, prevE] = rangeRef.current;
            const prevX0 = xScale(parseDate(prevS));
            const prevX1 = xScale(parseDate(prevE));
            const activeDate = Math.abs(x0 - prevX0) > Math.abs(x1 - prevX1) ? start : end;
            onScrubRef.current(activeDate);
          }
        }
      });

    brushRef.current = brush;

    const brushG = g.append('g').attr('class', 'timeline-brush');
    brushG.call(brush);

    // Style the handles to look like grip bars
    brushG.selectAll<SVGRectElement, unknown>('.handle')
      .attr('rx', 2)
      .attr('width', 5)
      .attr('y', -2)
      .attr('height', BRUSH_H + 4);

    // Initialise to current range
    const [s, e] = rangeRef.current;
    if (s && e) {
      brushG.call(brush.move, [xScale(parseDate(s)), xScale(parseDate(e))]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, drawKey]);

  useEffect(() => {
    rangeRef.current = range;
    if (!brushRef.current || !xScaleRef.current || !svgRef.current) return;
    const [s, e] = range;
    if (!s || !e) return;
    const brushG = d3.select(svgRef.current).select<SVGGElement>('.timeline-brush');
    if (brushG.empty()) return;
    brushG.call(brushRef.current.move, [
      xScaleRef.current(parseDate(s)),
      xScaleRef.current(parseDate(e)),
    ]);
  }, [range]);

  return <svg ref={svgRef} className="timeline-brush-svg" />;
}
