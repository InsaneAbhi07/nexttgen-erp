/** Recharts tooltip in ERP styling. formatter(value, name) → string */
export default function ChartTooltip({ active, payload, label, formatter = (v) => v, labelFormatter = (l) => l }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="tt-label">{labelFormatter(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="tt-row">
          <span className="sw" style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill, display: 'inline-block' }} />
          <span>{p.name}</span>
          <span style={{ marginLeft: 'auto', paddingLeft: 12, color: 'var(--ink)', fontWeight: 600 }}>{formatter(p.value, p.name)}</span>
        </div>
      ))}
    </div>
  )
}
