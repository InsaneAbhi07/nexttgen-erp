/** Admin dashboard — masters, users and system usage (live mock data). */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, Box, ClipboardList, PackageX, Truck, UserCheck, Users } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { lowStockItems } from '../../store/selectors.js'
import { Badge, Card, StatCard } from '../../components/ui/index.js'
import { CHART } from '../../config/theme.js'
import { fmtDate, num } from '../../utils/format.js'
import { PENDING_PO, PENDING_SO, monthlySalesPurchase, periodRange, transactionCount, trendPct } from './dashData.js'
import { ActivityFeed, MonthlySalesChart } from './widgets.jsx'

export default function AdminView({ period }) {
  const { state } = useErp()

  const d = useMemo(() => {
    const r = periodRange(period)
    const month = periodRange('month')
    const created = (list) => list.filter((x) => (x.createdAt || '').slice(0, 10) >= month.from).length
    const monthly = monthlySalesPurchase(state, 12)
    const latestMasters = [
      ...state.customers.map((x) => ({ ...x, kind: 'Customer', to: `/masters/customers?view=${x.id}` })),
      ...state.suppliers.map((x) => ({ ...x, kind: 'Supplier', to: `/masters/suppliers?view=${x.id}` })),
      ...state.items.map((x) => ({ ...x, kind: 'Item', to: `/masters/items?view=${x.id}` })),
    ]
      .sort((a, b) => ((a.createdAt || '') < (b.createdAt || '') ? 1 : -1))
      .slice(0, 5)
    return {
      r,
      customers: state.customers.filter((c) => c.status === 'Active').length,
      suppliers: state.suppliers.filter((s) => s.status === 'Active').length,
      items: state.items.filter((i) => i.status === 'Active').length,
      fg: state.items.filter((i) => i.type === 'Finished Good').length,
      rm: state.items.filter((i) => i.type === 'Raw Material').length,
      activeUsers: state.users.filter((u) => u.status === 'Active').length,
      inactiveUsers: state.users.filter((u) => u.status !== 'Active').length,
      pendingSO: state.salesOrders.filter((s) => PENDING_SO.includes(s.status)).length,
      pendingPO: state.purchaseOrders.filter((p) => PENDING_PO.includes(p.status)).length,
      low: lowStockItems(state).length,
      txn: transactionCount(state, r.from, r.to),
      txnPrev: transactionCount(state, r.prevFrom, r.prevTo),
      newCustomers: created(state.customers),
      newSuppliers: created(state.suppliers),
      newItems: created(state.items),
      latestMasters,
      monthly,
      roles: state.roles.map((role) => ({
        role,
        total: state.users.filter((u) => u.role === role.name).length,
        active: state.users.filter((u) => u.role === role.name && u.status === 'Active').length,
      })),
    }
  }, [state, period])

  return (
    <div className="dash-stack">
      <div className="grid-4">
        <StatCard label="Total customers" value={num(d.customers)} icon={Users} tone="blue" foot={`${d.newCustomers} added this month`} to="/masters/customers" />
        <StatCard label="Total suppliers" value={num(d.suppliers)} icon={Truck} tone="teal" foot={`${d.newSuppliers} added this month`} to="/masters/suppliers" />
        <StatCard label="Total items" value={num(d.items)} icon={Box} tone="brass" foot={`${d.fg} finished goods, ${d.rm} raw materials`} to="/masters/items" />
        <StatCard label="Active users" value={num(d.activeUsers)} icon={UserCheck} tone="green" foot={`${d.inactiveUsers} inactive`} to="/users" />
        <StatCard label="Pending orders" value={num(d.pendingSO + d.pendingPO)} icon={ClipboardList} tone="violet" foot={`${d.pendingSO} sales, ${d.pendingPO} purchase`} to="/sales/orders" />
        <StatCard label="Low stock items" value={num(d.low)} icon={PackageX} tone="red" foot="At or below minimum level" to="/reports/low-stock" />
        <StatCard label={`Transactions ${d.r.label}`} value={num(d.txn)} icon={ArrowLeftRight} tone="blue" trend={trendPct(d.txn, d.txnPrev)} trendLabel={d.r.compare} />
        <StatCard label="Masters added this month" value={num(d.newCustomers + d.newSuppliers + d.newItems)} icon={Box} tone="gray" foot="Customers, suppliers and items" />
      </div>

      <div className="grid-2">
        <Card title="Sales overview" subtitle="Invoice value, last 12 months">
          <MonthlySalesChart data={d.monthly} small />
        </Card>
        <Card title="Purchase overview" subtitle="Supplier bills, last 12 months">
          <MonthlySalesChart data={d.monthly} dataKey="purchase" name="Purchase" color={CHART.brass} small />
        </Card>
      </div>

      <div className="grid-3">
        <Card title="Users by role" subtitle={`${state.users.length} users across ${state.roles.length} roles`} flush actions={<Link to="/users/roles" className="small">Permissions</Link>}>
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Role</th>
                  <th className="align-right">Users</th>
                  <th className="align-right">Active</th>
                </tr>
              </thead>
              <tbody>
                {d.roles.map((r) => (
                  <tr key={r.role.id}>
                    <td className="cell-primary">{r.role.name}</td>
                    <td className="align-right num">{r.total}</td>
                    <td className="align-right num">{r.active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Latest master records" subtitle="Most recently added customers, suppliers and items" flush>
          {d.latestMasters.map((m) => (
            <div key={`${m.kind}-${m.id}`} className="dash-list-row">
              <div className="grow" style={{ minWidth: 0 }}>
                <Link to={m.to} className="cell-primary truncate" style={{ color: 'var(--ink)', display: 'block' }}>{m.name}</Link>
                <div className="cell-secondary">{m.code}, added {fmtDate((m.createdAt || '').slice(0, 10))}</div>
              </div>
              <Badge tone={m.kind === 'Customer' ? 'blue' : m.kind === 'Supplier' ? 'teal' : 'brass'}>{m.kind}</Badge>
            </div>
          ))}
        </Card>
        <Card title="Recent activities" subtitle="Across all modules">
          <ActivityFeed activities={state.activities} limit={6} />
        </Card>
      </div>
    </div>
  )
}
