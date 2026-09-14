/**
 * Dashboard data helpers — every figure is derived from the live mock store,
 * so records created during the demo immediately change the dashboards.
 */
import { addDays, fmtDate, monthLabel, today } from '../../utils/format.js'
import { calcLine } from '../../utils/calc.js'
import { byId } from '../../store/selectors.js'

const pad = (n) => String(n).padStart(2, '0')

export const PENDING_SO = ['Pending', 'Confirmed', 'Partially Delivered']
export const PENDING_PO = ['Draft', 'Submitted', 'Approved', 'Partially Received']
export const PRODUCTION_PENDING = ['Planned', 'Released', 'In Progress']

export const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]

/** Current period and the comparable previous period. */
export function periodRange(period) {
  const t = today()
  const d = new Date(`${t}T00:00:00`)
  if (period === 'week') {
    const offset = (d.getDay() + 6) % 7
    const from = addDays(t, -offset)
    return { from, to: t, prevFrom: addDays(from, -7), prevTo: addDays(t, -7), label: 'this week', compare: 'vs last week' }
  }
  if (period === 'month') {
    const from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
    const pm = new Date(d.getFullYear(), d.getMonth() - 1, 1)
    const lastPrev = new Date(d.getFullYear(), d.getMonth(), 0).getDate()
    return {
      from,
      to: t,
      prevFrom: `${pm.getFullYear()}-${pad(pm.getMonth() + 1)}-01`,
      prevTo: `${pm.getFullYear()}-${pad(pm.getMonth() + 1)}-${pad(Math.min(d.getDate(), lastPrev))}`,
      label: 'this month',
      compare: 'vs last month',
    }
  }
  return { from: t, to: t, prevFrom: addDays(t, -1), prevTo: addDays(t, -1), label: 'today', compare: 'vs yesterday' }
}

export const inRange = (date, from, to) => Boolean(date) && date >= from && date <= to

export const sumTotals = (list, from, to) =>
  Math.round(list.reduce((a, x) => (inRange(x.date, from, to) ? a + (Number(x.totals?.grandTotal) || 0) : a), 0))

export const sumProduced = (entries, from, to) =>
  entries.reduce((a, e) => (inRange(e.date, from, to) ? a + (Number(e.producedQty) || 0) : a), 0)

export const trendPct = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : undefined)

export function fyStart() {
  const d = new Date(`${today()}T00:00:00`)
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}-04-01`
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Sales & purchase invoice value per month for the last n months. */
export function monthlySalesPurchase(state, n = 12) {
  const base = new Date(`${today()}T00:00:00`)
  const rows = []
  const map = {}
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(base.getFullYear(), base.getMonth() - i, 1)
    const key = `${m.getFullYear()}-${pad(m.getMonth() + 1)}`
    const row = { key, label: monthLabel(m), sales: 0, purchase: 0 }
    map[key] = row
    rows.push(row)
  }
  state.salesInvoices.forEach((i) => {
    const r = map[i.date.slice(0, 7)]
    if (r) r.sales += Number(i.totals.grandTotal) || 0
  })
  state.purchaseInvoices.forEach((i) => {
    const r = map[i.date.slice(0, 7)]
    if (r) r.purchase += Number(i.totals.grandTotal) || 0
  })
  return rows.map((r) => ({ ...r, sales: Math.round(r.sales), purchase: Math.round(r.purchase) }))
}

/** Units produced per day for the last n days. */
export function productionDaily(state, days = 14) {
  const t = today()
  const rows = []
  const map = {}
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(t, -i)
    const row = { date, label: fmtDate(date).slice(0, 6), good: 0, rejected: 0 }
    map[date] = row
    rows.push(row)
  }
  state.productionEntries.forEach((e) => {
    const r = map[e.date]
    if (!r) return
    r.rejected += Number(e.rejectedQty) || 0
    r.good += (Number(e.producedQty) || 0) - (Number(e.rejectedQty) || 0)
  })
  return rows
}

/** Top selling products by taxable value since `from`. */
export function topProducts(state, from, limit = 6) {
  const items = byId(state.items)
  const map = {}
  state.salesInvoices.forEach((inv) => {
    if (inv.date < from) return
    inv.lines.forEach((l) => {
      const c = calcLine(l)
      if (!map[l.itemId]) map[l.itemId] = { itemId: l.itemId, value: 0, qty: 0 }
      map[l.itemId].value += c.taxable
      map[l.itemId].qty += Number(l.qty) || 0
    })
  })
  return Object.values(map)
    .map((r) => ({ ...r, value: Math.round(r.value), item: items.get(r.itemId) }))
    .filter((r) => r.item)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

/** Latest money transactions (sales/purchase invoices, receipts, payments). */
export function recentTransactions(state, from, to, limit = 8) {
  const customers = byId(state.customers)
  const suppliers = byId(state.suppliers)
  const all = [
    ...state.salesInvoices.map((i) => ({ id: i.id, date: i.date, at: i.createdAt, type: 'Sales invoice', tone: 'blue', number: i.number, party: customers.get(i.customerId)?.name, amount: i.totals.grandTotal, to: `/sales/invoices/${i.id}` })),
    ...state.purchaseInvoices.map((i) => ({ id: i.id, date: i.date, at: i.createdAt, type: 'Purchase invoice', tone: 'violet', number: i.number, party: suppliers.get(i.supplierId)?.name, amount: i.totals.grandTotal, to: `/purchase/invoices/${i.id}` })),
    ...state.receipts.map((r) => ({ id: r.id, date: r.date, at: r.createdAt, type: 'Receipt', tone: 'green', number: r.number, party: customers.get(r.customerId)?.name, amount: r.amount, to: `/accounts/receipts?view=${r.id}` })),
    ...state.payments.map((p) => ({ id: p.id, date: p.date, at: p.createdAt, type: 'Payment', tone: 'amber', number: p.number, party: suppliers.get(p.supplierId)?.name, amount: p.amount, to: `/accounts/payments?view=${p.id}` })),
  ].sort((a, b) => (a.date === b.date ? ((a.at || '') < (b.at || '') ? 1 : -1) : a.date < b.date ? 1 : -1))
  const inPeriod = all.filter((x) => inRange(x.date, from, to))
  return { rows: (inPeriod.length ? inPeriod : all).slice(0, limit), fallback: inPeriod.length === 0 }
}

/** Count of documents dated within the range across transactional collections. */
export function transactionCount(state, from, to) {
  const lists = ['salesInvoices', 'purchaseInvoices', 'receipts', 'payments', 'salesOrders', 'purchaseOrders', 'grns', 'deliveryChallans', 'productionEntries', 'materialIssues', 'stockIns', 'stockOuts', 'stockTransfers', 'quotations']
  return lists.reduce((a, k) => a + (state[k] || []).filter((d) => inRange(d.date, from, to)).length, 0)
}
