/** Purchase orders — list with overview strip (frontend-only demo). */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ClipboardList, Eye, IndianRupee, PackageCheck, Pencil, Plus, Printer, ShoppingCart, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, outstandingRows, poReceivedQty } from '../../store/selectors.js'
import { fmtDate, inr, inrCompact, num, today } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { STATUS } from '../../data/constants.js'
import { Button, DataTable, DocNo, FilterPanel, PageHeader, Progress, StatCard, StatusBadge, inDateRange, useConfirm, useToast } from '../../components/ui/index.js'
import { CRUMB, monthStart, supplierOptions, useListFilters } from './shared.jsx'

export default function PurchaseOrderList() {
  usePageTitle('Purchase orders')
  const { state, remove } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const f = useListFilters()
  const suppliers = byId(state.suppliers)

  const rows = useMemo(
    () =>
      state.purchaseOrders
        .filter((p) => inDateRange(p.date, f.values.range) && (!f.values.supplierId || p.supplierId === f.values.supplierId) && (!f.values.status || p.status === f.values.status))
        .map((p) => {
          const rec = poReceivedQty(state, p.id)
          const ordered = p.lines.reduce((a, l) => a + Number(l.qty), 0)
          const got = p.lines.reduce((a, l) => a + Math.min(rec[l.itemId] || 0, Number(l.qty)), 0)
          return { ...p, _supplier: suppliers.get(p.supplierId), _pct: ordered ? (got / ordered) * 100 : 0 }
        }),
    [state, f.values, suppliers],
  )

  const stats = useMemo(() => {
    const open = state.purchaseOrders.filter((p) => ['Submitted', 'Approved', 'Partially Received'].includes(p.status))
    const pendingReceipt = state.purchaseOrders.filter((p) => ['Approved', 'Partially Received'].includes(p.status))
    const ms = monthStart()
    const monthInv = state.purchaseInvoices.filter((i) => i.date >= ms)
    const overdue = outstandingRows(state, 'payable').filter((r) => r.status === 'Overdue')
    return {
      openValue: open.reduce((a, p) => a + p.totals.grandTotal, 0),
      openCount: open.length,
      pendingReceipt: pendingReceipt.length,
      late: pendingReceipt.filter((p) => p.expectedDate < today()).length,
      monthPurchase: monthInv.reduce((a, i) => a + i.totals.grandTotal, 0),
      monthCount: monthInv.length,
      overdueAmt: overdue.reduce((a, r) => a + r.balance, 0),
      overdueCount: overdue.length,
    }
  }, [state])

  const handleDelete = async (po) => {
    if (state.grns.some((g) => g.poId === po.id)) {
      toast.error('This purchase order can’t be deleted', 'Material has already been received against it. Cancel it instead.')
      return
    }
    const ok = await confirm({ title: 'Delete purchase order?', message: `${po.number} will be removed from the demo data. This can’t be undone.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('purchaseOrders', po.id)
      toast.success('Purchase order deleted', po.number)
    }
  }

  const columns = [
    { key: 'number', header: 'PO number', render: (r) => <DocNo to={`/purchase/orders/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'PO date', render: (r) => fmtDate(r.date) },
    {
      key: 'supplier',
      header: 'Supplier',
      accessor: (r) => r._supplier?.name,
      render: (r) => (
        <div>
          <div className="cell-primary">{r._supplier?.name}</div>
          <div className="cell-secondary">{r._supplier?.city}</div>
        </div>
      ),
    },
    {
      key: 'expectedDate',
      header: 'Expected delivery',
      render: (r) => (
        <span className={r.expectedDate < today() && ['Approved', 'Partially Received', 'Submitted'].includes(r.status) ? 'text-red' : ''}>{fmtDate(r.expectedDate)}</span>
      ),
    },
    { key: 'items', header: 'Items', align: 'right', accessor: (r) => r.lines.length },
    { key: 'amount', header: 'Amount', align: 'right', accessor: (r) => r.totals.grandTotal, render: (r) => <span className="num strong">{inr(r.totals.grandTotal)}</span> },
    {
      key: 'received',
      header: 'Received',
      accessor: (r) => Math.round(r._pct),
      render: (r) =>
        ['Draft', 'Cancelled'].includes(r.status) ? (
          <span className="muted">—</span>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <Progress value={r._pct} style={{ width: 70 }} />
            <span className="tiny muted num">{Math.round(r._pct)}%</span>
          </div>
        ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Purchase orders"
        subtitle="Orders raised to suppliers for raw material, packaging and traded goods."
        breadcrumbs={[CRUMB, { label: 'Purchase orders' }]}
        actions={
          can('Purchase', 'add') && (
            <Button variant="primary" icon={Plus} to="/purchase/orders/new">
              New purchase order
            </Button>
          )
        }
      />
      <div className="grid-4 mb-16">
        <StatCard label="Open PO value" value={inrCompact(stats.openValue)} icon={ShoppingCart} tone="blue" foot={`${stats.openCount} orders submitted or approved`} />
        <StatCard label="Pending receipts" value={num(stats.pendingReceipt)} icon={PackageCheck} tone="amber" foot={stats.late ? `${stats.late} past expected delivery` : 'All within delivery dates'} to="/purchase/grn/new" />
        <StatCard label="Purchase this month" value={inrCompact(stats.monthPurchase)} icon={IndianRupee} tone="teal" foot={`${stats.monthCount} supplier invoices`} to="/purchase/invoices" />
        <StatCard label="Overdue payables" value={inrCompact(stats.overdueAmt)} icon={AlertTriangle} tone="red" foot={`${stats.overdueCount} invoices past due date`} to="/accounts/outstanding?tab=payable" />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        exportName="purchase-orders"
        searchPlaceholder="Search PO number or supplier…"
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={(r) => navigate(`/purchase/orders/${r.id}`)}
        filters={
          <FilterPanel
            filters={[
              { key: 'range', type: 'daterange' },
              { key: 'supplierId', label: 'Suppliers', options: supplierOptions(state) },
              { key: 'status', label: 'Statuses', options: STATUS.purchaseOrder },
            ]}
            {...f}
          />
        }
        rowActions={(r) => [
          { label: 'View', icon: Eye, to: `/purchase/orders/${r.id}` },
          { label: 'Edit', icon: Pencil, to: `/purchase/orders/${r.id}/edit`, hidden: !can('Purchase', 'edit') || !['Draft', 'Submitted'].includes(r.status) },
          { label: 'Print', icon: Printer, to: `/purchase/orders/${r.id}?print=1` },
          { label: 'Receive material', icon: ClipboardList, to: `/purchase/grn/new?po=${r.id}`, hidden: !can('Purchase', 'add') || !['Approved', 'Partially Received'].includes(r.status) },
          { divider: true, hidden: !can('Purchase', 'delete') },
          { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(r), hidden: !can('Purchase', 'delete') },
        ]}
        emptyTitle="No purchase orders found"
        emptyDescription="Raise a purchase order to buy material from a supplier."
        emptyAction={can('Purchase', 'add') && <Button size="sm" variant="primary" icon={Plus} to="/purchase/orders/new">New purchase order</Button>}
      />
    </>
  )
}
