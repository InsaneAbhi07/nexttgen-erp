/** Bill of Material list — frontend-only demo (mock data). */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CopyPlus, Eye, Factory, FileClock, Layers, Pencil, Percent, Plus, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { STATUS } from '../../data/constants.js'
import { inr, inr2, pct } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, DataTable, DocNo, FilterPanel, PageHeader, StatCard, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import { CRUMB, bomUnitCost } from './shared.jsx'

export default function BomList() {
  usePageTitle('Bill of material')
  const { state, remove } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [filters, setFilters] = useState({})
  const items = byId(state.items)

  const allRows = useMemo(
    () =>
      state.boms.map((b) => {
        const product = items.get(b.productId)
        const cost = bomUnitCost(b, items)
        const salesRate = Number(product?.salesRate) || 0
        return {
          ...b,
          product,
          productName: product?.name || '—',
          cost,
          salesRate,
          margin: salesRate ? ((salesRate - cost) / salesRate) * 100 : 0,
          count: b.components.length,
          orders: state.productionOrders.filter((o) => o.bomId === b.id).length,
        }
      }),
    [state.boms, state.productionOrders, items],
  )

  const rows = allRows.filter((r) => (!filters.status || r.status === filters.status) && (!filters.category || r.product?.category === filters.category))
  const active = allRows.filter((r) => r.status === 'Active')
  const avgMargin = active.length ? active.reduce((a, r) => a + r.margin, 0) / active.length : 0
  const categories = [...new Set(allRows.map((r) => r.product?.category).filter(Boolean))]

  const handleDelete = async (row) => {
    if (row.orders) {
      toast.error('This BOM can’t be deleted', `${row.orders} production order(s) use ${row.code}. Mark it inactive instead.`)
      return
    }
    const ok = await confirm({ title: 'Delete BOM?', message: `${row.code} for ${row.productName} will be removed from the demo data.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('boms', row.id)
      toast.success('BOM deleted', row.code)
    }
  }

  const columns = [
    {
      key: 'productName',
      header: 'Product',
      render: (r) => (
        <div>
          <div className="cell-primary">{r.productName}</div>
          <div className="cell-secondary">
            {r.product?.code}, {r.product?.category}
          </div>
        </div>
      ),
    },
    { key: 'code', header: 'BOM code', render: (r) => <DocNo to={`/production/bom/${r.id}`}>{r.code}</DocNo> },
    { key: 'version', header: 'Version', render: (r) => `v${r.version}` },
    { key: 'count', header: 'Components', align: 'right' },
    { key: 'cost', header: 'Material cost / unit', align: 'right', render: (r) => inr2(r.cost) },
    { key: 'salesRate', header: 'Selling price', align: 'right', render: (r) => inr(r.salesRate) },
    { key: 'margin', header: 'Material margin', align: 'right', render: (r) => <span className={`strong ${r.margin < 35 ? 'text-amber' : 'text-green'}`}>{pct(r.margin)}</span> },
    { key: 'orders', header: 'Orders', align: 'right' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Bill of material"
        subtitle="Component recipes for every manufactured product, with standard material cost."
        breadcrumbs={[CRUMB, { label: 'Bill of material' }]}
        actions={
          <>
            <Button icon={Factory} to="/production/orders">Production orders</Button>
            {can('Production', 'add') && (
              <Button variant="primary" icon={Plus} to="/production/bom/new">
                New BOM
              </Button>
            )}
          </>
        }
      />

      <div className="grid-4 mb-16">
        <StatCard label="Active BOMs" value={active.length} icon={Layers} tone="brass" foot={`${allRows.length} in total`} />
        <StatCard label="Products covered" value={new Set(active.map((r) => r.productId)).size} icon={Factory} tone="blue" foot="Finished goods with an active recipe" />
        <StatCard label="Average material margin" value={pct(avgMargin)} icon={Percent} tone="green" foot="Selling price vs material cost" />
        <StatCard label="Drafts awaiting approval" value={allRows.filter((r) => r.status === 'Draft').length} icon={FileClock} tone="amber" foot="Under trial with QC" />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        exportName="bill-of-material"
        searchPlaceholder="Search product or BOM code…"
        onRowClick={(r) => navigate(`/production/bom/${r.id}`)}
        filters={
          <FilterPanel
            filters={[
              { key: 'status', label: 'Status', options: STATUS.bom, placeholder: 'All statuses' },
              { key: 'category', label: 'Category', options: categories, placeholder: 'All categories' },
            ]}
            values={filters}
            onChange={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
            onReset={() => setFilters({})}
          />
        }
        rowActions={(r) => [
          { label: 'View BOM', icon: Eye, to: `/production/bom/${r.id}` },
          can('Production', 'edit') && { label: 'Edit', icon: Pencil, to: `/production/bom/${r.id}/edit` },
          can('Production', 'add') && { label: 'New version', icon: CopyPlus, to: `/production/bom/new?copy=${r.id}` },
          can('Production', 'add') && r.status === 'Active' && { label: 'Plan production', icon: Factory, to: `/production/orders/new?product=${r.productId}` },
          can('Production', 'delete') && { divider: true },
          can('Production', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(r) },
        ].filter(Boolean)}
        emptyTitle="No bills of material yet"
        emptyDescription="Create a BOM to define the components needed for a product."
        emptyAction={can('Production', 'add') && <Button size="sm" variant="primary" icon={Plus} to="/production/bom/new">New BOM</Button>}
      />
    </>
  )
}
