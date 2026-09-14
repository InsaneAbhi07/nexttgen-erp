/** Production orders list — frontend-only demo. */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Calculator, ClipboardList, Eye, Factory, Gauge, Layers, Loader, PackageCheck, PackageOpen, Pencil, Plus } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, productionProgress } from '../../store/selectors.js'
import { PRIORITIES } from '../../data/constants.js'
import { fmtDate, num, today } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, DataTable, DocNo, FilterPanel, PageHeader, Progress, StatCard, StatusBadge, Tabs, inDateRange, useConfirm, useToast } from '../../components/ui/index.js'
import { CRUMB } from './shared.jsx'

const TABS = ['All', 'Planned', 'Released', 'In Progress', 'Completed', 'Cancelled']

export default function OrderList() {
  usePageTitle('Production orders')
  const { state, patch } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState({})
  const items = byId(state.items)
  const boms = byId(state.boms)
  const t = today()
  const monthStart = `${t.slice(0, 7)}-01`

  const allRows = useMemo(
    () =>
      state.productionOrders.map((o) => {
        const p = items.get(o.productId)
        const prog = productionProgress(state, o.id)
        const lastEntry = prog.entries.reduce((a, e) => (e.date > a ? e.date : a), '')
        return {
          ...o,
          product: p,
          productName: p?.name || '—',
          bomCode: boms.get(o.bomId)?.code,
          produced: prog.produced,
          good: prog.good,
          lastEntry,
          pctDone: o.plannedQty ? (prog.produced / o.plannedQty) * 100 : 0,
          overdue: !['Completed', 'Cancelled'].includes(o.status) && o.expectedDate < t,
        }
      }),
    [state, items, boms, t],
  )

  const filtered = allRows.filter(
    (r) =>
      (!filters.product || r.productId === filters.product) &&
      (!filters.priority || r.priority === filters.priority) &&
      inDateRange(r.date, filters.period),
  )
  const rows = tab === 'All' ? filtered : filtered.filter((r) => r.status === tab)

  const planned = allRows.filter((r) => ['Planned', 'Released'].includes(r.status))
  const inProgress = allRows.filter((r) => r.status === 'In Progress')
  const completedMonth = allRows.filter((r) => r.status === 'Completed' && r.lastEntry >= monthStart)
  const todayEntries = state.productionEntries.filter((e) => e.date === t)
  const todayOutput = todayEntries.reduce((a, e) => a + Number(e.producedQty), 0)
  const todayRejected = todayEntries.reduce((a, e) => a + (Number(e.rejectedQty) || 0), 0)
  const monthUnits = state.productionEntries.filter((e) => e.date >= monthStart).reduce((a, e) => a + Number(e.producedQty), 0)

  const productOptions = [...new Set(state.productionOrders.map((o) => o.productId))].map((id) => ({ value: id, label: items.get(id)?.name || id }))

  const cancelOrder = async (row) => {
    if (row.produced > 0) {
      toast.error('This order can’t be cancelled', 'Production has already been recorded against it.')
      return
    }
    const ok = await confirm({ title: 'Cancel production order?', message: `${row.number} for ${num(row.plannedQty)} × ${row.productName} will be cancelled. Issued material stays issued.`, confirmLabel: 'Cancel order', cancelLabel: 'Keep order', tone: 'danger' })
    if (ok) {
      patch('productionOrders', row.id, { status: 'Cancelled' }, { action: 'cancelled' })
      toast.success('Production order cancelled', row.number)
    }
  }

  const columns = [
    { key: 'number', header: 'Order no.', render: (r) => <DocNo to={`/production/orders/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'productName', header: 'Product', render: (r) => (<div><div className="cell-primary">{r.productName}</div><div className="cell-secondary">{r.bomCode}</div></div>) },
    { key: 'plannedQty', header: 'Planned', align: 'right', render: (r) => `${num(r.plannedQty)} ${r.product?.unit || ''}` },
    {
      key: 'pctDone',
      header: 'Progress',
      render: (r) => (
        <div style={{ minWidth: 130 }}>
          <Progress value={r.pctDone} tone={r.status === 'Cancelled' ? 'red' : r.pctDone >= 100 ? 'green' : 'brass'} />
          <div className="cell-secondary" style={{ marginTop: 3 }}>{num(r.produced)} of {num(r.plannedQty)} produced</div>
        </div>
      ),
    },
    { key: 'priority', header: 'Priority', render: (r) => <StatusBadge status={r.priority} /> },
    { key: 'expectedDate', header: 'Expected', render: (r) => <span className={r.overdue ? 'text-red strong' : ''}>{fmtDate(r.expectedDate)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Production orders"
        subtitle="Plan batches against active BOMs, issue material and track shop-floor output."
        breadcrumbs={[CRUMB, { label: 'Production orders' }]}
        actions={
          <>
            <Button icon={Layers} to="/production/bom">Bill of material</Button>
            {can('Production', 'add') && (
              <Button variant="primary" icon={Plus} to="/production/orders/new">
                New production order
              </Button>
            )}
          </>
        }
      />

      <div className="grid-4 mb-16">
        <StatCard label="Planned and released" value={planned.length} icon={ClipboardList} tone="violet" foot={`${planned.filter((r) => r.status === 'Released').length} released to the shop floor`} onClick={() => setTab('Planned')} />
        <StatCard label="In progress" value={inProgress.length} icon={Loader} tone="blue" foot={`${num(inProgress.reduce((a, r) => a + Math.max(0, r.plannedQty - r.produced), 0))} units still to produce`} onClick={() => setTab('In Progress')} />
        <StatCard label="Completed this month" value={completedMonth.length} icon={PackageCheck} tone="green" foot={`${num(monthUnits)} units produced this month`} onClick={() => setTab('Completed')} />
        <StatCard label="Today’s output" value={`${num(todayOutput)} units`} icon={Gauge} tone="brass" foot={`${num(todayRejected)} rejected across ${todayEntries.length} entries`} to="/production/entries" />
      </div>

      <Tabs
        style={{ marginBottom: 12 }}
        value={tab}
        onChange={setTab}
        tabs={TABS.map((s) => ({ key: s, label: s === 'All' ? 'All orders' : s, count: s === 'All' ? filtered.length : filtered.filter((r) => r.status === s).length }))}
      />

      <DataTable
        columns={columns}
        data={rows}
        exportName="production-orders"
        initialSort={{ key: 'date', dir: 'desc' }}
        searchPlaceholder="Search order no. or product…"
        onRowClick={(r) => navigate(`/production/orders/${r.id}`)}
        filters={
          <FilterPanel
            filters={[
              { key: 'product', label: 'Product', options: productOptions, placeholder: 'All products', width: 200 },
              { key: 'priority', label: 'Priority', options: PRIORITIES, placeholder: 'All priorities' },
              { key: 'period', type: 'daterange' },
            ]}
            values={filters}
            onChange={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
            onReset={() => setFilters({})}
          />
        }
        rowActions={(r) => {
          const open = ['Planned', 'Released', 'In Progress'].includes(r.status)
          return [
            { label: 'Open order', icon: Eye, to: `/production/orders/${r.id}` },
            can('Production', 'edit') && open && { label: 'Edit', icon: Pencil, to: `/production/orders/${r.id}/edit` },
            can('Production', 'add') && open && { label: 'Issue material', icon: PackageOpen, to: `/production/material-issue/new?order=${r.id}` },
            can('Production', 'add') && open && { label: 'Record production', icon: Factory, to: `/production/entries/new?order=${r.id}` },
            r.produced > 0 && { label: 'View costing', icon: Calculator, to: `/production/costing?order=${r.id}` },
            can('Production', 'edit') && open && r.produced === 0 && { divider: true },
            can('Production', 'edit') && open && r.produced === 0 && { label: 'Cancel order', icon: Ban, danger: true, onClick: () => cancelOrder(r) },
          ].filter(Boolean)
        }}
        emptyTitle={tab === 'All' ? 'No production orders yet' : `No ${tab.toLowerCase()} orders`}
        emptyDescription="Plan a batch from an active BOM to start production."
        emptyAction={can('Production', 'add') && <Button size="sm" variant="primary" icon={Plus} to="/production/orders/new">New production order</Button>}
      />
    </>
  )
}
