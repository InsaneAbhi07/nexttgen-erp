/** Production entry list — shift-wise output. Frontend-only demo. */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Eye, Factory, Gauge, IndianRupee, Percent, Plus } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { fmtDate, inr, num, pct, today } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, DataTable, DocNo, FilterPanel, PageHeader, StatCard, inDateRange } from '../../components/ui/index.js'
import { CRUMB, SHIFTS } from './shared.jsx'

export default function EntryList() {
  usePageTitle('Production entries')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [filters, setFilters] = useState({})
  const items = byId(state.items)
  const orders = byId(state.productionOrders)
  const t = today()
  const monthStart = `${t.slice(0, 7)}-01`

  const allRows = useMemo(
    () =>
      state.productionEntries.map((e) => {
        const good = Number(e.producedQty) - (Number(e.rejectedQty) || 0)
        return {
          ...e,
          order: orders.get(e.productionOrderId),
          product: items.get(e.productId),
          productName: items.get(e.productId)?.name || '—',
          good,
          yieldPct: Number(e.producedQty) ? (good / Number(e.producedQty)) * 100 : 0,
        }
      }),
    [state.productionEntries, orders, items],
  )
  const rows = allRows.filter((r) => (!filters.product || r.productId === filters.product) && (!filters.shift || r.shift === filters.shift) && inDateRange(r.date, filters.period))
  const todayRows = allRows.filter((r) => r.date === t)
  const monthRows = allRows.filter((r) => r.date >= monthStart)
  const monthProduced = monthRows.reduce((a, r) => a + Number(r.producedQty), 0)
  const monthRejected = monthRows.reduce((a, r) => a + (Number(r.rejectedQty) || 0), 0)
  const productOptions = [...new Set(state.productionEntries.map((e) => e.productId))].map((id) => ({ value: id, label: items.get(id)?.name || id }))

  const columns = [
    { key: 'number', header: 'Entry no.', render: (r) => <DocNo to={`/production/entries/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'order', header: 'Production order', accessor: (r) => r.order?.number, render: (r) => (r.order ? <DocNo to={`/production/orders/${r.order.id}`}>{r.order.number}</DocNo> : '—') },
    { key: 'productName', header: 'Product' },
    { key: 'shift', header: 'Shift' },
    { key: 'producedQty', header: 'Produced', align: 'right', render: (r) => num(r.producedQty) },
    { key: 'rejectedQty', header: 'Rejected', align: 'right', render: (r) => <span className={Number(r.rejectedQty) ? 'text-red' : 'muted'}>{num(r.rejectedQty)}</span> },
    { key: 'good', header: 'Good', align: 'right', render: (r) => <span className="strong">{num(r.good)}</span> },
    { key: 'yieldPct', header: 'Yield', align: 'right', render: (r) => pct(r.yieldPct) },
    { key: 'labourCost', header: 'Labour cost', align: 'right', render: (r) => inr(r.labourCost) },
  ]

  return (
    <>
      <PageHeader
        title="Production entries"
        subtitle="Shift-wise output recorded against production orders. Good quantity is added to finished goods stock."
        breadcrumbs={[CRUMB, { label: 'Production entries' }]}
        actions={can('Production', 'add') && <Button variant="primary" icon={Plus} to="/production/entries/new">Record production</Button>}
      />
      <div className="grid-4 mb-16">
        <StatCard label="Today’s output" value={`${num(todayRows.reduce((a, r) => a + Number(r.producedQty), 0))} units`} icon={Gauge} tone="brass" foot={`${todayRows.length} entries today`} />
        <StatCard label="Produced this month" value={`${num(monthProduced)} units`} icon={Factory} tone="blue" foot={`${monthRows.length} entries`} />
        <StatCard label="Rejection rate this month" value={pct(monthProduced ? (monthRejected / monthProduced) * 100 : 0)} icon={Percent} tone={monthProduced && monthRejected / monthProduced > 0.02 ? 'red' : 'green'} foot={`${num(monthRejected)} units rejected`} />
        <StatCard label="Labour cost this month" value={inr(monthRows.reduce((a, r) => a + (Number(r.labourCost) || 0), 0))} icon={IndianRupee} tone="violet" foot="From production entries" />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        exportName="production-entries"
        initialSort={{ key: 'date', dir: 'desc' }}
        searchPlaceholder="Search entry no., order or product…"
        onRowClick={(r) => navigate(`/production/entries/${r.id}`)}
        rowActions={(r) => [
          { label: 'View entry', icon: Eye, to: `/production/entries/${r.id}` },
          r.order && { label: 'Open production order', icon: ClipboardList, to: `/production/orders/${r.order.id}` },
        ].filter(Boolean)}
        filters={
          <FilterPanel
            filters={[
              { key: 'product', label: 'Product', options: productOptions, placeholder: 'All products', width: 200 },
              { key: 'shift', label: 'Shift', options: SHIFTS, placeholder: 'All shifts', width: 120 },
              { key: 'period', type: 'daterange' },
            ]}
            values={filters}
            onChange={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
            onReset={() => setFilters({})}
          />
        }
        emptyTitle="No production recorded"
        emptyDescription="Record shift output against a released production order."
        emptyAction={can('Production', 'add') && <Button size="sm" variant="primary" icon={Plus} to="/production/entries/new">Record production</Button>}
      />
    </>
  )
}
