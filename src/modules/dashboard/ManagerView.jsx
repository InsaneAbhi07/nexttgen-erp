/** Manager dashboard — approvals, dispatch, production and stock alerts (live mock data). */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Factory, PackageX, Receipt, ShoppingCart } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, lowStockItems, productionProgress } from '../../store/selectors.js'
import { Badge, Button, Card, DocNo, EmptyState, Progress, StatCard, StatusBadge, useToast } from '../../components/ui/index.js'
import { CHART } from '../../config/theme.js'
import { fmtDate, inr, num, today } from '../../utils/format.js'
import { PENDING_PO, PENDING_SO, PRODUCTION_PENDING, periodRange, sumTotals, trendPct } from './dashData.js'
import { ActivityFeed, LowStockList, StatusDonut } from './widgets.jsx'

const PRD_COLORS = { Planned: CHART.violet, Released: CHART.teal, 'In Progress': CHART.blue, Completed: CHART.brass, Cancelled: CHART.gray }

export default function ManagerView({ period }) {
  const { state, patch } = useErp()
  const { user, can } = useAuth()
  const toast = useToast()
  const t = today()

  const d = useMemo(() => {
    const r = periodRange(period)
    const customers = byId(state.customers)
    const suppliers = byId(state.suppliers)
    const items = byId(state.items)
    const byNewest = (a, b) => (a.date === b.date ? ((a.createdAt || '') < (b.createdAt || '') ? 1 : -1) : a.date < b.date ? 1 : -1)
    const pendingPO = state.purchaseOrders.filter((p) => PENDING_PO.includes(p.status)).sort(byNewest)
    const pendingSO = state.salesOrders.filter((s) => PENDING_SO.includes(s.status)).sort((a, b) => (a.deliveryDate < b.deliveryDate ? -1 : 1))
    const prodPending = state.productionOrders
      .filter((p) => PRODUCTION_PENDING.includes(p.status))
      .sort(byNewest)
      .map((o) => ({ order: o, product: items.get(o.productId), progress: productionProgress(state, o.id) }))
    const recentPrd = state.productionOrders.filter((p) => !p.historical)
    const statusCounts = Object.keys(PRD_COLORS)
      .map((s) => ({ name: s, value: recentPrd.filter((p) => p.status === s).length, color: PRD_COLORS[s] }))
      .filter((x) => x.value > 0)
    const recentOrders = [
      ...state.salesOrders.map((s) => ({ ...s, kind: 'Sales order', party: customers.get(s.customerId)?.name, to: `/sales/orders/${s.id}` })),
      ...state.purchaseOrders.map((p) => ({ ...p, kind: 'Purchase order', party: suppliers.get(p.supplierId)?.name, to: `/purchase/orders/${p.id}` })),
    ]
      .sort(byNewest)
      .slice(0, 7)
    return {
      r,
      sales: sumTotals(state.salesInvoices, r.from, r.to),
      salesPrev: sumTotals(state.salesInvoices, r.prevFrom, r.prevTo),
      purchase: sumTotals(state.purchaseInvoices, r.from, r.to),
      purchasePrev: sumTotals(state.purchaseInvoices, r.prevFrom, r.prevTo),
      pendingPO, pendingSO, prodPending, statusCounts, recentOrders, customers, suppliers,
      low: lowStockItems(state),
      team: state.activities.filter((a) => a.user !== user?.name && ['Purchase', 'Sales', 'Inventory', 'Production'].includes(a.module)),
    }
  }, [state, period, user])

  const approve = (po) => {
    patch('purchaseOrders', po.id, { status: 'Approved', approvedBy: user?.name, approvedAt: new Date().toISOString() }, { action: 'approved' })
    toast.success('Purchase order approved', `${po.number} can now be received at the gate.`)
  }

  return (
    <div className="dash-stack">
      <div className="grid-3">
        <StatCard label={`Sales ${d.r.label}`} value={inr(d.sales)} icon={Receipt} tone="blue" trend={trendPct(d.sales, d.salesPrev)} trendLabel={d.r.compare} to="/sales/invoices" />
        <StatCard label={`Purchase ${d.r.label}`} value={inr(d.purchase)} icon={ShoppingCart} tone="violet" trend={trendPct(d.purchase, d.purchasePrev)} trendLabel={d.r.compare} to="/purchase/invoices" />
        <StatCard label="Pending purchase orders" value={num(d.pendingPO.length)} icon={ClipboardList} tone="violet" foot={`${d.pendingPO.filter((p) => ['Draft', 'Submitted'].includes(p.status)).length} need approval`} to="/purchase/orders" />
        <StatCard label="Pending sales orders" value={num(d.pendingSO.length)} icon={ClipboardList} tone="blue" foot={`${d.pendingSO.filter((s) => s.deliveryDate < t).length} past delivery date`} to="/sales/orders" />
        <StatCard label="Production pending" value={num(d.prodPending.length)} icon={Factory} tone="brass" foot={`${d.prodPending.filter((p) => p.order.status === 'In Progress').length} in progress`} to="/production/orders" />
        <StatCard label="Stock alerts" value={num(d.low.length)} icon={PackageX} tone="red" foot={`${d.low.filter((x) => x.balance <= 0).length} out of stock`} to="/reports/low-stock" />
      </div>

      <div className="grid-2">
        <Card title="Purchase orders awaiting action" subtitle="Approve drafts and track receipts" flush actions={<Button size="sm" variant="ghost" to="/purchase/orders">All orders</Button>}>
          {d.pendingPO.length === 0 ? (
            <EmptyState compact icon={CheckCircle2} title="No pending purchase orders" />
          ) : (
            <div className="table-wrap">
              <table className="table compact">
                <thead>
                  <tr>
                    <th>PO</th>
                    <th>Supplier</th>
                    <th className="align-right">Amount</th>
                    <th>Status</th>
                    <th className="col-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {d.pendingPO.slice(0, 6).map((po) => (
                    <tr key={po.id}>
                      <td><DocNo to={`/purchase/orders/${po.id}`}>{po.number}</DocNo><div className="cell-secondary">{fmtDate(po.date)}</div></td>
                      <td className="truncate" style={{ maxWidth: 180 }}>{d.suppliers.get(po.supplierId)?.name}</td>
                      <td className="align-right num nowrap">{inr(po.totals.grandTotal)}</td>
                      <td><StatusBadge status={po.status} /></td>
                      <td className="col-actions">
                        {['Draft', 'Submitted'].includes(po.status) && can('Purchase', 'approve') ? (
                          <Button size="sm" variant="soft" onClick={() => approve(po)}>Approve</Button>
                        ) : (
                          <Button size="sm" variant="ghost" to={`/purchase/grn/new?po=${po.id}`}>Receive</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Sales orders to dispatch" subtitle="Sorted by delivery date" flush actions={<Button size="sm" variant="ghost" to="/sales/orders">All orders</Button>}>
          {d.pendingSO.length === 0 ? (
            <EmptyState compact icon={CheckCircle2} title="Every order has been dispatched" />
          ) : (
            <div className="table-wrap">
              <table className="table compact">
                <thead>
                  <tr>
                    <th>SO</th>
                    <th>Customer</th>
                    <th>Delivery</th>
                    <th>Status</th>
                    <th className="col-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {d.pendingSO.slice(0, 6).map((so) => (
                    <tr key={so.id}>
                      <td><DocNo to={`/sales/orders/${so.id}`}>{so.number}</DocNo><div className="cell-secondary">{inr(so.totals.grandTotal)}</div></td>
                      <td className="truncate" style={{ maxWidth: 170 }}>{d.customers.get(so.customerId)?.name}</td>
                      <td className={`nowrap ${so.deliveryDate < t ? 'text-red' : ''}`}>{fmtDate(so.deliveryDate)}</td>
                      <td><StatusBadge status={so.status} /></td>
                      <td className="col-actions">
                        <Button size="sm" variant="ghost" to={`/sales/challans/new?so=${so.id}`}>Dispatch</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid-3">
        <Card className="span-2" title="Production pending" subtitle="Planned, released and running orders" flush actions={<Button size="sm" variant="ghost" to="/production/orders">All production orders</Button>}>
          {d.prodPending.length === 0 ? (
            <EmptyState compact title="No production pending" />
          ) : (
            d.prodPending.slice(0, 6).map(({ order, product, progress }) => {
              const pct = (progress.produced / Number(order.plannedQty || 1)) * 100
              return (
                <div key={order.id} className="dash-list-row">
                  <div style={{ width: 150, flexShrink: 0 }}>
                    <DocNo to={`/production/orders/${order.id}`}>{order.number}</DocNo>
                    <div className="cell-secondary">Due {fmtDate(order.expectedDate)}</div>
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row-between">
                      <span className="cell-primary truncate">{product?.name}</span>
                      <span className="small muted nowrap">{num(progress.produced)} / {num(order.plannedQty)} {product?.unit}</span>
                    </div>
                    <Progress value={pct} tone={pct >= 100 ? 'green' : 'brass'} style={{ marginTop: 6 }} />
                  </div>
                  <div className="row desktop-only" style={{ gap: 6, width: 190, justifyContent: 'flex-end' }}>
                    <Badge tone={order.priority === 'Urgent' ? 'red' : order.priority === 'High' ? 'amber' : 'gray'}>{order.priority}</Badge>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              )
            })
          )}
        </Card>
        <Card title="Production status" subtitle="Orders in the last 45 days">
          <StatusDonut data={d.statusCounts} centerLabel="Orders" />
        </Card>
      </div>

      <div className="grid-3">
        <Card title="Stock alerts" subtitle="Items at or below minimum" actions={<Link to="/inventory/stock" className="small">Stock overview</Link>}>
          <LowStockList rows={d.low} suppliers={state.suppliers} limit={6} />
        </Card>
        <Card title="Recent orders" subtitle="Latest sales and purchase orders" flush>
          {d.recentOrders.map((o) => (
            <div key={`${o.kind}-${o.id}`} className="dash-list-row">
              <div className="grow" style={{ minWidth: 0 }}>
                <DocNo to={o.to}>{o.number}</DocNo>
                <div className="cell-secondary truncate">{o.party}, {fmtDate(o.date)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="small strong num">{inr(o.totals.grandTotal)}</div>
                <Badge tone={o.kind === 'Sales order' ? 'blue' : 'violet'}>{o.kind}</Badge>
              </div>
            </div>
          ))}
        </Card>
        <Card title="Team activities" subtitle="Purchase, sales, stores and production">
          <ActivityFeed activities={d.team} limit={7} />
        </Card>
      </div>
    </div>
  )
}
