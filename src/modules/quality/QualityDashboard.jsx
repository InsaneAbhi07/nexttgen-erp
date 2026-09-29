/** Quality dashboard — pending inspections, acceptance and rejection trends. Frontend-only demo. */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ClipboardCheck, ClipboardList, Hourglass, Percent, Plus, ShieldAlert } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { qcPending } from '../../store/mfg.js'
import { addDays, fmtDate, num, pct, today } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { CHART, axisProps } from '../../config/theme.js'
import { Button, Card, DataTable, DocNo, PageHeader, StatCard, StatusBadge } from '../../components/ui/index.js'
import ChartTooltip from '../../components/common/ChartTooltip.jsx'
import './quality.css'

export const QC_CRUMB = { label: 'Quality', to: '/quality' }

export const inspectLink = (p) =>
  `/quality/inspections/new?type=${encodeURIComponent(p.type)}&ref=${p.refCollection}&refId=${p.refId}&item=${p.itemId}${p.stage ? `&stage=${encodeURIComponent(p.stage)}` : ''}`

/** Number of the document an inspection was made against. */
export const sourceDoc = (state, q) => {
  const doc = (state[q.refCollection] || []).find((d) => d.id === q.refId)
  if (!doc) return null
  const link = q.refCollection === 'grns' ? `/purchase/grn/${doc.id}` : q.refCollection === 'jobWorkReceipts' ? `/production/job-work/${doc.jobWorkOrderId}` : `/production/orders/${doc.id}`
  return { number: doc.number, link }
}

export default function QualityDashboard() {
  usePageTitle('Quality')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const items = byId(state.items)
  const suppliers = byId(state.suppliers)
  const t = today()
  const monthStart = `${t.slice(0, 7)}-01`
  const inspections = state.qcInspections || []

  const pending = useMemo(() => qcPending(state, addDays(today(), -30)), [state])
  const month = inspections.filter((q) => q.date >= monthStart)
  const lot = month.reduce((a, q) => a + (Number(q.lotQty) || 0), 0)
  const accepted = month.reduce((a, q) => a + (Number(q.acceptedQty) || 0), 0)
  const problemLots = month.filter((q) => ['Rejected', 'Rework'].includes(q.result))

  // Incoming rejection % by supplier (last 90 days)
  const since = addDays(t, -90)
  const bySupplier = {}
  inspections
    .filter((q) => ['Incoming', 'Job Work'].includes(q.type) && q.date >= since && q.supplierId)
    .forEach((q) => {
      const s = (bySupplier[q.supplierId] ||= { lot: 0, rejected: 0 })
      s.lot += Number(q.lotQty) || 0
      s.rejected += Number(q.rejectedQty) || 0
    })
  const supplierData = Object.entries(bySupplier)
    .map(([id, s]) => ({ name: suppliers.get(id)?.name || id, rate: s.lot ? Math.round((s.rejected / s.lot) * 1000) / 10 : 0 }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 6)

  // Top failing checks
  const fails = {}
  inspections.forEach((q) => (q.checks || []).filter((c) => c.result === 'Fail').forEach((c) => (fails[c.parameter] = (fails[c.parameter] || 0) + 1)))
  const failData = Object.entries(fails)
    .map(([parameter, count]) => ({ parameter, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const recent = [...inspections].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 6)

  const pendingCols = [
    { key: 'type', header: 'Type', render: (p) => <StatusBadge status={p.type} /> },
    { key: 'refNumber', header: 'Source', render: (p) => <DocNo to={p.link}>{p.refNumber}</DocNo> },
    { key: 'date', header: 'Date', render: (p) => fmtDate(p.date) },
    { key: 'item', header: 'Item', accessor: (p) => items.get(p.itemId)?.name, render: (p) => (<div><div className="cell-primary">{items.get(p.itemId)?.name}</div><div className="cell-secondary">{suppliers.get(p.supplierId)?.name || 'In-house production'}</div></div>) },
    { key: 'lotQty', header: 'Lot', align: 'right', render: (p) => `${num(p.lotQty)} ${items.get(p.itemId)?.unit || ''}` },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (p) => can('Quality', 'add') && <Button size="sm" variant="soft" icon={ClipboardCheck} to={inspectLink(p)}>Inspect</Button>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Quality"
        subtitle="Incoming, job work, in-process and final inspections for locks, handles and their components."
        breadcrumbs={[QC_CRUMB, { label: 'Dashboard' }]}
        actions={
          <>
            <Button icon={ClipboardList} to="/quality/inspections">All inspections</Button>
            {can('Quality', 'add') && <Button variant="primary" icon={Plus} to="/quality/inspections/new">New inspection</Button>}
          </>
        }
      />

      <div className="grid-4 mb-16">
        <StatCard label="Waiting for inspection" value={pending.length} icon={Hourglass} tone={pending.length ? 'amber' : 'green'} foot={`${pending.filter((p) => p.type === 'Incoming').length} incoming, ${pending.filter((p) => p.type === 'Final').length} final`} />
        <StatCard label="Inspections this month" value={month.length} icon={ClipboardCheck} tone="blue" foot={`${num(lot)} pieces inspected`} to="/quality/inspections" />
        <StatCard label="Acceptance rate" value={lot ? pct((accepted / lot) * 100) : '—'} icon={Percent} tone="green" foot="Accepted vs inspected quantity" />
        <StatCard label="Lots rejected or on rework" value={problemLots.length} icon={ShieldAlert} tone={problemLots.length ? 'red' : 'green'} foot="This month" />
      </div>

      <DataTable
        title="Pending inspection"
        subtitle="Receipts from the last 30 days and orders that have reached final QC"
        columns={pendingCols}
        data={pending}
        rowKey="key"
        pageSize={5}
        exportName="qc-pending"
        searchPlaceholder="Search source or item…"
        onRowClick={(p) => can('Quality', 'add') && navigate(inspectLink(p))}
        emptyTitle="Nothing waiting for inspection"
        emptyDescription="New GRNs, job work receipts and finished batches will appear here."
      />

      <div className="grid-2 mt-16 mb-16">
        <Card title="Rejection rate by supplier" subtitle="Incoming and job work lots, last 90 days">
          <div className="chart-box sm">
            <ResponsiveContainer>
              <BarChart data={supplierData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={CHART.grid} />
                <XAxis type="number" {...axisProps} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" {...axisProps} width={150} />
                <Tooltip cursor={{ fill: 'rgba(15,30,54,0.04)' }} content={<ChartTooltip formatter={(v) => `${v}%`} />} />
                <Bar dataKey="rate" name="Rejected" fill={CHART.red} radius={[0, 5, 5, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Most frequent failures" subtitle="Checklist parameters marked Fail, all inspections">
          <div className="chart-box sm">
            <ResponsiveContainer>
              <BarChart data={failData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={CHART.grid} />
                <XAxis type="number" allowDecimals={false} {...axisProps} />
                <YAxis type="category" dataKey="parameter" {...axisProps} width={170} />
                <Tooltip cursor={{ fill: 'rgba(15,30,54,0.04)' }} content={<ChartTooltip />} />
                <Bar dataKey="count" name="Failures" fill={CHART.brass} radius={[0, 5, 5, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Recent inspections" flush actions={<Button size="sm" variant="ghost" to="/quality/inspections">View all</Button>}>
        <div className="activity-list" style={{ padding: '4px 16px' }}>
          {recent.map((q) => {
            const src = sourceDoc(state, q)
            return (
              <div key={q.id} className="activity-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/quality/inspections/${q.id}`)}>
                <span className={`activity-icon tone-${q.result === 'Accepted' ? 'green' : q.result === 'Rejected' ? 'red' : 'amber'}`}><ClipboardCheck size={14} /></span>
                <div className="grow">
                  <div className="activity-text"><b>{q.number}</b> {items.get(q.itemId)?.name}</div>
                  <div className="activity-time">{q.type}, {src?.number}, {q.inspector}, {fmtDate(q.date)}</div>
                </div>
                <StatusBadge status={q.result} />
              </div>
            )
          })}
          {!recent.length && <div className="muted small" style={{ padding: 12 }}>No inspections recorded yet.</div>}
        </div>
      </Card>
    </>
  )
}
