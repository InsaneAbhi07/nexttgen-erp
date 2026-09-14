/** Material issue list — raw material issued to production orders. Frontend-only demo. */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Eye, IndianRupee, PackageOpen, Plus } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { fmtDate, inr, num, today } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, DataTable, DocNo, FilterPanel, PageHeader, StatCard, inDateRange } from '../../components/ui/index.js'
import { CRUMB } from './shared.jsx'

export default function IssueList() {
  usePageTitle('Material issue')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [filters, setFilters] = useState({})
  const items = byId(state.items)
  const orders = byId(state.productionOrders)
  const warehouses = byId(state.warehouses)
  const monthStart = `${today().slice(0, 7)}-01`

  const allRows = useMemo(
    () =>
      state.materialIssues.map((m) => {
        const order = orders.get(m.productionOrderId)
        const value = m.lines.reduce((a, l) => a + (Number(l.issuedQty) || 0) * (Number(items.get(l.itemId)?.purchaseRate) || 0), 0)
        return {
          ...m,
          order,
          orderNo: order?.number || '—',
          productName: items.get(order?.productId)?.name || '—',
          warehouseName: warehouses.get(m.warehouseId)?.name || '—',
          count: m.lines.filter((l) => Number(l.issuedQty) > 0).length,
          value,
        }
      }),
    [state.materialIssues, orders, items, warehouses],
  )
  const rows = allRows.filter((r) => (!filters.warehouse || r.warehouseId === filters.warehouse) && inDateRange(r.date, filters.period))
  const thisMonth = allRows.filter((r) => r.date >= monthStart)
  const issuedOrders = new Set(state.materialIssues.map((m) => m.productionOrderId))
  const awaiting = state.productionOrders.filter((o) => o.status === 'Released' && !issuedOrders.has(o.id))

  const columns = [
    { key: 'number', header: 'Issue no.', render: (r) => <DocNo to={`/production/material-issue/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'orderNo', header: 'Production order', render: (r) => (r.order ? <DocNo to={`/production/orders/${r.order.id}`}>{r.orderNo}</DocNo> : '—') },
    { key: 'productName', header: 'Product' },
    { key: 'warehouseName', header: 'Warehouse' },
    { key: 'count', header: 'Materials', align: 'right' },
    { key: 'value', header: 'Value', align: 'right', render: (r) => inr(r.value) },
    { key: 'issuedBy', header: 'Issued by' },
  ]

  return (
    <>
      <PageHeader
        title="Material issue"
        subtitle="Raw material and packaging issued from stores to the shop floor against production orders."
        breadcrumbs={[CRUMB, { label: 'Material issue' }]}
        actions={can('Production', 'add') && <Button variant="primary" icon={Plus} to="/production/material-issue/new">New material issue</Button>}
      />
      <div className="grid-3 mb-16">
        <StatCard label="Issues this month" value={thisMonth.length} icon={PackageOpen} tone="brass" foot={`${allRows.length} issue slips in total`} />
        <StatCard label="Material value issued this month" value={inr(thisMonth.reduce((a, r) => a + r.value, 0))} icon={IndianRupee} tone="blue" foot="At standard purchase rates" />
        <StatCard
          label="Orders awaiting material"
          value={awaiting.length}
          icon={ClipboardList}
          tone={awaiting.length ? 'amber' : 'green'}
          foot={awaiting.length ? awaiting.slice(0, 2).map((o) => o.number).join(', ') : 'Every released order has material'}
          to={awaiting[0] ? `/production/material-issue/new?order=${awaiting[0].id}` : undefined}
        />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        exportName="material-issues"
        initialSort={{ key: 'date', dir: 'desc' }}
        searchPlaceholder="Search issue no., order or product…"
        onRowClick={(r) => navigate(`/production/material-issue/${r.id}`)}
        rowActions={(r) => [
          { label: 'View issue slip', icon: Eye, to: `/production/material-issue/${r.id}` },
          r.order && { label: 'Open production order', icon: ClipboardList, to: `/production/orders/${r.order.id}` },
        ].filter(Boolean)}
        filters={
          <FilterPanel
            filters={[
              { key: 'warehouse', label: 'Warehouse', options: state.warehouses.map((w) => ({ value: w.id, label: w.name })), placeholder: 'All warehouses', width: 190 },
              { key: 'period', type: 'daterange' },
            ]}
            values={filters}
            onChange={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
            onReset={() => setFilters({})}
          />
        }
        emptyTitle="No material issued yet"
        emptyDescription={`Issue material to a released production order to move it into production. ${num(awaiting.length)} order(s) are waiting.`}
        emptyAction={can('Production', 'add') && <Button size="sm" variant="primary" icon={Plus} to="/production/material-issue/new">New material issue</Button>}
      />
    </>
  )
}
