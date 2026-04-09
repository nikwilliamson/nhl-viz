// ── Chart Visual Configuration ───────────────────────────────────────────────
// All D3 chart visual attributes live here. Edit this file to restyle charts
// without touching component logic.

export const chartConfig = {

  // Chart margins (left must match across bump, line, and brush for x-axis alignment)
  margin: {
    bump:  { top: 8, right: 32, left: 32, bottomAxis: 24, bottomNoAxis: 8 },
    line:  { top: 8, right: 32, left: 32, bottomAxis: 24, bottomNoAxis: 8 },
    brush: { left: 32, right: 32 },
  },

  // Team logo dimensions (used in BumpChart)
  logo: {
    size: 24,
    gap:  4,
  },

  // Timeline brush dimensions
  brush: {
    height:  16,
    tickGap: 4,
  },

  // Line stroke widths
  line: {
    widthDefault:     2,
    widthHighlighted: 2,
    widthDimmed:      2,
  },

  // Line opacity states
  opacity: {
    lineDefault:     0.75,
    lineHighlighted: 1,
    lineDimmed:      0.12,
    lineHoverActive: 0.32,
    scrubberLine:    0.25,
    dotDefault:      0.85,
    dotHighlighted:  1,
    dotDimmed:       0.1,
  },

  // Scrubber dot radii
  dot: {
    radiusDefault:     8,
    radiusHighlighted: 8,
    radiusDimmed:      2,
  },

  // Dash patterns
  dash: {
    nonPlayoffLine:    '5,3',  // dashed = outside playoff position (LineChart)
    gridLine:          '2,3',  // y-axis grid lines (LineChart)
    playoffCutoff:     '4,4',  // playoff cutoff line (BumpChart)
  },

  // Colors
  color: {
    // Axes
    axisTickLine:      '#e8e8e8',
    axisText:          '#bbb',

    // Grid
    gridLineChart:     '#f0f0f0',  // LineChart y-axis grid
    gridBumpChart:     '#f0f0f0',  // BumpChart horizontal grid

    // Y-axis labels
    yAxisTextLine:     '#ccc',     // LineChart y-axis tick labels
    yAxisLabelLine:    '#ccc',     // LineChart "Points" label
    yAxisTextBump:     '#ccc',     // BumpChart y-axis tick labels

    // Scrubber
    scrubberLine:      '#333',
    scrubberLabelLine: '#999',     // LineChart date label
    scrubberLabelBump: '#999',     // BumpChart date label

    // Playoff cutoff line (BumpChart)
    playoffCutoff:     '#d4ecd4',

    // Fallback when team color is missing
    teamFallback:      '#ccc',
  },

  // Font sizes
  fontSize: {
    axisText:          '11px',
    yAxisLabelLine:    '11px',
    yAxisTextBump:     '10px',
    scrubberLabelBump: '10px',
  },

} as const;
