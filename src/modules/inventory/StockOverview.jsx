/**
 * Stock overview — balances, valuation and alerts derived from mock stock moves (frontend-only demo).
 */
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, BookOpen, Boxes, IndianRupee, Layers, PackageX, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock, lowStockItems, stockSummary, stockValue } from '../../store/selectors.js'
import { inr, inrCompact, num } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { PRODUCT_TYPES } from '../../data/constants.js'
import { CHART, axisProps } from '../../config/theme.js'
import ChartTooltip from '../../components/common/ChartTooltip.jsx'
import { Button, Card, DataTable, DateRange, EmptyState, FilterPanel, PageHeader, Progress, StatCard, StatusBadge, presetRange } from '../../components/ui/index.js'
import { INV_CRUMB, stockStatus } from './helpers.jsx'

export default function StockOverview() {
  usePageTitle('Stock overview')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tableRef = useRef(null)
  const [range, setRange] = useState(() => ({ ...presetRange('month'), preset: 'month' }))
  const [filters, setFilters] = useState(() => ({
    warehouseId: params.get('warehouse') || '',
    type: params.get('type') || '',
    category: '',
    status: params.get('status') || '',
  }))
  const warehouses = byId(state.warehouses)

  const kpi = useMemo(() => {
    const active = state.items.filter((i) => i.status !== 'Inactive')
    let qty = 0
    let out = 0
    active.forEach((i) => {
      const b = itemStock(state, i.id)
      if (b > 0) qty += b
      else out += 1
    })
    const low = lowStockItems(state).filter((r) => r.balance > 0).length
    return { items: active.length, qty: Math.round(qty), value: stockValue(state), low, out }
  }, [state])

  const whStats = useMemo(() => {
    const all = stockSummary(state)
    const total = all.reduce((a, r) => a + Math.max(0, r.value), 0) || 1
    return state.warehouses
      .filter((w) => w.status === 'Active')
      .map((w) => {
        const rows = all.filter((r) => r.warehouseId === w.id)
        const value = rows.reduce((a, r) => a + Math.max(0, r.value), 0)
        return {
          w,
          items: rows.filter((r) => r.balance > 0).length,
          qty: rows.reduce((a, r) => a + Math.max(0, r.balance), 0),
          value,
          share: (value / total) * 100,
        }
      })
  }, [state])

  const byCategory = useMemo(() => {
    const map = {}
    state.items
      .filter((i) => i.status !== 'Inactive')
      .forEach((i) => {
        const v = itemStock(state, i.id) * (Number(i.purchaseRate) || 0)
        if (v > 0) map[i.category] = (map[i.category] || 0) + v
      })
    return Object.entries(map)
      .map(([category, value]) => ({ category, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
  }, [state])

  const low = lowStockItems(state)

  const actionFor = (item, balance) => {
    const min = Number(item.minStock) || 0
    const qty = Math.max(min * 2 - balance, min, 10)
    if (item.type === 'Finished Good') {
      const bom = state.boms.find((b) => b.productId === item.id && b.status === 'Active')
      return bom
        ? { label: 'Plan production', to: `/production/orders/new?product=${item.id}&qty=${Math.ceil(qty / 10) * 10}` }
        : { label: 'Set up BOM', to: `/production/bom/new?product=${item.id}` }
    }
    const sup = state.suppliers.find((s) => (s.itemIds || []).includes(item.id))
    return { label: 'Raise purchase order', to: sup ? `/purchase/orders/new?supplier=${sup.id}` : '/purchase/orders/new' }
  }

  const rows = useMemo(() => {
    const base = stockSummary(state, { from: range.from || undefined, to: range.to || undefined, warehouseId: filters.warehouseId || undefined })
    const seen = new Set(base.map((r) => r.itemId))
    const extra = filters.warehouseId
      ? []
      : state.items
          .filter((i) => !seen.has(i.id) && i.status !== 'Inactive')
          .map((i) => ({ key: `${i.id}|${i.warehouseId}`, itemId: i.id, warehouseId: i.warehouseId, opening: 0, inward: 0, outward: 0, balance: 0, value: 0, item: i }))
    return [...base, ...extra]
      .map((r) => ({ ...r, status: stockStatus(itemStock(state, r.itemId), r.item.minStock), warehouseName: warehouses.get(r.warehouseId)?.name || '—' }))
      .filter((r) => (!filters.type || r.item.type === filters.type) && (!filters.category || r.item.category === filters.category) && (!filters.status || r.status === filters.status))
      .sort((a, b) => a.item.code.localeCompare(b.item.code) || a.warehouseName.localeCompare(b.warehouseName))
  }, [state, range, filters, warehouses])

  const tableValue = rows.reduce((a, r) => a + r.value, 0)

  const focusTable = (patch) => {
    setFilters((f) => ({ ...f, ...patch }))
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }

  const columns = [
    { key: 'code', header: 'Item code', accessor: (r) => r.item.code, render: (r) => <span className="doc-no">{r.item.code}</span> },
    {
      key: 'name', header: 'Item name', accessor: (r) => r.item.name,
      render: (r) => (
        <div>
          <div className="cell-primary">{r.item.name}</div>
          <div className="cell-secondary">{r.item.category}, {r.item.type}</div>
        </div>
      ),
    },
    { key: 'warehouse', header: 'Warehouse', accessor: (r) => r.warehouseName },
    { key: 'opening', header: 'Opening', align: 'right', accessor: (r) => r.opening, render: (r) => <span className="num">{num(r.opening)}</span> },
    { key: 'inward', header: 'Inward', align: 'right', accessor: (r) => r.inward, render: (r) => (r.inward ? <span className="num text-green">+{num(r.inward)}</span> : <span className="muted">—</span>) },
    { key: 'outward', header: 'Outward', align: 'right', accessor: (r) => r.outward, render: (r) => (r.outward ? <span className="num text-red">−{num(r.outward)}</span> : <span className="muted">—</span>) },
    { key: 'balance', header: 'Balance', align: 'right', accessor: (r) => r.balance, render: (r) => <span className="num strong">{num(r.balance)}</span> },
    { key: 'unit', header: 'Unit', accessor: (r) => r.item.unit },
    { key: 'value', header: 'Value', align: 'right', accessor: (r) => r.value, render: (r) => <span className="num">{inr(r.value)}</span> },
    { key: 'status', header: 'Status', accessor: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Stock overview"
        subtitle="Live balances across the raw material store, finished goods godown and depots."
        breadcrumbs={[INV_CRUMB, { label: 'Stock overview' }]}
        actions={
          <>
            <Button icon={BookOpen} to="/inventory/ledger">Stock ledger</Button>
            {can('Inventory', 'add') && (
              <>
                <Button icon={ArrowLeftRight} to="/inventory/transfers/new">Transfer</Button>
                <Button icon={SlidersHorizontal} to="/inventory/adjustments?new=1">Adjust</Button>
                <Button icon={ArrowUpFromLine} to="/inventory/stock-out?new=1">Stock out</Button>
                <Button variant="primary" icon={ArrowDownToLine} to="/inventory/stock-in?new=1">Stock in</Button>
              </>
            )}
          </>
        }
      />

      <div className="grid-5 mb-16">
        <StatCard label="Total items" value={num(kpi.items)} icon={Layers} tone="blue" foot="Active items in item master" />
        <StatCard label="Total stock quantity" value={num(kpi.qty)} icon={Boxes} tone="teal" foot="Across all units and warehouses" />
        <StatCard label="Stock value" value={inrCompact(kpi.value)} icon={IndianRupee} tone="brass" foot={`${inr(kpi.value)} at purchase rate`} />
        <StatCard label="Low stock" value={num(kpi.low)} icon={TriangleAlert} tone="amber" foot="At or below minimum level" onClick={() => focusTable({ status: 'Low Stock' })} />
        <StatCard label="Out of stock" value={num(kpi.out)} icon={PackageX} tone="red" foot="Zero balance" onClick={() => focusTable({ status: 'Out of Stock' })} />
      </div>

      <div className="inv-three">
        <Card title="Warehouse-wise stock" subtitle="Select a warehouse to filter the stock table">
          <div className="stack-sm" style={{ gap: 2 }}>
            {whStats.map((s) => (
              <button
                key={s.w.id}
                type="button"
                className={`wh-row ${filters.warehouseId === s.w.id ? 'active' : ''}`}
                onClick={() => focusTable({ warehouseId: filters.warehouseId === s.w.id ? '' : s.w.id })}
              >
                <span>
                  <span className="cell-primary">{s.w.name}</span>
                  <span className="cell-secondary" style={{ display: 'block' }}>
                    {s.items} items in stock, {num(s.qty)} units
                  </span>
                </span>
                <span className="text-right">
                  <span className="strong num">{inrCompact(s.value)}</span>
                  <span className="cell-secondary" style={{ display: 'block' }}>{s.share.toFixed(1)}% of value</span>
                </span>
                <Progress value={s.share} tone="brass" />
              </button>
            ))}
          </div>
        </Card>

        <Card title="Stock value by category" subtitle="Valued at purchase rate">
          {byCategory.length ? (
            <div className="chart-box sm" style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid horizontal={false} stroke={CHART.grid} />
                  <XAxis type="number" {...axisProps} tickFormatter={(v) => inrCompact(v)} />
                  <YAxis type="category" dataKey="category" {...axisProps} width={96} />
                  <Tooltip cursor={{ fill: 'rgba(31,95,214,0.05)' }} content={<ChartTooltip formatter={(v) => inr(v)} />} />
                  <Bar dataKey="value" name="Stock value" fill={CHART.blue} radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState compact title="No stock on hand" description="Post a GRN or stock in entry to see valuation." />
          )}
        </Card>

        <Card
          title="Low stock alerts"
          subtitle={`${low.length} items at or below minimum level`}
          actions={low.length > 6 && <Button size="sm" variant="ghost" onClick={() => focusTable({ status: 'Low Stock' })}>View all</Button>}
        >
          {low.length === 0 ? (
            <EmptyState compact title="All items above minimum" description="Nothing needs reordering right now." />
          ) : (
            <div>
              {low.slice(0, 6).map(({ item, balance, minStock }) => {
                const action = actionFor(item, balance)
                const pctLeft = minStock ? (balance / minStock) * 100 : 0
                return (
                  <div key={item.id} className="low-row">
                    <div className="grow">
                      <Link to={`/inventory/ledger?item=${item.id}`} className="cell-primary truncate" style={{ display: 'block', color: 'var(--ink)' }}>
                        {item.name}
                      </Link>
                      <div className="row" style={{ gap: 8, marginTop: 4 }}>
                        <Progress value={pctLeft} tone={balance <= 0 ? 'red' : 'amber'} style={{ flex: 1 }} />
                        <span className={`tiny nowrap ${balance <= 0 ? 'text-red' : 'text-amber'}`}>
                          {num(balance)} / {num(minStock)} {item.unit}
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="soft" to={action.to}>
                      {action.label}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <div ref={tableRef} style={{ scrollMarginTop: 76 }}>
        <DataTable
          title="Stock summary"
          subtitle={`${rows.length} item-warehouse rows, valued at ${inr(tableValue)}. Select a row to open its stock ledger.`}
          columns={columns}
          data={rows}
          rowKey="key"
          pageSize={25}
          exportName="stock-summary"
          searchPlaceholder="Search item code or name…"
          onRowClick={(r) => navigate(`/inventory/ledger?item=${r.itemId}&warehouse=${r.warehouseId}`)}
          filters={
            <>
              <DateRange size="sm" value={range} onChange={setRange} />
              <FilterPanel
                filters={[
                  { key: 'warehouseId', label: 'Warehouses', options: state.warehouses.map((w) => ({ value: w.id, label: w.name })) },
                  { key: 'type', label: 'Types', options: PRODUCT_TYPES },
                  { key: 'category', label: 'Categories', options: state.categories.map((c) => c.name) },
                  { key: 'status', label: 'Statuses', options: ['In Stock', 'Low Stock', 'Out of Stock'], width: 140 },
                ]}
                values={filters}
                onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
                onReset={() => setFilters({ warehouseId: '', type: '', category: '', status: '' })}
              />
            </>
          }
          emptyTitle="No stock rows match"
          emptyDescription="Change the warehouse, type or status filter."
        />
      </div>
    </>
  )
}
