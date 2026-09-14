/**
 * ReportChart — one chart per report, single y-axis, thin rounded bars, hover tooltip,
 * legend only when there are two or more series. Colours in fixed order (palette.js).
 */
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../../components/ui/index.js'
import ChartTooltip from '../../components/common/ChartTooltip.jsx'
import { CHART, axisProps } from '../../config/theme.js'
import { inr, inrCompact, num } from '../../utils/format.js'
import { REPORT_SERIES } from './palette.js'

const formatters = {
  inr: { tip: (v) => inr(v), axis: (v) => inrCompact(v) },
  num: { tip: (v) => num(v), axis: (v) => num(v) },
  pct: { tip: (v) => `${Number(v).toFixed(1)}%`, axis: (v) => `${v}%` },
}

export default function ReportChart({ chart }) {
  if (!chart?.data?.length) return null
  const fmt = formatters[chart.valueFormat] || formatters.num
  const series = chart.series.map((s, i) => ({ ...s, color: s.color || REPORT_SERIES[i] }))
  const horizontal = chart.type === 'hbar'
  const height = horizontal ? Math.max(200, chart.data.length * 34 + 40) : 280
  const tooltip = <Tooltip cursor={{ fill: 'rgba(31, 95, 214, 0.06)' }} content={<ChartTooltip formatter={fmt.tip} />} />

  const legend =
    series.length > 1 ? (
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key}>
            <span className="sw" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    ) : null

  let body
  if (horizontal) {
    body = (
      <BarChart data={chart.data} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }} barGap={2}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" tickFormatter={fmt.axis} {...axisProps} />
        <YAxis type="category" dataKey={chart.xKey} width={168} {...axisProps} />
        {tooltip}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[0, 4, 4, 0]} maxBarSize={16} />
        ))}
      </BarChart>
    )
  } else if (chart.type === 'area') {
    body = (
      <AreaChart data={chart.data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey={chart.xKey} {...axisProps} minTickGap={16} />
        <YAxis tickFormatter={fmt.axis} width={64} {...axisProps} />
        <Tooltip cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }} content={<ChartTooltip formatter={fmt.tip} />} />
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={s.color} fillOpacity={0.1} dot={false} activeDot={{ r: 4 }} />
        ))}
      </AreaChart>
    )
  } else {
    body = (
      <BarChart data={chart.data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey={chart.xKey} {...axisProps} minTickGap={12} />
        <YAxis tickFormatter={fmt.axis} width={64} {...axisProps} />
        {tooltip}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    )
  }

  return (
    <Card title={chart.title} subtitle={chart.subtitle} actions={legend} className="report-chart">
      <div className="chart-box" style={{ height }} role="img" aria-label={chart.title}>
        <ResponsiveContainer width="100%" height="100%">
          {body}
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
