// ── Chart Visual Configuration ───────────────────────────────────────────────
// All D3 chart visual attributes live here. Edit this file to restyle charts
// without touching component logic.

export const chartConfig = {

  // Line stroke widths
  line: {
    widthDefault:     2,
    widthHighlighted: 2,
    widthDimmed:      2,
  },

  // Line opacity states
  opacity: {
    lineDefault:     0.72,
    lineHighlighted: 1,
    lineDimmed:      0.48,
    scrubberLine:    0.2,
    dotDefault:      0.85,
    dotHighlighted:  1,
    dotDimmed:       0.15,
  },

  // Scrubber dot radii
  dot: {
    radiusDefault:     5,
    radiusHighlighted: 5,
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
    axisTickLine:      '#2a2d35',
    axisText:          '#bbb',

    // Grid
    gridLineChart:     '#1e2028',  // LineChart y-axis grid
    gridBumpChart:     '#1a1c24',  // BumpChart horizontal grid

    // Y-axis labels
    yAxisTextLine:     '#444',     // LineChart y-axis tick labels
    yAxisLabelLine:    '#3a3d4a',  // LineChart "Points" label
    yAxisTextBump:     '#3a3d4a',  // BumpChart y-axis tick labels

    // Scrubber
    scrubberLine:      '#fff',
    scrubberLabelLine: '#666',     // LineChart date label
    scrubberLabelBump: '#444',     // BumpChart date label

    // Playoff cutoff line (BumpChart)
    playoffCutoff:     '#1e3a1e',

    // Fallback when team color is missing
    teamFallback:      '#666',
  },

  // Playback
  playback: {
    intervalMs: 250,  // delay between days when clicking play
  },

  // Font sizes
  fontSize: {
    axisText:         '11px',
    yAxisLabelLine:   '11px',
    yAxisTextBump:    '10px',
    scrubberLabelBump:'10px',
  },

} as const;
