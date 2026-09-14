/** Chart palette (JS constants — Recharts needs literal colours). */
export const CHART = {
  blue: '#1f5fd6',
  brass: '#c9962f',
  teal: '#0e7c86',
  violet: '#5f45c4',
  green: '#177a52',
  orange: '#d0661f',
  red: '#c23b32',
  navy: '#1f3561',
  gray: '#a3adbb',
  grid: '#e8ecf2',
  axis: '#7a8699',
}

export const SERIES = [CHART.blue, CHART.brass, CHART.teal, CHART.violet, CHART.green, CHART.orange, CHART.gray]

export const axisProps = {
  tick: { fontSize: 11.5, fill: CHART.axis },
  axisLine: false,
  tickLine: false,
}
