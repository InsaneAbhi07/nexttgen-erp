/**
 * Stock transfers list — movement between own warehouses (frontend-only demo).
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, CalendarDays, CheckCircle2, Eye, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock } from '../../store/selectors.js'
import { fmtDate, num } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, DataTable, DateRange, DocNo, FilterPanel, PageHeader, StatCard, StatusBadge, inDateRange, useConfirm, useToast } from '../../components/ui/index.js'
import { INV_CRUMB, inMonth, warehouseOptions } from './helpers.jsx'

export function useTransferActions() {
  const { state, patch, remove } = useErp()
  const toast = useToast()
  const confirm = useConfirm()
  const items = byId(state.items)
  const warehouses = byId(state.warehouses)

  const markReceived = (t) => {
    patch('stockTransfers', t.id, { status: 'Received', receivedAt: new Date().toISOString() }, { action: 'received' })
    toast.success('Transfer marked as received', `${t.number} arrived at ${warehouses.get(t.toWarehouseId)?.name}.`)
  }

  const deleteTransfer = async (t) => {
    const blocked = t.lines.find((l) => itemStock(state, l.itemId, t.toWarehouseId) < Number(l.qty))
    if (blocked) {
      toast.error('This transfer can’t be deleted', `${items.get(blocked.itemId)?.name} has already been used at ${warehouses.get(t.toWarehouseId)?.name}.`)
      return false
    }
    const ok = await confirm({
      title: 'Delete stock transfer?',
      message: `${t.number} will be removed and quantities will move back to ${warehouses.get(t.fromWarehouseId)?.name}.`,
      confirmLabel: 'Delete transfer',
      tone: 'danger',
    })
    if (!ok) return false
    remove('stockTransfers', t.id)
    toast.success('Stock transfer deleted', `${t.number} has been reversed.`)
    return true
  }

  return { markReceived, deleteTransfer }
}

export default function TransferList() {
  usePageTitle('Stock transfers')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const { markReceived, deleteTransfer } = useTransferActions()
  const [range, setRange] = useState({ preset: 'all', from: '', to: '' })
  const [filters, setFilters] = useState({})
  const warehouses = byId(state.warehouses)
  const list = state.stockTransfers

  const stats = useMemo(() => {
    const month = list.filter((t) => inMonth(t.date))
    return {
      count: month.length,
      transit: list.filter((t) => t.status === 'In Transit').length,
      units: month.reduce((a, t) => a + t.lines.reduce((b, l) => b + Number(l.qty), 0), 0),
      toDepot: month.filter((t) => t.toWarehouseId === 'wh-del').length,
    }
  }, [list])

  const data = useMemo(
    () =>
      list
        .filter((t) => inDateRange(t.date, range) && (!filters.status || t.status === filters.status) && (!filters.from || t.fromWarehouseId === filters.from) && (!filters.to || t.toWarehouseId === filters.to))
        .map((t) => ({
          ...t,
          fromName: warehouses.get(t.fromWarehouseId)?.name || '—',
          toName: warehouses.get(t.toWarehouseId)?.name || '—',
          itemCount: t.lines.length,
          totalQty: t.lines.reduce((a, l) => a + Number(l.qty), 0),
        })),
    [list, range, filters, warehouses],
  )

  const columns = [
    { key: 'number', header: 'Transfer no.', accessor: (r) => r.number, render: (r) => <DocNo to={`/inventory/transfers/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', accessor: (r) => r.date, render: (r) => fmtDate(r.date) },
    { key: 'from', header: 'From warehouse', accessor: (r) => r.fromName },
    { key: 'to', header: 'To warehouse', accessor: (r) => r.toName },
    { key: 'items', header: 'Items', align: 'right', accessor: (r) => r.itemCount },
    { key: 'qty', header: 'Total quantity', align: 'right', accessor: (r) => r.totalQty, render: (r) => <span className="num strong">{num(r.totalQty)}</span> },
    { key: 'vehicle', header: 'Vehicle no.', accessor: (r) => r.vehicleNo, render: (r) => r.vehicleNo || <span className="muted">—</span> },
    { key: 'status', header: 'Status', accessor: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ]

  const rowActions = (t) =>
    [
      { label: 'View transfer', icon: Eye, onClick: () => navigate(`/inventory/transfers/${t.id}`) },
      can('Inventory', 'edit') && { label: 'Edit', icon: Pencil, onClick: () => navigate(`/inventory/transfers/${t.id}/edit`) },
      can('Inventory', 'edit') && t.status === 'In Transit' && { label: 'Mark as received', icon: CheckCircle2, onClick: () => markReceived(t) },
      can('Inventory', 'delete') && { divider: true },
      can('Inventory', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => deleteTransfer(t) },
    ].filter(Boolean)

  return (
    <>
      <PageHeader
        title="Stock transfers"
        subtitle="Move stock between the Aligarh godowns and the Delhi depot."
        breadcrumbs={[INV_CRUMB, { label: 'Stock transfers' }]}
        actions={
          can('Inventory', 'add') && (
            <Button variant="primary" icon={Plus} to="/inventory/transfers/new">
              New transfer
            </Button>
          )
        }
      />

      <div className="grid-4 mb-16">
        <StatCard label="Transfers this month" value={num(stats.count)} icon={CalendarDays} tone="blue" />
        <StatCard label="In transit" value={num(stats.transit)} icon={Truck} tone="amber" foot="Awaiting receipt at destination" />
        <StatCard label="Units moved this month" value={num(stats.units)} icon={ArrowLeftRight} tone="teal" />
        <StatCard label="Dispatches to Delhi Depot" value={num(stats.toDepot)} icon={CheckCircle2} tone="brass" foot="This month" />
      </div>

      <DataTable
        columns={columns}
        data={data}
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={(r) => navigate(`/inventory/transfers/${r.id}`)}
        rowActions={rowActions}
        exportName="stock-transfers"
        searchPlaceholder="Search transfer, warehouse, vehicle…"
        filters={
          <>
            <DateRange size="sm" value={range} onChange={setRange} />
            <FilterPanel
              filters={[
                { key: 'status', label: 'Statuses', options: ['In Transit', 'Received'], width: 140 },
                { key: 'from', label: 'Source warehouses', placeholder: 'Any source', options: warehouseOptions(state, true) },
                { key: 'to', label: 'Destination warehouses', placeholder: 'Any destination', options: warehouseOptions(state, true) },
              ]}
              values={filters}
              onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
              onReset={() => setFilters({})}
            />
          </>
        }
        emptyIcon={ArrowLeftRight}
        emptyTitle="No stock transfers"
        emptyDescription="Transfers between warehouses will appear here."
        emptyAction={can('Inventory', 'add') && <Button size="sm" variant="primary" icon={Plus} to="/inventory/transfers/new">New transfer</Button>}
      />
    </>
  )
}
