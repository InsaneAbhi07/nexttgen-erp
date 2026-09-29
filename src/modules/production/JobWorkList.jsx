/** Job work challans — material out for plating, buffing and heat treatment. Frontend-only demo. */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlarmClock, Eye, IndianRupee, PackageCheck, Plus, Send, Truck } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { jobWorkBalance } from '../../store/mfg.js'
import { JOB_WORK_PROCESSES } from '../../data/constants.js'
import { fmtDate, inr, num, today } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, DataTable, DocNo, FilterPanel, PageHeader, Progress, StatCard, StatusBadge, Tabs, inDateRange } from '../../components/ui/index.js'
import { CRUMB } from './shared.jsx'

const TABS = ['All', 'Sent', 'Partially Received', 'Received', 'Closed']
const OPEN = ['Sent', 'Partially Received']

export default function JobWorkList() {
  usePageTitle('Job work')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState({})
  const items = byId(state.items)
  const suppliers = byId(state.suppliers)
  const t = today()
  const monthStart = `${t.slice(0, 7)}-01`

  const allRows = useMemo(
    () =>
      (state.jobWorkOrders || []).map((j) => {
        const bal = jobWorkBalance(state, j)
        const worker = suppliers.get(j.supplierId)
        return {
          ...j,
          bal,
          worker,
          workerName: worker?.name || '—',
          itemsText: j.lines.map((l) => items.get(l.itemId)?.name).join(', '),
          pendingValue: bal.lines.reduce((a, l) => a + l.pending * (Number(items.get(l.itemId)?.purchaseRate) || 0), 0),
          overdue: OPEN.includes(j.status) && j.expectedDate < t,
        }
      }),
    [state, items, suppliers, t],
  )

  const filtered = allRows.filter(
    (r) => (!filters.worker || r.supplierId === filters.worker) && (!filters.process || r.process === filters.process) && inDateRange(r.date, filters.period),
  )
  const rows = tab === 'All' ? filtered : filtered.filter((r) => r.status === tab)
  const open = allRows.filter((r) => OPEN.includes(r.status))
  const overdue = allRows.filter((r) => r.overdue)
  const monthCharges = (state.jobWorkReceipts || [])
    .filter((r) => r.date >= monthStart)
    .reduce((a, r) => a + r.lines.reduce((b, l) => b + (Number(l.receivedQty) || 0) * (Number(l.rate) || 0), 0), 0)

  const columns = [
    { key: 'number', header: 'Challan no.', render: (r) => <DocNo to={`/production/job-work/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'workerName', header: 'Job worker', render: (r) => (<div><div className="cell-primary">{r.workerName}</div><div className="cell-secondary">{r.process}</div></div>) },
    { key: 'itemsText', header: 'Material', render: (r) => <span className="truncate" style={{ display: 'inline-block', maxWidth: 240 }} title={r.itemsText}>{r.itemsText}</span> },
    {
      key: 'progress',
      header: 'Returned',
      accessor: (r) => (r.bal.sent ? (r.bal.received + r.bal.rejected) / r.bal.sent : 0),
      render: (r) => (
        <div className="jw-balance">
          <Progress value={r.bal.sent ? ((r.bal.received + r.bal.rejected) / r.bal.sent) * 100 : 0} tone={r.status === 'Received' ? 'green' : 'brass'} />
          <div className="cell-secondary" style={{ marginTop: 3 }}>{num(r.bal.received + r.bal.rejected)} of {num(r.bal.sent)}{r.bal.rejected ? `, ${num(r.bal.rejected)} rejected` : ''}</div>
        </div>
      ),
    },
    { key: 'pending', header: 'Pending', align: 'right', accessor: (r) => r.bal.pending, render: (r) => (r.bal.pending ? <span className="strong">{num(r.bal.pending)}</span> : <span className="muted">—</span>) },
    { key: 'expectedDate', header: 'Expected', render: (r) => <span className={r.overdue ? 'text-red strong' : ''}>{fmtDate(r.expectedDate)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Job work"
        subtitle="Material sent to platers, buffers and heat treaters, and what has come back."
        breadcrumbs={[CRUMB, { label: 'Job work' }]}
        actions={can('Production', 'add') && <Button variant="primary" icon={Plus} to="/production/job-work/new">Send for job work</Button>}
      />

      <div className="grid-4 mb-16">
        <StatCard label="Open challans" value={open.length} icon={Send} tone="violet" foot={`${num(open.reduce((a, r) => a + r.bal.pending, 0))} pieces still out`} onClick={() => setTab('Sent')} />
        <StatCard label="Material at job workers" value={inr(open.reduce((a, r) => a + r.pendingValue, 0))} icon={Truck} tone="brass" foot="At purchase rate" to="/inventory/stock" />
        <StatCard label="Overdue" value={overdue.length} icon={AlarmClock} tone={overdue.length ? 'red' : 'green'} foot={overdue.length ? overdue.map((r) => r.workerName).slice(0, 2).join(', ') : 'Everything on time'} />
        <StatCard label="Job charges this month" value={inr(monthCharges)} icon={IndianRupee} tone="blue" foot="On pieces received back OK" />
      </div>

      <Tabs
        style={{ marginBottom: 12 }}
        value={tab}
        onChange={setTab}
        tabs={TABS.map((s) => ({ key: s, label: s === 'All' ? 'All challans' : s, count: s === 'All' ? filtered.length : filtered.filter((r) => r.status === s).length }))}
      />

      <DataTable
        columns={columns}
        data={rows}
        exportName="job-work"
        initialSort={{ key: 'date', dir: 'desc' }}
        searchPlaceholder="Search challan, job worker or item…"
        onRowClick={(r) => navigate(`/production/job-work/${r.id}`)}
        filters={
          <FilterPanel
            filters={[
              { key: 'worker', label: 'Job worker', options: state.suppliers.filter((s) => s.jobWorker).map((s) => ({ value: s.id, label: s.name })), placeholder: 'All job workers', width: 190 },
              { key: 'process', label: 'Process', options: JOB_WORK_PROCESSES, placeholder: 'All processes' },
              { key: 'period', type: 'daterange' },
            ]}
            values={filters}
            onChange={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
            onReset={() => setFilters({})}
          />
        }
        rowActions={(r) => [
          { label: 'Open challan', icon: Eye, to: `/production/job-work/${r.id}` },
          can('Production', 'add') && OPEN.includes(r.status) && { label: 'Receive material', icon: PackageCheck, to: `/production/job-work/${r.id}?receive=1` },
        ].filter(Boolean)}
        emptyTitle={tab === 'All' ? 'No job work yet' : `No ${tab.toLowerCase()} challans`}
        emptyDescription="Send castings for plating or buffing on a job work challan."
        emptyAction={can('Production', 'add') && <Button size="sm" variant="primary" icon={Plus} to="/production/job-work/new">Send for job work</Button>}
      />
    </>
  )
}
