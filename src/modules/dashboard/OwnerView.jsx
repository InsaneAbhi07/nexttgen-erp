/** Owner dashboard — money, stock and production at a glance (live mock data). */
import { useMemo } from 'react'
import { AlertTriangle, Boxes, ClipboardList, Factory, HandCoins, IndianRupee, PackageX, Receipt, ShoppingCart, Wallet } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { itemStock, lowStockItems, outstandingRows, stockValue, totalPayables, totalReceivables } from '../../store/selectors.js'
import { Button, Card, StatCard } from '../../components/ui/index.js'
import FlowRail from '../../components/common/FlowRail.jsx'
import { inr, inrCompact, num } from '../../utils/format.js'
import { CHART } from '../../config/theme.js'
import {
  PENDING_PO, PENDING_SO, fyStart, monthlySalesPurchase, periodRange, productionDaily, recentTransactions, sumProduced, sumTotals, topProducts, trendPct,
} from './dashData.js'
import { ActivityFeed, Legend, LowStockList, MonthlySalesChart, ProductionTrendChart, PurchaseVsSalesChart, TopProductsList, TransactionsTable } from './widgets.jsx'

export default function OwnerView({ period }) {
  const { state } = useErp()

  const d = useMemo(() => {
    const r = periodRange(period)
    const month = periodRange('month')
    const sales = sumTotals(state.salesInvoices, r.from, r.to)
    const salesPrev = sumTotals(state.salesInvoices, r.prevFrom, r.prevTo)
    const purchase = sumTotals(state.purchaseInvoices, r.from, r.to)
    const purchasePrev = sumTotals(state.purchaseInvoices, r.prevFrom, r.prevTo)
    const produced = sumProduced(state.productionEntries, r.from, r.to)
    const producedPrev = sumProduced(state.productionEntries, r.prevFrom, r.prevTo)
    const receivableRows = outstandingRows(state, 'receivable')
    const overdueRows = receivableRows.filter((x) => x.status === 'Overdue')
    const pendingSO = state.salesOrders.filter((s) => PENDING_SO.includes(s.status))
    const pendingPO = state.purchaseOrders.filter((p) => PENDING_PO.includes(p.status))
    const openPO = pendingPO.filter((p) => p.status !== 'Draft')
    const low = lowStockItems(state)
    const monthly = monthlySalesPurchase(state, 12)
    return {
      r,
      sales, salesPrev, purchase, purchasePrev, produced, producedPrev,
      receivables: totalReceivables(state),
      receivableCount: receivableRows.length,
      payables: totalPayables(state),
      payableCount: outstandingRows(state, 'payable').length,
      stock: stockValue(state),
      itemsInStock: state.items.filter((i) => itemStock(state, i.id) > 0).length,
      pendingSO, pendingPO, openPO,
      openPOValue: openPO.reduce((a, p) => a + p.totals.grandTotal, 0),
      low,
      outOfStock: low.filter((x) => x.balance <= 0).length,
      overdue: Math.round(overdueRows.reduce((a, x) => a + x.balance, 0)),
      overdueCount: overdueRows.length,
      inProgress: state.productionOrders.filter((p) => p.status === 'In Progress').length,
      monthSales: sumTotals(state.salesInvoices, month.from, month.to),
      periodRejected: state.productionEntries.filter((e) => e.date >= r.from && e.date <= r.to).reduce((a, e) => a + (Number(e.rejectedQty) || 0), 0),
      monthly,
      pvs: monthly.slice(-6),
      production: productionDaily(state, 14),
      top: topProducts(state, fyStart(), 6),
      txns: recentTransactions(state, r.from, r.to, 8),
    }
  }, [state, period])

  const label = d.r.label
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

  return (
    <div className="dash-stack">
      <Card title="Operations line" subtitle="Live position from supplier gate to customer payment" className="dash-rail-card">
        <FlowRail
          steps={[
            { key: 'purchase', label: 'Purchase', value: `${d.openPO.length} open POs`, sub: `${inrCompact(d.openPOValue)} on order`, icon: ShoppingCart, to: '/purchase/orders' },
            { key: 'production', label: 'Production', value: `${num(d.produced)} units`, sub: `${cap(label)}, ${d.inProgress} orders running`, icon: Factory, to: '/production/orders' },
            { key: 'sales', label: 'Sales', value: inrCompact(d.monthSales), sub: `This month, ${d.pendingSO.length} orders to dispatch`, icon: Receipt, to: '/sales/invoices' },
            { key: 'accounts', label: 'Accounts', value: inrCompact(d.receivables), sub: `Receivable, ${inrCompact(d.overdue)} overdue`, icon: IndianRupee, to: '/accounts/outstanding' },
          ]}
        />
      </Card>

      <div className="grid-5">
        <StatCard label={`Sales ${label}`} value={inr(d.sales)} icon={Receipt} tone="blue" trend={trendPct(d.sales, d.salesPrev)} trendLabel={d.r.compare} to="/sales/invoices" />
        <StatCard label={`Purchase ${label}`} value={inr(d.purchase)} icon={ShoppingCart} tone="violet" trend={trendPct(d.purchase, d.purchasePrev)} trendLabel={d.r.compare} to="/purchase/invoices" />
        <StatCard label="Total receivables" value={inr(d.receivables)} icon={HandCoins} tone="teal" foot={`${d.receivableCount} open invoices`} to="/accounts/outstanding?tab=receivable" />
        <StatCard label="Total payables" value={inr(d.payables)} icon={Wallet} tone="amber" foot={`${d.payableCount} supplier bills`} to="/accounts/outstanding?tab=payable" />
        <StatCard label="Current stock value" value={inr(d.stock)} icon={Boxes} tone="brass" foot={`${d.itemsInStock} items in stock, at cost`} to="/inventory/stock" />
        <StatCard label={`Production ${label}`} value={`${num(d.produced)} units`} icon={Factory} tone="brass" trend={trendPct(d.produced, d.producedPrev)} trendLabel={d.r.compare} to="/production/entries" />
        <StatCard label="Pending sales orders" value={num(d.pendingSO.length)} icon={ClipboardList} tone="blue" foot={`${inr(d.pendingSO.reduce((a, s) => a + s.totals.grandTotal, 0))} to deliver`} to="/sales/orders" />
        <StatCard label="Pending purchase orders" value={num(d.pendingPO.length)} icon={ClipboardList} tone="violet" foot={`${inr(d.pendingPO.reduce((a, p) => a + p.totals.grandTotal, 0))} awaiting receipt`} to="/purchase/orders" />
        <StatCard label="Low stock items" value={num(d.low.length)} icon={PackageX} tone="red" foot={`${d.outOfStock} out of stock`} to="/reports/low-stock" />
        <StatCard label="Outstanding overdue" value={inr(d.overdue)} icon={AlertTriangle} tone="red" foot={`${d.overdueCount} invoices past due date`} to="/accounts/outstanding?tab=receivable" />
      </div>

      <div className="grid-3">
        <Card className="span-2" title="Monthly sales" subtitle="Invoice value including GST, last 12 months" actions={<Button size="sm" variant="ghost" to="/reports/monthly-sales">View report</Button>}>
          <MonthlySalesChart data={d.monthly} />
        </Card>
        <Card title="Top selling products" subtitle="This financial year by taxable value">
          <TopProductsList rows={d.top} />
        </Card>
      </div>

      <div className="grid-3">
        <Card title="Purchase vs sales" subtitle="Last 6 months" actions={<Legend items={[{ label: 'Sales', color: CHART.blue }, { label: 'Purchase', color: CHART.brass }]} />}>
          <PurchaseVsSalesChart data={d.pvs} />
        </Card>
        <Card title="Production trend" subtitle={`Units produced, last 14 days`} actions={<Legend items={[{ label: 'Good', color: CHART.blue }, { label: 'Rejected', color: CHART.orange }]} />}>
          <ProductionTrendChart data={d.production} />
        </Card>
        <Card title="Low stock" subtitle={`${d.low.length} items at or below minimum`} actions={<Button size="sm" variant="ghost" to="/inventory/stock">Stock overview</Button>}>
          <LowStockList rows={d.low} suppliers={state.suppliers} limit={5} />
        </Card>
      </div>

      <div className="grid-3">
        <Card
          className="span-2"
          flush
          title="Recent transactions"
          subtitle={d.txns.fallback ? `Nothing posted ${label}, showing the latest` : `Posted ${label}`}
          actions={<Button size="sm" variant="ghost" to="/accounts/cash-bank">Cash &amp; bank</Button>}
        >
          <TransactionsTable rows={d.txns.rows} />
        </Card>
        <Card title="Recent activities" subtitle="What your team did">
          <ActivityFeed activities={state.activities} limit={7} />
        </Card>
      </div>
    </div>
  )
}
