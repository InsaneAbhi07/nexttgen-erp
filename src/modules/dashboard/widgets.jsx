/**
 * Dashboard widgets — charts (Recharts) and compact lists.
 * Marks follow the ERP chart spec: bars ≤24px with 4px rounded tops, 2px lines,
 * hairline horizontal grid, legend for 2+ series, tooltip on hover.
 */
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Boxes, Database, Factory, IndianRupee, Receipt, ShieldCheck, ShoppingCart, Settings2 } from 'lucide-react'
import { CHART, axisProps } from '../../config/theme.js'
import ChartTooltip from '../../components/common/ChartTooltip.jsx'
import { Badge, DocNo, EmptyState, Progress } from '../../components/ui/index.js'
import { fmtDate, inr, inrCompact, num, timeAgo } from '../../utils/format.js'

export function Legend({ items }) {
  return (
    <div className="chart-legend">
      {items.map((i) => (
        <span key={i.label}>
          <span className="sw" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

const cursor = { fill: 'rgba(31, 95, 214, 0.06)' }

export function MonthlySalesChart({ data, color = CHART.blue, dataKey = 'sales', name = 'Sales', small }) {
  return (
    <div className={`chart-box ${small ? 'sm' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
          <YAxis {...axisProps} width={64} tickFormatter={inrCompact} />
          <Tooltip cursor={cursor} content={<ChartTooltip formatter={(v) => inr(v)} />} />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PurchaseVsSalesChart({ data }) {
  return (
    <div className="chart-box sm">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} width={64} tickFormatter={inrCompact} />
          <Tooltip cursor={cursor} content={<ChartTooltip formatter={(v) => inr(v)} />} />
          <Bar dataKey="sales" name="Sales" fill={CHART.blue} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="purchase" name="Purchase" fill={CHART.brass} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ProductionTrendChart({ data }) {
  return (
    <div className="chart-box sm">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
          <YAxis {...axisProps} width={48} tickFormatter={(v) => num(v)} />
          <Tooltip cursor={cursor} content={<ChartTooltip formatter={(v) => `${num(v)} units`} />} />
          <Bar dataKey="good" name="Good units" stackId="p" fill={CHART.blue} maxBarSize={20} />
          <Bar dataKey="rejected" name="Rejected" stackId="p" fill={CHART.orange} radius={[4, 4, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Donut + value list. data: [{ name, value, color }] */
export function StatusDonut({ data, centerLabel = 'Orders' }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  if (!total) return <EmptyState compact title="Nothing to show yet" />
  return (
    <div className="dash-donut">
      <div style={{ width: 170, height: 170, position: 'relative', flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip labelFormatter={() => centerLabel} formatter={(v) => `${v}`} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="dash-donut-center">
          <div className="stat-value" style={{ fontSize: 20 }}>{total}</div>
          <div className="tiny muted">{centerLabel}</div>
        </div>
      </div>
      <ul className="dash-donut-list">
        {data.map((d) => (
          <li key={d.name}>
            <span className="sw" style={{ background: d.color }} />
            <span className="grow">{d.name}</span>
            <span className="strong num">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TopProductsList({ rows }) {
  if (!rows.length) return <EmptyState compact title="No sales this year yet" />
  const max = rows[0].value || 1
  return (
    <ol className="dash-rank">
      {rows.map((r, i) => (
        <li key={r.itemId}>
          <span className="dash-rank-no">{i + 1}</span>
          <div className="grow">
            <div className="row-between">
              <Link to={`/masters/items?view=${r.itemId}`} className="cell-primary truncate" style={{ color: 'var(--ink)' }}>
                {r.item.name}
              </Link>
              <span className="strong num nowrap">{inrCompact(r.value)}</span>
            </div>
            <div className="row" style={{ gap: 10, marginTop: 5 }}>
              <Progress value={(r.value / max) * 100} tone="" style={{ flex: 1 }} />
              <span className="tiny muted nowrap">{num(r.qty)} {r.item.unit}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function TransactionsTable({ rows }) {
  return (
    <div className="table-wrap">
      <table className="table compact">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Voucher</th>
            <th>Party</th>
            <th className="align-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.type}-${r.id}`}>
              <td className="nowrap">{fmtDate(r.date)}</td>
              <td><Badge tone={r.tone}>{r.type}</Badge></td>
              <td><DocNo to={r.to}>{r.number}</DocNo></td>
              <td className="truncate" style={{ maxWidth: 220 }}>{r.party}</td>
              <td className="align-right strong num nowrap">{inr(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const MODULE_ICON = {
  Sales: { icon: Receipt, tone: 'tone-blue' },
  Purchase: { icon: ShoppingCart, tone: 'tone-violet' },
  Production: { icon: Factory, tone: 'tone-brass' },
  Accounts: { icon: IndianRupee, tone: 'tone-green' },
  Inventory: { icon: Boxes, tone: 'tone-teal' },
  Masters: { icon: Database, tone: 'tone-gray' },
  'Users & Access': { icon: ShieldCheck, tone: 'tone-gray' },
}

export function ActivityFeed({ activities, limit = 8 }) {
  if (!activities.length) return <EmptyState compact title="No activity yet" description="Actions taken by your team appear here." />
  return (
    <div className="activity-list">
      {activities.slice(0, limit).map((a) => {
        const meta = MODULE_ICON[a.module] || { icon: Settings2, tone: 'tone-gray' }
        const Icon = meta.icon
        return (
          <div key={a.id} className="activity-item">
            <span className={`activity-icon ${meta.tone}`}>
              <Icon size={14} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="activity-text">
                <b>{a.user}</b> {a.action} {a.entity}{' '}
                {a.link ? (
                  <Link to={a.link} className="doc-no">{a.ref}</Link>
                ) : (
                  <b>{a.ref}</b>
                )}
              </div>
              <div className="activity-time">{timeAgo(a.at)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LowStockList({ rows, suppliers, limit = 6 }) {
  if (!rows.length) return <EmptyState compact title="All items above minimum stock" />
  return (
    <div className="activity-list">
      {rows.slice(0, limit).map((r) => {
        const pctLeft = (r.balance / r.minStock) * 100
        const isRaw = !['Finished Good', 'Trading Goods'].includes(r.item.type) || r.item.type === 'Trading Goods'
        const supplier = suppliers?.find((s) => s.itemIds?.includes(r.item.id))
        const action = r.item.type === 'Finished Good'
          ? { label: 'Plan production', to: `/production/orders/new?product=${r.item.id}&qty=${Math.max(100, Math.ceil((r.minStock * 2 - r.balance) / 50) * 50)}` }
          : { label: 'Raise PO', to: supplier ? `/purchase/orders/new?supplier=${supplier.id}` : '/purchase/orders/new' }
        return (
          <div key={r.item.id} className="activity-item" style={{ alignItems: 'center' }}>
            <div className="grow">
              <div className="row-between">
                <Link to={`/masters/items?view=${r.item.id}`} className="cell-primary truncate" style={{ color: 'var(--ink)' }}>
                  {r.item.name}
                </Link>
                <span className={`small strong nowrap ${r.balance <= 0 ? 'text-red' : 'text-amber'}`}>
                  {num(r.balance)} / {num(r.minStock)} {r.item.unit}
                </span>
              </div>
              <div className="row" style={{ gap: 10, marginTop: 5 }}>
                <Progress value={pctLeft} tone={r.balance <= 0 || pctLeft < 40 ? 'red' : 'amber'} style={{ flex: 1 }} />
                <Link to={action.to} className="tiny nowrap" data-raw={isRaw}>
                  {action.label}
                </Link>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
