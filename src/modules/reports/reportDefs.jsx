/**
 * Report definitions — NexttGen ERP Reports Center (frontend-only demo).
 * Every report is computed in the browser from the mock store. No API calls.
 *
 * def: { id, group, title, description, filters, defaultRange, defaultFilters, options, itemFilter, note,
 *        build(state, filterValues) → { rows, columns, summary, chart?, totals?, tableTitle?, sections?, emptyMessage? } }
 * column: { key, header, format?: 'date'|'inr'|'inr2'|'num'|'pct', align?, render?, accessor?, sortable? }
 */
import { Link } from 'react-router-dom'
import { BarChart3, Boxes, Factory, Landmark, Percent, ShoppingCart } from 'lucide-react'
import {
  byId,
  customerLedger,
  lowStockItems,
  outstandingRows,
  productionCosting,
  purchaseInvoiceStatus,
  salesInvoiceStatus,
  stockLedger,
  stockSummary,
  supplierLedger,
} from '../../store/selectors.js'
import { calcLine, round2 } from '../../utils/calc.js'
import { addDays, daysBetween, fmtDate, inr, monthLabel, num, today } from '../../utils/format.js'
import { DocNo, StatusBadge } from '../../components/ui/index.js'
import { PAYMENT_MODES, PRODUCT_TYPES, SALES_PERSONS, WASTAGE_TYPES } from '../../data/constants.js'

/* ------------------------------------------------------------------ */
/* Groups                                                              */
/* ------------------------------------------------------------------ */
export const REPORT_GROUPS = [
  { key: 'sales', label: 'Sales reports', icon: BarChart3, tone: 'tone-blue', description: 'Invoices, customers, products and sales team performance' },
  { key: 'purchase', label: 'Purchase reports', icon: ShoppingCart, tone: 'tone-violet', description: 'Supplier bills, purchase register and material buying' },
  { key: 'inventory', label: 'Inventory reports', icon: Boxes, tone: 'tone-teal', description: 'Stock balances, valuation, ledger and movement' },
  { key: 'production', label: 'Production reports', icon: Factory, tone: 'tone-brass', description: 'Output, consumption, wastage, rejection and costing' },
  { key: 'accounts', label: 'Accounts reports', icon: Landmark, tone: 'tone-green', description: 'Ledgers, receivables, payables and payments' },
  { key: 'gst', label: 'GST reports', icon: Percent, tone: 'tone-red', description: 'Output tax, input tax and net GST position' },
]

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const inR = (d, r) => (!r?.from || d >= r.from) && (!r?.to || d <= r.to)
const share = (v, total) => (total ? round2((v / total) * 100) : 0)
const sumK = (rows, k) => round2(rows.reduce((a, r) => a + (Number(r[k]) || 0), 0))
const sumT = (docs, k) => round2(docs.reduce((a, d) => a + (Number(d.totals?.[k]) || 0), 0))
const totalsOf = (rows, keys) => Object.fromEntries(keys.map((k) => [k, sumK(rows, k)]))
const groupBy = (list, keyFn) => {
  const m = new Map()
  list.forEach((x) => {
    const k = keyFn(x)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(x)
  })
  return m
}
const short = (s = '', n = 24) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const pctStr = (v) => `${(Number(v) || 0).toFixed(1)}%`

const col = {
  date: (key = 'date', header = 'Date', extra) => ({ key, header, format: 'date', ...extra }),
  text: (key, header, extra) => ({ key, header, ...extra }),
  inr: (key, header, extra) => ({ key, header, format: 'inr', align: 'right', ...extra }),
  inr2: (key, header, extra) => ({ key, header, format: 'inr2', align: 'right', ...extra }),
  num: (key, header, extra) => ({ key, header, format: 'num', align: 'right', ...extra }),
  pct: (key, header, extra) => ({ key, header, format: 'pct', align: 'right', ...extra }),
}

const linkTo = (to, label) => (
  <Link to={to} onClick={(e) => e.stopPropagation()}>
    {label}
  </Link>
)

/** Bucketed time series — daily when the range is ≤ 62 days, otherwise monthly. */
function timeSeries(docs, range, series, forceMonthly = false) {
  const dates = docs.map((d) => d.date).sort()
  const from = range?.from || dates[0] || today()
  const to = range?.to || today()
  const daily = !forceMonthly && daysBetween(from, to) <= 62
  const buckets = []
  const index = {}
  if (daily) {
    for (let d = from, guard = 0; d <= to && guard < 70; d = addDays(d, 1), guard++) {
      index[d] = buckets.length
      buckets.push({ key: d, label: fmtDate(d).slice(0, 6) })
    }
  } else {
    let [y, m] = from.split('-').map(Number)
    const [ty, tm] = to.split('-').map(Number)
    for (let guard = 0; (y < ty || (y === ty && m <= tm)) && guard < 60; guard++) {
      const k = `${y}-${String(m).padStart(2, '0')}`
      index[k] = buckets.length
      buckets.push({ key: k, label: monthLabel(`${k}-01`) })
      m += 1
      if (m > 12) {
        m = 1
        y += 1
      }
    }
  }
  buckets.forEach((b) => series.forEach((s) => (b[s.key] = 0)))
  docs.forEach((d) => {
    const i = index[daily ? d.date : d.date.slice(0, 7)]
    if (i === undefined) return
    series.forEach((s) => {
      if (!s.filter || s.filter(d)) buckets[i][s.key] += Number(s.value(d)) || 0
    })
  })
  buckets.forEach((b) => series.forEach((s) => (b[s.key] = round2(b[s.key]))))
  return { data: buckets, daily }
}

const salesDocs = (s, f) =>
  s.salesInvoices.filter((i) => inR(i.date, f.range) && (!f.customer || i.customerId === f.customer) && (!f.salesPerson || i.salesPerson === f.salesPerson))
const purchaseDocs = (s, f) => s.purchaseInvoices.filter((i) => inR(i.date, f.range) && (!f.supplier || i.supplierId === f.supplier))

const invLink = (r) => <DocNo to={`/sales/invoices/${r.id}`}>{r.number}</DocNo>
const pinvLink = (r) => <DocNo to={`/purchase/invoices/${r.id}`}>{r.number}</DocNo>

/** Party-wise aggregation used by customer/supplier reports. */
function partyRows(docs, partyKey, parties, statusFn, state) {
  const total = sumT(docs, 'grandTotal')
  return [...groupBy(docs, (d) => d[partyKey])].map(([id, list]) => {
    const p = parties.get(id)
    const outstanding = list.reduce((a, d) => a + statusFn(state, d).balance, 0)
    const value = sumT(list, 'grandTotal')
    return {
      id, party: p?.name || '—', city: p?.city, state: p?.state, invoices: list.length,
      taxable: sumT(list, 'taxable'), gst: sumT(list, 'gst'), total: value,
      outstanding: round2(outstanding), paid: round2(value - outstanding), share: share(value, total),
    }
  }).sort((a, b) => b.total - a.total)
}

/** Item-wise aggregation of document lines. */
function itemLineRows(docs, items, f) {
  const map = new Map()
  docs.forEach((d) =>
    d.lines.forEach((l) => {
      const it = items.get(l.itemId)
      if (!it) return
      if (f.category && it.category !== f.category) return
      const c = calcLine(l)
      const r = map.get(l.itemId) || { id: l.itemId, code: it.code, name: it.name, category: it.category, unit: it.unit, qty: 0, taxable: 0, gst: 0, total: 0, docs: new Set() }
      r.qty += Number(l.qty) || 0
      r.taxable += c.taxable
      r.gst += c.gstAmt
      r.total += c.total
      r.docs.add(d.id)
      map.set(l.itemId, r)
    }),
  )
  const rows = [...map.values()].map((r) => ({ ...r, docs: r.docs.size, qty: round2(r.qty), taxable: round2(r.taxable), gst: round2(r.gst), total: round2(r.total), avgRate: r.qty ? round2(r.taxable / r.qty) : 0 }))
  const t = sumK(rows, 'taxable')
  rows.forEach((r) => (r.share = share(r.taxable, t)))
  return rows.sort((a, b) => b.taxable - a.taxable)
}

const itemLink = (r, idKey = 'id') => linkTo(`/masters/items?view=${r[idKey]}`, r.name)

/* ------------------------------------------------------------------ */
/* Definitions                                                         */
/* ------------------------------------------------------------------ */
const PAY_STATUS = ['Paid', 'Partially Paid', 'Unpaid', 'Overdue']
const AGEING = ['Not due', '1–30 days', '31–60 days', '61–90 days', 'Over 90 days']
const ageBucket = (r) => (r.daysOverdue <= 0 ? AGEING[0] : r.daysOverdue <= 30 ? AGEING[1] : r.daysOverdue <= 60 ? AGEING[2] : r.daysOverdue <= 90 ? AGEING[3] : AGEING[4])

export const REPORTS = [
  /* ================= SALES ================= */
  {
    id: 'sales-summary', group: 'sales', title: 'Sales summary', description: 'Total sales, GST and collections with the trend and top customers',
    filters: ['range', 'customer', 'salesPerson'], defaultRange: 'fy',
    build: (s, f) => {
      const docs = salesDocs(s, f)
      const total = sumT(docs, 'grandTotal')
      const collected = docs.reduce((a, d) => a + salesInvoiceStatus(s, d).paid, 0)
      const rows = partyRows(docs, 'customerId', byId(s.customers), salesInvoiceStatus, s)
      const ts = timeSeries(docs, f.range, [{ key: 'sales', value: (d) => d.totals.grandTotal }])
      return {
        summary: [
          { label: 'Total sales', value: inr(total), foot: 'Including GST' },
          { label: 'Invoices', value: num(docs.length), foot: `Average ${inr(docs.length ? total / docs.length : 0)}` },
          { label: 'GST collected', value: inr(sumT(docs, 'gst')) },
          { label: 'Collected', value: inr(collected), foot: `${pctStr(share(collected, total))} of billed value` },
        ],
        chart: { type: 'bar', title: ts.daily ? 'Daily sales' : 'Monthly sales', data: ts.data, xKey: 'label', series: [{ key: 'sales', name: 'Sales incl. GST' }], valueFormat: 'inr' },
        tableTitle: 'Sales by customer',
        columns: [
          col.text('party', 'Customer', { render: (r) => linkTo(`/masters/customers?view=${r.id}`, r.party) }),
          col.text('city', 'City'), col.num('invoices', 'Invoices'), col.inr('taxable', 'Taxable value'), col.inr('gst', 'GST'),
          col.inr('total', 'Total sales'), col.inr('outstanding', 'Outstanding'), col.pct('share', 'Share'),
        ],
        rows,
        totals: { ...totalsOf(rows, ['invoices', 'taxable', 'gst', 'total', 'outstanding']), share: rows.length ? 100 : 0 },
      }
    },
  },
  {
    id: 'sales-register', group: 'sales', title: 'Sales register', description: 'Invoice-wise register with tax split and payment status',
    filters: ['range', 'customer', 'salesPerson', 'status'], options: { status: PAY_STATUS }, labels: { status: 'Payment status' }, defaultRange: 'month',
    build: (s, f) => {
      const cus = byId(s.customers)
      const rows = salesDocs(s, f)
        .map((d) => {
          const st = salesInvoiceStatus(s, d)
          const c = cus.get(d.customerId)
          return { id: d.id, date: d.date, number: d.number, customer: c?.name, gstin: c?.gstin, taxable: d.totals.taxable, cgst: d.totals.cgst, sgst: d.totals.sgst, igst: d.totals.igst, total: d.totals.grandTotal, balance: st.balance, status: st.status }
        })
        .filter((r) => !f.status || r.status === f.status)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      const total = sumK(rows, 'total')
      return {
        summary: [
          { label: 'Invoices', value: num(rows.length) },
          { label: 'Taxable value', value: inr(sumK(rows, 'taxable')) },
          { label: 'Total GST', value: inr(sumK(rows, 'cgst') + sumK(rows, 'sgst') + sumK(rows, 'igst')) },
          { label: 'Invoice value', value: inr(total), foot: `${inr(sumK(rows, 'balance'))} outstanding` },
        ],
        columns: [
          col.date(), col.text('number', 'Invoice', { render: invLink }), col.text('customer', 'Customer'), col.text('gstin', 'GSTIN', { render: (r) => <span className="mono small">{r.gstin}</span> }),
          col.inr2('taxable', 'Taxable'), col.inr2('cgst', 'CGST'), col.inr2('sgst', 'SGST'), col.inr2('igst', 'IGST'), col.inr2('total', 'Total'),
          col.text('status', 'Payment', { render: (r) => <StatusBadge status={r.status} /> }),
        ],
        rows,
        totals: totalsOf(rows, ['taxable', 'cgst', 'sgst', 'igst', 'total']),
      }
    },
  },
  {
    id: 'customer-sales', group: 'sales', title: 'Customer-wise sales', description: 'Billing, collections and share of sales for each customer',
    filters: ['range', 'salesPerson'], defaultRange: 'fy',
    build: (s, f) => {
      const docs = salesDocs(s, f)
      const rows = partyRows(docs, 'customerId', byId(s.customers), salesInvoiceStatus, s)
      return {
        summary: [
          { label: 'Customers billed', value: num(rows.length) },
          { label: 'Total sales', value: inr(sumK(rows, 'total')) },
          { label: 'Top customer', value: rows[0]?.party || '—', foot: rows[0] ? `${pctStr(rows[0].share)} of sales` : '' },
          { label: 'Outstanding', value: inr(sumK(rows, 'outstanding')) },
        ],
        chart: { type: 'hbar', title: 'Top customers by sales', data: rows.slice(0, 8).map((r) => ({ label: short(r.party), total: r.total })), xKey: 'label', series: [{ key: 'total', name: 'Sales incl. GST' }], valueFormat: 'inr' },
        columns: [
          col.text('party', 'Customer', { render: (r) => linkTo(`/accounts/customer-ledger?customer=${r.id}`, r.party) }), col.text('city', 'City'), col.text('state', 'State'),
          col.num('invoices', 'Invoices'), col.inr('taxable', 'Taxable'), col.inr('total', 'Sales'), col.inr('paid', 'Received'), col.inr('outstanding', 'Outstanding'), col.pct('share', 'Share'),
        ],
        rows,
        totals: { ...totalsOf(rows, ['invoices', 'taxable', 'total', 'paid', 'outstanding']), share: rows.length ? 100 : 0 },
      }
    },
  },
  {
    id: 'product-sales', group: 'sales', title: 'Product-wise sales', description: 'Quantity sold, value and average realised rate per item',
    filters: ['range', 'customer', 'category'], defaultRange: 'fy',
    build: (s, f) => {
      const rows = itemLineRows(salesDocs(s, f), byId(s.items), f)
      return {
        summary: [
          { label: 'Products sold', value: num(rows.length) },
          { label: 'Taxable value', value: inr(sumK(rows, 'taxable')) },
          { label: 'Best seller', value: rows[0]?.name || '—', foot: rows[0] ? `${pctStr(rows[0].share)} of sales value` : '' },
          { label: 'Invoice lines', value: num(rows.reduce((a, r) => a + r.docs, 0)) },
        ],
        chart: { type: 'hbar', title: 'Top products by taxable value', data: rows.slice(0, 8).map((r) => ({ label: short(r.name), taxable: r.taxable })), xKey: 'label', series: [{ key: 'taxable', name: 'Taxable value' }], valueFormat: 'inr' },
        columns: [
          col.text('code', 'Code', { render: (r) => <span className="doc-no">{r.code}</span> }), col.text('name', 'Item', { render: (r) => itemLink(r) }), col.text('category', 'Category'),
          col.num('qty', 'Qty sold', { render: (r) => `${num(r.qty)} ${r.unit}` }), col.inr2('avgRate', 'Avg. rate'), col.inr('taxable', 'Taxable value'), col.inr('total', 'Value incl. GST'), col.pct('share', 'Share'),
        ],
        rows,
        totals: { ...totalsOf(rows, ['taxable', 'total']), share: rows.length ? 100 : 0 },
      }
    },
  },
  {
    id: 'salesperson-sales', group: 'sales', title: 'Salesperson-wise sales', description: 'Invoices, customers served and sales value by team member',
    filters: ['range', 'customer'], defaultRange: 'fy',
    build: (s, f) => {
      const docs = salesDocs(s, f)
      const total = sumT(docs, 'grandTotal')
      const rows = [...groupBy(docs, (d) => d.salesPerson || 'Unassigned')]
        .map(([name, list]) => {
          const value = sumT(list, 'grandTotal')
          const outstanding = list.reduce((a, d) => a + salesInvoiceStatus(s, d).balance, 0)
          return { id: name, name, invoices: list.length, customers: new Set(list.map((d) => d.customerId)).size, taxable: sumT(list, 'taxable'), total: value, avg: round2(value / list.length), outstanding: round2(outstanding), share: share(value, total) }
        })
        .sort((a, b) => b.total - a.total)
      return {
        summary: [
          { label: 'Sales team', value: num(rows.length) },
          { label: 'Total sales', value: inr(total) },
          { label: 'Top performer', value: rows[0]?.name || '—', foot: rows[0] ? inr(rows[0].total) : '' },
          { label: 'Average invoice', value: inr(docs.length ? total / docs.length : 0) },
        ],
        chart: { type: 'bar', title: 'Sales by salesperson', data: rows.map((r) => ({ label: r.name, total: r.total })), xKey: 'label', series: [{ key: 'total', name: 'Sales incl. GST' }], valueFormat: 'inr' },
        columns: [col.text('name', 'Salesperson'), col.num('invoices', 'Invoices'), col.num('customers', 'Customers'), col.inr('taxable', 'Taxable'), col.inr('total', 'Sales'), col.inr('avg', 'Avg. invoice'), col.inr('outstanding', 'Outstanding'), col.pct('share', 'Share')],
        rows,
        totals: { ...totalsOf(rows, ['invoices', 'taxable', 'total', 'outstanding']), share: rows.length ? 100 : 0 },
      }
    },
  },
  {
    id: 'monthly-sales', group: 'sales', title: 'Monthly sales', description: 'Last 12 months of sales with month-on-month growth',
    filters: ['range', 'customer'], defaultRange: '12m',
    build: (s, f) => {
      const docs = salesDocs(s, f)
      const ts = timeSeries(docs, f.range, [
        { key: 'total', value: (d) => d.totals.grandTotal },
        { key: 'taxable', value: (d) => d.totals.taxable },
        { key: 'gst', value: (d) => d.totals.gst },
        { key: 'invoices', value: () => 1 },
      ], true)
      const rows = ts.data.map((b, i) => {
        const prev = ts.data[i - 1]?.total
        return { id: b.key, month: b.label, invoices: b.invoices, taxable: b.taxable, gst: b.gst, total: b.total, growth: prev ? round2(((b.total - prev) / prev) * 100) : null }
      })
      const best = [...rows].sort((a, b) => b.total - a.total)[0]
      return {
        summary: [
          { label: 'Sales in period', value: inr(sumK(rows, 'total')) },
          { label: 'Monthly average', value: inr(rows.length ? sumK(rows, 'total') / rows.length : 0) },
          { label: 'Best month', value: best?.month || '—', foot: best ? inr(best.total) : '' },
          { label: 'Invoices', value: num(sumK(rows, 'invoices')) },
        ],
        chart: { type: 'bar', title: 'Sales by month', data: ts.data, xKey: 'label', series: [{ key: 'total', name: 'Sales incl. GST' }], valueFormat: 'inr' },
        columns: [
          col.text('month', 'Month', { sortValue: (r) => r.id }), col.num('invoices', 'Invoices'), col.inr('taxable', 'Taxable value'), col.inr('gst', 'GST'), col.inr('total', 'Total sales'),
          { key: 'growth', header: 'Growth', align: 'right', accessor: (r) => r.growth, render: (r) => (r.growth === null ? '—' : <span className={r.growth >= 0 ? 'text-green' : 'text-red'}>{r.growth >= 0 ? '+' : ''}{pctStr(r.growth)}</span>) },
        ],
        rows,
        totals: totalsOf(rows, ['invoices', 'taxable', 'gst', 'total']),
      }
    },
  },

  /* ================= PURCHASE ================= */
  {
    id: 'purchase-summary', group: 'purchase', title: 'Purchase summary', description: 'Total purchases, input GST and payments with trend by supplier',
    filters: ['range', 'supplier'], defaultRange: 'fy',
    build: (s, f) => {
      const docs = purchaseDocs(s, f)
      const total = sumT(docs, 'grandTotal')
      const paid = docs.reduce((a, d) => a + purchaseInvoiceStatus(s, d).paid, 0)
      const rows = partyRows(docs, 'supplierId', byId(s.suppliers), purchaseInvoiceStatus, s)
      const ts = timeSeries(docs, f.range, [{ key: 'purchase', value: (d) => d.totals.grandTotal }])
      return {
        summary: [
          { label: 'Total purchases', value: inr(total), foot: 'Including GST' },
          { label: 'Supplier bills', value: num(docs.length) },
          { label: 'Input GST', value: inr(sumT(docs, 'gst')) },
          { label: 'Paid to suppliers', value: inr(paid), foot: `${inr(total - paid)} payable` },
        ],
        chart: { type: 'bar', title: ts.daily ? 'Daily purchases' : 'Monthly purchases', data: ts.data, xKey: 'label', series: [{ key: 'purchase', name: 'Purchases incl. GST' }], valueFormat: 'inr' },
        tableTitle: 'Purchases by supplier',
        columns: [
          col.text('party', 'Supplier', { render: (r) => linkTo(`/masters/suppliers?view=${r.id}`, r.party) }), col.text('city', 'City'), col.num('invoices', 'Bills'),
          col.inr('taxable', 'Taxable value'), col.inr('gst', 'GST'), col.inr('total', 'Total'), col.inr('outstanding', 'Payable'), col.pct('share', 'Share'),
        ],
        rows,
        totals: { ...totalsOf(rows, ['invoices', 'taxable', 'gst', 'total', 'outstanding']), share: rows.length ? 100 : 0 },
      }
    },
  },
  {
    id: 'purchase-register', group: 'purchase', title: 'Purchase register', description: 'Bill-wise register with supplier invoice numbers and tax split',
    filters: ['range', 'supplier', 'status'], options: { status: PAY_STATUS }, labels: { status: 'Payment status' }, defaultRange: 'month',
    build: (s, f) => {
      const sup = byId(s.suppliers)
      const rows = purchaseDocs(s, f)
        .map((d) => {
          const st = purchaseInvoiceStatus(s, d)
          const p = sup.get(d.supplierId)
          return { id: d.id, date: d.date, number: d.number, supplierInvoiceNo: d.supplierInvoiceNo, supplier: p?.name, gstin: p?.gstin, taxable: d.totals.taxable, cgst: d.totals.cgst, sgst: d.totals.sgst, igst: d.totals.igst, total: d.totals.grandTotal, balance: st.balance, status: st.status }
        })
        .filter((r) => !f.status || r.status === f.status)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      return {
        summary: [
          { label: 'Bills', value: num(rows.length) },
          { label: 'Taxable value', value: inr(sumK(rows, 'taxable')) },
          { label: 'Input GST', value: inr(sumK(rows, 'cgst') + sumK(rows, 'sgst') + sumK(rows, 'igst')) },
          { label: 'Bill value', value: inr(sumK(rows, 'total')), foot: `${inr(sumK(rows, 'balance'))} payable` },
        ],
        columns: [
          col.date(), col.text('number', 'Bill', { render: pinvLink }), col.text('supplierInvoiceNo', 'Supplier inv. no.'), col.text('supplier', 'Supplier'),
          col.inr2('taxable', 'Taxable'), col.inr2('cgst', 'CGST'), col.inr2('sgst', 'SGST'), col.inr2('igst', 'IGST'), col.inr2('total', 'Total'),
          col.text('status', 'Payment', { render: (r) => <StatusBadge status={r.status} /> }),
        ],
        rows,
        totals: totalsOf(rows, ['taxable', 'cgst', 'sgst', 'igst', 'total']),
      }
    },
  },
  {
    id: 'supplier-purchase', group: 'purchase', title: 'Supplier-wise purchase', description: 'Purchase value, payments and share of spend per supplier',
    filters: ['range'], defaultRange: 'fy',
    build: (s, f) => {
      const rows = partyRows(purchaseDocs(s, f), 'supplierId', byId(s.suppliers), purchaseInvoiceStatus, s)
      return {
        summary: [
          { label: 'Suppliers', value: num(rows.length) },
          { label: 'Total purchases', value: inr(sumK(rows, 'total')) },
          { label: 'Largest supplier', value: rows[0]?.party || '—', foot: rows[0] ? `${pctStr(rows[0].share)} of spend` : '' },
          { label: 'Payable', value: inr(sumK(rows, 'outstanding')) },
        ],
        chart: { type: 'hbar', title: 'Top suppliers by purchase value', data: rows.slice(0, 8).map((r) => ({ label: short(r.party), total: r.total })), xKey: 'label', series: [{ key: 'total', name: 'Purchases incl. GST' }], valueFormat: 'inr' },
        columns: [
          col.text('party', 'Supplier', { render: (r) => linkTo(`/accounts/supplier-ledger?supplier=${r.id}`, r.party) }), col.text('city', 'City'), col.text('state', 'State'),
          col.num('invoices', 'Bills'), col.inr('taxable', 'Taxable'), col.inr('total', 'Purchases'), col.inr('paid', 'Paid'), col.inr('outstanding', 'Payable'), col.pct('share', 'Share'),
        ],
        rows,
        totals: { ...totalsOf(rows, ['invoices', 'taxable', 'total', 'paid', 'outstanding']), share: rows.length ? 100 : 0 },
      }
    },
  },
  {
    id: 'product-purchase', group: 'purchase', title: 'Product-wise purchase', description: 'Quantity bought, value and average purchase rate per item',
    filters: ['range', 'supplier', 'category'], defaultRange: 'fy',
    build: (s, f) => {
      const rows = itemLineRows(purchaseDocs(s, f), byId(s.items), f)
      return {
        summary: [
          { label: 'Items purchased', value: num(rows.length) },
          { label: 'Taxable value', value: inr(sumK(rows, 'taxable')) },
          { label: 'Largest spend', value: rows[0]?.name || '—', foot: rows[0] ? `${pctStr(rows[0].share)} of spend` : '' },
          { label: 'Input GST', value: inr(sumK(rows, 'gst')) },
        ],
        chart: { type: 'hbar', title: 'Top items by purchase value', data: rows.slice(0, 8).map((r) => ({ label: short(r.name), taxable: r.taxable })), xKey: 'label', series: [{ key: 'taxable', name: 'Taxable value' }], valueFormat: 'inr' },
        columns: [
          col.text('code', 'Code', { render: (r) => <span className="doc-no">{r.code}</span> }), col.text('name', 'Item', { render: (r) => itemLink(r) }), col.text('category', 'Category'),
          col.num('qty', 'Qty bought', { render: (r) => `${num(r.qty)} ${r.unit}` }), col.inr2('avgRate', 'Avg. rate'), col.inr('taxable', 'Taxable value'), col.inr('gst', 'GST'), col.pct('share', 'Share'),
        ],
        rows,
        totals: { ...totalsOf(rows, ['taxable', 'gst']), share: rows.length ? 100 : 0 },
      }
    },
  },

  /* ================= INVENTORY ================= */
  {
    id: 'stock-report', group: 'inventory', title: 'Stock report', description: 'Item-wise balance, minimum level, value and stock status',
    filters: ['warehouse', 'category', 'type', 'status'], options: { type: PRODUCT_TYPES, status: ['In Stock', 'Low Stock', 'Out of Stock'] }, labels: { type: 'Item type', status: 'Stock status' },
    build: (s, f) => {
      const summary = stockSummary(s, { warehouseId: f.warehouse })
      const bal = {}
      summary.forEach((r) => (bal[r.itemId] = (bal[r.itemId] || 0) + r.balance))
      const rows = s.items
        .filter((i) => i.status !== 'Inactive' && (!f.category || i.category === f.category) && (!f.type || i.type === f.type))
        .map((i) => {
          const balance = round2(bal[i.id] || 0)
          const status = balance <= 0 ? 'Out of Stock' : balance <= Number(i.minStock) ? 'Low Stock' : 'In Stock'
          return { id: i.id, code: i.code, name: i.name, category: i.category, type: i.type, unit: i.unit, balance, minStock: Number(i.minStock), rate: Number(i.purchaseRate), value: round2(balance * Number(i.purchaseRate)), status }
        })
        .filter((r) => !f.status || r.status === f.status)
      return {
        summary: [
          { label: 'Items', value: num(rows.length) },
          { label: 'Stock value', value: inr(sumK(rows, 'value')), foot: 'At purchase rate' },
          { label: 'Low stock', value: num(rows.filter((r) => r.status === 'Low Stock').length) },
          { label: 'Out of stock', value: num(rows.filter((r) => r.status === 'Out of Stock').length) },
        ],
        columns: [
          col.text('code', 'Code', { render: (r) => <span className="doc-no">{r.code}</span> }), col.text('name', 'Item', { render: (r) => itemLink(r) }), col.text('category', 'Category'), col.text('type', 'Type'),
          col.num('balance', 'Balance', { render: (r) => linkTo(`/inventory/ledger?item=${r.id}${f.warehouse ? `&warehouse=${f.warehouse}` : ''}`, `${num(r.balance)} ${r.unit}`) }),
          col.num('minStock', 'Minimum'), col.inr2('rate', 'Rate'), col.inr('value', 'Value'),
          col.text('status', 'Status', { render: (r) => <StatusBadge status={r.status} /> }),
        ],
        rows,
        totals: totalsOf(rows, ['value']),
      }
    },
  },
  {
    id: 'stock-ledger', group: 'inventory', title: 'Stock ledger', description: 'Every inward and outward movement of an item with running balance',
    filters: ['item', 'warehouse', 'range', 'type'], defaultRange: '30d', defaultFilters: { item: 'fg-1001' }, required: ['item'],
    options: { type: ['Opening', 'GRN', 'Purchase', 'Purchase Return', 'Delivery', 'Sales', 'Sales Return', 'Stock In', 'Stock Out', 'Transfer In', 'Transfer Out', 'Adjustment', 'Material Issue', 'Production'] },
    labels: { type: 'Transaction' },
    build: (s, f) => {
      if (!f.item) return { rows: [], columns: [], summary: [], emptyMessage: 'Select an item to see its stock ledger.' }
      const item = byId(s.items).get(f.item)
      const wh = byId(s.warehouses)
      const { opening, rows: moves } = stockLedger(s, { itemId: f.item, warehouseId: f.warehouse, from: f.range?.from, to: f.range?.to, type: f.type })
      const rows = moves.map((m) => ({ id: m.id, date: m.date, ref: m.ref, type: m.type, warehouse: wh.get(m.warehouseId)?.name, in: m.in, out: m.out, balance: m.balance }))
      const inward = sumK(rows, 'in')
      const outward = sumK(rows, 'out')
      const closing = rows.length ? rows[rows.length - 1].balance : opening
      const u = item?.unit || ''
      return {
        summary: [
          { label: 'Opening balance', value: `${num(opening)} ${u}` },
          { label: 'Inward', value: `${num(inward)} ${u}` },
          { label: 'Outward', value: `${num(outward)} ${u}` },
          { label: 'Closing balance', value: `${num(closing)} ${u}`, foot: item ? `Value ${inr(closing * item.purchaseRate)}` : '' },
        ],
        tableTitle: item ? `${item.name} (${item.code})` : undefined,
        columns: [
          col.date('date', 'Date', { sortable: false }), col.text('ref', 'Reference', { sortable: false, render: (r) => <span className="doc-no">{r.ref}</span> }), col.text('type', 'Transaction', { sortable: false }),
          col.text('warehouse', 'Warehouse', { sortable: false }), col.num('in', 'In', { sortable: false, render: (r) => (r.in ? <span className="text-green">{num(r.in)}</span> : '—') }),
          col.num('out', 'Out', { sortable: false, render: (r) => (r.out ? <span className="text-red">{num(r.out)}</span> : '—') }), col.num('balance', 'Balance', { sortable: false, render: (r) => <b>{num(r.balance)}</b> }),
        ],
        rows,
        totals: { in: inward, out: outward },
      }
    },
  },
  {
    id: 'low-stock', group: 'inventory', title: 'Low stock report', description: 'Items at or below minimum level with suggested reorder quantity',
    filters: ['category', 'type'], options: { type: PRODUCT_TYPES }, labels: { type: 'Item type' },
    build: (s, f) => {
      const wh = byId(s.warehouses)
      const rows = lowStockItems(s)
        .filter((r) => (!f.category || r.item.category === f.category) && (!f.type || r.item.type === f.type))
        .map(({ item, balance, minStock }) => {
          const reorder = Math.max(0, Math.ceil(2 * minStock - balance))
          return {
            id: item.id, code: item.code, name: item.name, category: item.category, type: item.type, unit: item.unit, warehouse: wh.get(item.warehouseId)?.name,
            balance, minStock, shortfall: round2(Math.max(0, minStock - balance)), reorder, estValue: round2(reorder * Number(item.purchaseRate)),
            status: balance <= 0 ? 'Out of Stock' : 'Low Stock',
          }
        })
      return {
        summary: [
          { label: 'Items below minimum', value: num(rows.length) },
          { label: 'Out of stock', value: num(rows.filter((r) => r.status === 'Out of Stock').length) },
          { label: 'Suggested reorder value', value: inr(sumK(rows, 'estValue')), foot: 'Reorder to 2× minimum level' },
          { label: 'Raw materials affected', value: num(rows.filter((r) => r.type === 'Raw Material').length) },
        ],
        columns: [
          col.text('code', 'Code', { render: (r) => <span className="doc-no">{r.code}</span> }), col.text('name', 'Item', { render: (r) => itemLink(r) }), col.text('type', 'Type'), col.text('warehouse', 'Warehouse'),
          col.num('balance', 'Balance', { render: (r) => `${num(r.balance)} ${r.unit}` }), col.num('minStock', 'Minimum'), col.num('shortfall', 'Shortfall'),
          col.num('reorder', 'Suggested reorder', { render: (r) => <b>{num(r.reorder)} {r.unit}</b> }), col.inr('estValue', 'Est. value'),
          col.text('status', 'Status', { render: (r) => <StatusBadge status={r.status} /> }),
        ],
        rows,
        totals: totalsOf(rows, ['estValue']),
      }
    },
  },
  {
    id: 'stock-valuation', group: 'inventory', title: 'Stock valuation', description: 'Closing stock value at purchase rate, grouped by category',
    filters: ['warehouse', 'type'], options: { type: PRODUCT_TYPES }, labels: { type: 'Item type' },
    build: (s, f) => {
      const summary = stockSummary(s, { warehouseId: f.warehouse }).filter((r) => !f.type || r.item.type === f.type)
      const total = sumK(summary, 'value')
      const rows = [...groupBy(summary, (r) => r.item.category)]
        .map(([category, list]) => ({ id: category, category, items: new Set(list.map((r) => r.itemId)).size, qty: sumK(list, 'balance'), value: sumK(list, 'value'), share: share(sumK(list, 'value'), total) }))
        .sort((a, b) => b.value - a.value)
      return {
        summary: [
          { label: 'Total stock value', value: inr(total) },
          { label: 'Categories', value: num(rows.length) },
          { label: 'Largest category', value: rows[0]?.category || '—', foot: rows[0] ? `${pctStr(rows[0].share)} of value` : '' },
          { label: 'Item-warehouse lines', value: num(summary.length) },
        ],
        chart: { type: 'hbar', title: 'Stock value by category', data: rows.map((r) => ({ label: r.category, value: r.value })), xKey: 'label', series: [{ key: 'value', name: 'Stock value' }], valueFormat: 'inr' },
        columns: [col.text('category', 'Category'), col.num('items', 'Items'), col.num('qty', 'Quantity (mixed units)'), col.inr('value', 'Value'), col.pct('share', 'Share')],
        rows,
        totals: { ...totalsOf(rows, ['items', 'value']), share: rows.length ? 100 : 0 },
      }
    },
  },
  {
    id: 'warehouse-stock', group: 'inventory', title: 'Warehouse stock', description: 'Stock held in each godown with item-level detail',
    filters: ['warehouse', 'category'],
    build: (s, f) => {
      const wh = byId(s.warehouses)
      const all = stockSummary(s, { warehouseId: f.warehouse }).filter((r) => Math.abs(r.balance) > 0 && (!f.category || r.item.category === f.category))
      const byWh = [...groupBy(all, (r) => r.warehouseId)].map(([id, list]) => ({ label: wh.get(id)?.name || id, value: sumK(list, 'value') })).sort((a, b) => b.value - a.value)
      const rows = all
        .map((r) => ({ id: r.key, warehouse: wh.get(r.warehouseId)?.name, itemId: r.itemId, code: r.item.code, name: r.item.name, category: r.item.category, unit: r.item.unit, balance: r.balance, value: r.value }))
        .sort((a, b) => (a.warehouse === b.warehouse ? b.value - a.value : String(a.warehouse).localeCompare(String(b.warehouse))))
      return {
        summary: [
          { label: 'Warehouses with stock', value: num(byWh.length) },
          { label: 'Stock value', value: inr(sumK(rows, 'value')) },
          { label: 'Largest godown', value: byWh[0]?.label || '—', foot: byWh[0] ? inr(byWh[0].value) : '' },
          { label: 'Item lines', value: num(rows.length) },
        ],
        chart: { type: 'hbar', title: 'Stock value by warehouse', data: byWh, xKey: 'label', series: [{ key: 'value', name: 'Stock value' }], valueFormat: 'inr' },
        columns: [
          col.text('warehouse', 'Warehouse'), col.text('code', 'Code', { render: (r) => <span className="doc-no">{r.code}</span> }), col.text('name', 'Item', { render: (r) => itemLink(r, 'itemId') }), col.text('category', 'Category'),
          col.num('balance', 'Balance', { render: (r) => `${num(r.balance)} ${r.unit}` }), col.inr('value', 'Value'),
        ],
        rows,
        totals: totalsOf(rows, ['value']),
      }
    },
  },
  {
    id: 'stock-movement', group: 'inventory', title: 'Stock movement', description: 'Inward and outward quantities and values by transaction type',
    filters: ['range', 'warehouse', 'category'], defaultRange: '30d',
    build: (s, f) => {
      const items = byId(s.items)
      const moves = s.stockMoves.filter((m) => inR(m.date, f.range) && (!f.warehouse || m.warehouseId === f.warehouse) && (!f.category || items.get(m.itemId)?.category === f.category))
      const rows = [...groupBy(moves, (m) => m.type)]
        .map(([type, list]) => {
          const ins = list.filter((m) => m.qty > 0)
          const outs = list.filter((m) => m.qty < 0)
          const val = (l) => round2(l.reduce((a, m) => a + Math.abs(m.qty) * (Number(items.get(m.itemId)?.purchaseRate) || 0), 0))
          return { id: type, type, entries: list.length, items: new Set(list.map((m) => m.itemId)).size, inQty: sumK(ins, 'qty'), outQty: round2(-sumK(outs, 'qty')), inValue: val(ins), outValue: val(outs) }
        })
        .sort((a, b) => b.inValue + b.outValue - (a.inValue + a.outValue))
      return {
        summary: [
          { label: 'Movements', value: num(moves.length) },
          { label: 'Inward value', value: inr(sumK(rows, 'inValue')) },
          { label: 'Outward value', value: inr(sumK(rows, 'outValue')) },
          { label: 'Net change', value: inr(sumK(rows, 'inValue') - sumK(rows, 'outValue')) },
        ],
        chart: { type: 'bar', title: 'Movement value by transaction type', data: rows.map((r) => ({ label: r.type, inValue: r.inValue, outValue: r.outValue })), xKey: 'label', series: [{ key: 'inValue', name: 'Inward' }, { key: 'outValue', name: 'Outward' }], valueFormat: 'inr' },
        columns: [col.text('type', 'Transaction type'), col.num('entries', 'Entries'), col.num('items', 'Items'), col.num('inQty', 'Inward qty'), col.num('outQty', 'Outward qty'), col.inr('inValue', 'Inward value'), col.inr('outValue', 'Outward value')],
        rows,
        totals: totalsOf(rows, ['entries', 'inValue', 'outValue']),
      }
    },
  },

  /* ================= PRODUCTION ================= */
  {
    id: 'production-summary', group: 'production', title: 'Production summary', description: 'Orders by status, output, rejection and yield per product',
    filters: ['range', 'item'], itemFilter: 'product', labels: { item: 'Product' }, defaultRange: '30d',
    build: (s, f) => {
      const items = byId(s.items)
      const orders = s.productionOrders.filter((o) => inR(o.date, f.range) && (!f.item || o.productId === f.item))
      const entries = s.productionEntries.filter((e) => inR(e.date, f.range) && (!f.item || e.productId === f.item))
      const produced = sumK(entries, 'producedQty')
      const rejected = sumK(entries, 'rejectedQty')
      const rows = [...groupBy(entries, (e) => e.productId)]
        .map(([pid, list]) => {
          const p = sumK(list, 'producedQty')
          const r = sumK(list, 'rejectedQty')
          return { id: pid, code: items.get(pid)?.code, name: items.get(pid)?.name, orders: new Set(list.map((e) => e.productionOrderId)).size, entries: list.length, produced: p, rejected: r, good: p - r, yield: share(p - r, p) }
        })
        .sort((a, b) => b.good - a.good)
      const ts = timeSeries(entries, f.range, [{ key: 'good', value: (e) => e.producedQty - e.rejectedQty }])
      const count = (st) => orders.filter((o) => o.status === st).length
      return {
        summary: [
          { label: 'Production orders', value: num(orders.length), foot: `${count('Completed')} completed, ${count('In Progress')} in progress, ${count('Planned') + count('Released')} pending` },
          { label: 'Good output', value: `${num(produced - rejected)} units` },
          { label: 'Rejected', value: `${num(rejected)} units` },
          { label: 'Yield', value: pctStr(share(produced - rejected, produced)) },
        ],
        chart: { type: 'bar', title: ts.daily ? 'Daily good output' : 'Monthly good output', data: ts.data, xKey: 'label', series: [{ key: 'good', name: 'Good units' }], valueFormat: 'num' },
        tableTitle: 'Output by product',
        columns: [
          col.text('code', 'Code', { render: (r) => <span className="doc-no">{r.code}</span> }), col.text('name', 'Product', { render: (r) => itemLink(r) }),
          col.num('orders', 'Orders'), col.num('entries', 'Entries'), col.num('produced', 'Produced'), col.num('rejected', 'Rejected'), col.num('good', 'Good units'), col.pct('yield', 'Yield'),
        ],
        rows,
        totals: totalsOf(rows, ['entries', 'produced', 'rejected', 'good']),
      }
    },
  },
  {
    id: 'production-register', group: 'production', title: 'Production register', description: 'Entry-wise record of produced, rejected and cost booked',
    filters: ['range', 'item'], itemFilter: 'product', labels: { item: 'Product' }, defaultRange: '30d',
    build: (s, f) => {
      const items = byId(s.items)
      const orders = byId(s.productionOrders)
      const rows = s.productionEntries
        .filter((e) => inR(e.date, f.range) && (!f.item || e.productId === f.item))
        .map((e) => ({
          id: e.id, date: e.date, number: e.number, orderId: e.productionOrderId, orderNo: orders.get(e.productionOrderId)?.number, product: items.get(e.productId)?.name,
          produced: e.producedQty, rejected: e.rejectedQty, good: e.producedQty - e.rejectedQty, labour: e.labourCost, other: (Number(e.otherCost) || 0) + (Number(e.freightCost) || 0), shift: e.shift, supervisor: e.supervisor,
        }))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      return {
        summary: [
          { label: 'Entries', value: num(rows.length) },
          { label: 'Produced', value: `${num(sumK(rows, 'produced'))} units` },
          { label: 'Good units', value: `${num(sumK(rows, 'good'))} units` },
          { label: 'Labour and other cost', value: inr(sumK(rows, 'labour') + sumK(rows, 'other')) },
        ],
        columns: [
          col.date(), col.text('number', 'Entry', { render: (r) => <DocNo to={`/production/entries/${r.id}`}>{r.number}</DocNo> }),
          col.text('orderNo', 'Production order', { render: (r) => <DocNo to={`/production/orders/${r.orderId}`}>{r.orderNo}</DocNo> }), col.text('product', 'Product'),
          col.num('produced', 'Produced'), col.num('rejected', 'Rejected'), col.num('good', 'Good'), col.inr('labour', 'Labour'), col.inr('other', 'Other cost'), col.text('shift', 'Shift'), col.text('supervisor', 'Supervisor'),
        ],
        rows,
        totals: totalsOf(rows, ['produced', 'rejected', 'good', 'labour', 'other']),
      }
    },
  },
  {
    id: 'material-consumption', group: 'production', title: 'Material consumption', description: 'Materials issued to production against BOM requirement',
    filters: ['range', 'item'], itemFilter: 'material', labels: { item: 'Material' }, defaultRange: '30d',
    build: (s, f) => {
      const items = byId(s.items)
      const map = new Map()
      s.materialIssues.filter((m) => inR(m.date, f.range)).forEach((m) =>
        m.lines.forEach((l) => {
          if (f.item && l.itemId !== f.item) return
          const r = map.get(l.itemId) || { id: l.itemId, required: 0, issued: 0, issues: new Set() }
          r.required += Number(l.requiredQty) || 0
          r.issued += Number(l.issuedQty) || 0
          r.issues.add(m.id)
          map.set(l.itemId, r)
        }),
      )
      const rows = [...map.values()]
        .map((r) => {
          const it = items.get(r.id)
          return { id: r.id, code: it?.code, name: it?.name, unit: it?.unit, issues: r.issues.size, required: round2(r.required), issued: round2(r.issued), variance: round2(r.issued - r.required), rate: Number(it?.purchaseRate) || 0, value: round2(r.issued * (Number(it?.purchaseRate) || 0)) }
        })
        .sort((a, b) => b.value - a.value)
      return {
        summary: [
          { label: 'Materials issued', value: num(rows.length) },
          { label: 'Consumption value', value: inr(sumK(rows, 'value')) },
          { label: 'Largest consumption', value: rows[0]?.name || '—', foot: rows[0] ? inr(rows[0].value) : '' },
          { label: 'Issue slips', value: num(s.materialIssues.filter((m) => inR(m.date, f.range)).length) },
        ],
        chart: { type: 'hbar', title: 'Top materials by consumption value', data: rows.slice(0, 8).map((r) => ({ label: short(r.name), value: r.value })), xKey: 'label', series: [{ key: 'value', name: 'Consumption value' }], valueFormat: 'inr' },
        columns: [
          col.text('code', 'Code', { render: (r) => <span className="doc-no">{r.code}</span> }), col.text('name', 'Material', { render: (r) => itemLink(r) }), col.num('issues', 'Issue slips'),
          col.num('required', 'BOM requirement', { render: (r) => `${num(r.required)} ${r.unit}` }), col.num('issued', 'Issued', { render: (r) => `${num(r.issued)} ${r.unit}` }),
          col.num('variance', 'Variance', { render: (r) => <span className={r.variance < 0 ? 'text-amber' : r.variance > 0 ? 'text-red' : ''}>{r.variance > 0 ? '+' : ''}{num(r.variance)}</span> }),
          col.inr2('rate', 'Rate'), col.inr('value', 'Value'),
        ],
        rows,
        totals: totalsOf(rows, ['value']),
      }
    },
  },
  {
    id: 'wastage-report', group: 'production', title: 'Wastage report', description: 'Wastage, rejection, damage and scrap entries with estimated value',
    filters: ['range', 'type'], options: { type: WASTAGE_TYPES }, labels: { type: 'Wastage type' }, defaultRange: 'fy',
    build: (s, f) => {
      const items = byId(s.items)
      const orders = byId(s.productionOrders)
      const rows = s.wastages
        .filter((w) => inR(w.date, f.range) && (!f.type || w.type === f.type))
        .map((w) => {
          const it = items.get(w.itemId)
          return { id: w.id, date: w.date, number: w.number, orderId: w.productionOrderId, orderNo: orders.get(w.productionOrderId)?.number, item: it?.name, unit: it?.unit, qty: w.qty, type: w.type, reason: w.reason, value: round2(Number(w.qty) * (Number(it?.purchaseRate) || 0)) }
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      const byType = WASTAGE_TYPES.map((t) => ({ label: t, value: sumK(rows.filter((r) => r.type === t), 'value') }))
      return {
        summary: byType.map((t) => ({ label: t.label, value: inr(t.value), foot: `${rows.filter((r) => r.type === t.label).length} entries` })),
        chart: { type: 'bar', title: 'Estimated loss by type', data: byType, xKey: 'label', series: [{ key: 'value', name: 'Estimated value' }], valueFormat: 'inr' },
        columns: [
          col.date(), col.text('number', 'Entry', { render: (r) => <span className="doc-no">{r.number}</span> }), col.text('orderNo', 'Production order', { render: (r) => <DocNo to={`/production/orders/${r.orderId}`}>{r.orderNo}</DocNo> }),
          col.text('item', 'Item'), col.num('qty', 'Qty', { render: (r) => `${num(r.qty)} ${r.unit}` }), col.text('type', 'Type', { render: (r) => <StatusBadge status={r.type} /> }), col.text('reason', 'Reason'), col.inr('value', 'Est. value'),
        ],
        rows,
        totals: totalsOf(rows, ['value']),
      }
    },
  },
  {
    id: 'rejection-report', group: 'production', title: 'Rejection report', description: 'Rejected quantity and rejection rate for each product',
    filters: ['range', 'item'], itemFilter: 'product', labels: { item: 'Product' }, defaultRange: 'fy',
    build: (s, f) => {
      const items = byId(s.items)
      const entries = s.productionEntries.filter((e) => inR(e.date, f.range) && (!f.item || e.productId === f.item))
      const logged = s.wastages.filter((w) => w.type === 'Rejection' && inR(w.date, f.range))
      const rows = [...groupBy(entries, (e) => e.productId)]
        .map(([pid, list]) => {
          const produced = sumK(list, 'producedQty')
          const rejected = sumK(list, 'rejectedQty')
          const it = items.get(pid)
          return { id: pid, code: it?.code, name: it?.name, produced, rejected, logged: sumK(logged.filter((w) => w.itemId === pid), 'qty'), rate: share(rejected, produced), lossValue: round2(rejected * (Number(it?.purchaseRate) || 0)) }
        })
        .sort((a, b) => b.rate - a.rate)
      const produced = sumK(rows, 'produced')
      const rejected = sumK(rows, 'rejected')
      return {
        summary: [
          { label: 'Produced', value: `${num(produced)} units` },
          { label: 'Rejected', value: `${num(rejected)} units` },
          { label: 'Rejection rate', value: pctStr(share(rejected, produced)) },
          { label: 'Loss at cost', value: inr(sumK(rows, 'lossValue')) },
        ],
        chart: { type: 'hbar', title: 'Rejection rate by product', data: rows.map((r) => ({ label: short(r.name), rate: r.rate })), xKey: 'label', series: [{ key: 'rate', name: 'Rejection rate' }], valueFormat: 'pct' },
        columns: [
          col.text('code', 'Code', { render: (r) => <span className="doc-no">{r.code}</span> }), col.text('name', 'Product', { render: (r) => itemLink(r) }),
          col.num('produced', 'Produced'), col.num('rejected', 'Rejected in entries'), col.num('logged', 'Logged rejection records'), col.pct('rate', 'Rejection rate'), col.inr('lossValue', 'Loss at cost'),
        ],
        rows,
        totals: totalsOf(rows, ['produced', 'rejected', 'logged', 'lossValue']),
      }
    },
  },
  {
    id: 'production-costing', group: 'production', title: 'Production costing', description: 'Order-wise material, labour and overhead cost with margin',
    filters: ['range', 'item'], itemFilter: 'product', labels: { item: 'Product' }, defaultRange: 'fy',
    build: (s, f) => {
      const withEntries = new Set(s.productionEntries.map((e) => e.productionOrderId))
      const rows = s.productionOrders
        .filter((o) => withEntries.has(o.id) && inR(o.date, f.range) && (!f.item || o.productId === f.item))
        .map((o) => {
          const c = productionCosting(s, o)
          return { id: o.id, date: o.date, number: o.number, product: c.product?.name, good: c.good, material: c.rawMaterialCost, labour: c.labourCost, other: round2(c.otherCost + c.freightCost), total: c.totalCost, cpu: c.costPerUnit, price: c.sellingPrice, margin: c.margin, status: o.status }
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      const total = sumK(rows, 'total')
      const good = sumK(rows, 'good')
      const avgMargin = rows.length ? round2(rows.reduce((a, r) => a + r.margin, 0) / rows.length) : 0
      return {
        summary: [
          { label: 'Orders costed', value: num(rows.length) },
          { label: 'Total production cost', value: inr(total) },
          { label: 'Material share', value: pctStr(share(sumK(rows, 'material'), total)), foot: `Labour ${pctStr(share(sumK(rows, 'labour'), total))}` },
          { label: 'Average margin', value: pctStr(avgMargin), foot: `${num(good)} good units` },
        ],
        columns: [
          col.date(), col.text('number', 'Order', { render: (r) => <DocNo to={`/production/costing?order=${r.id}`}>{r.number}</DocNo> }), col.text('product', 'Product'), col.num('good', 'Good units'),
          col.inr('material', 'Material'), col.inr('labour', 'Labour'), col.inr('other', 'Other and freight'), col.inr('total', 'Total cost'), col.inr2('cpu', 'Cost per unit'), col.inr2('price', 'Selling price'),
          col.pct('margin', 'Margin', { render: (r) => <span className={r.margin < 20 ? 'text-amber' : 'text-green'}>{pctStr(r.margin)}</span> }),
        ],
        rows,
        totals: totalsOf(rows, ['good', 'material', 'labour', 'other', 'total']),
      }
    },
  },

  /* ================= ACCOUNTS ================= */
  {
    id: 'customer-ledger', group: 'accounts', title: 'Customer ledger', description: 'Invoices, receipts and returns with running balance for a customer',
    filters: ['customer', 'range'], defaultRange: 'fy', defaultFilters: { customer: 'cus-01' }, required: ['customer'],
    build: (s, f) => {
      if (!f.customer) return { rows: [], columns: [], summary: [], emptyMessage: 'Select a customer to see the ledger.' }
      const led = customerLedger(s, f.customer, { from: f.range?.from, to: f.range?.to })
      return ledgerResult(led, f.range, 'Receivable', (r) => (r.kind === 'Sales Invoice' ? `/sales/invoices/${r.refId}` : r.kind === 'Sales Return' ? `/sales/returns/${r.refId}` : '/accounts/receipts'))
    },
  },
  {
    id: 'supplier-ledger', group: 'accounts', title: 'Supplier ledger', description: 'Purchase bills, payments and returns with running balance for a supplier',
    filters: ['supplier', 'range'], defaultRange: 'fy', defaultFilters: { supplier: 'sup-01' }, required: ['supplier'],
    build: (s, f) => {
      if (!f.supplier) return { rows: [], columns: [], summary: [], emptyMessage: 'Select a supplier to see the ledger.' }
      const led = supplierLedger(s, f.supplier, { from: f.range?.from, to: f.range?.to })
      return ledgerResult(led, f.range, 'Payable', (r) => (r.kind === 'Purchase Invoice' ? `/purchase/invoices/${r.refId}` : r.kind === 'Purchase Return' ? `/purchase/returns/${r.refId}` : '/accounts/payments'))
    },
  },
  {
    id: 'receivable-report', group: 'accounts', title: 'Receivable report', description: 'Unpaid customer invoices with ageing buckets',
    filters: ['customer', 'status'], options: { status: AGEING }, labels: { status: 'Ageing' },
    build: (s, f) => ageingResult(s, f, 'receivable'),
  },
  {
    id: 'payable-report', group: 'accounts', title: 'Payable report', description: 'Unpaid supplier bills with ageing buckets',
    filters: ['supplier', 'status'], options: { status: AGEING }, labels: { status: 'Ageing' },
    build: (s, f) => ageingResult(s, f, 'payable'),
  },
  {
    id: 'payment-report', group: 'accounts', title: 'Payment report', description: 'Customer receipts and supplier payments by mode and account',
    filters: ['range', 'type', 'mode'], options: { type: ['Receipt', 'Payment'], mode: PAYMENT_MODES }, labels: { type: 'Entry type', mode: 'Payment mode' }, defaultRange: 'month',
    build: (s, f) => {
      const cus = byId(s.customers)
      const sup = byId(s.suppliers)
      const sInv = byId(s.salesInvoices)
      const pInv = byId(s.purchaseInvoices)
      const accounts = Object.fromEntries((s.settings.accounts || []).map((a) => [a.id, a.name]))
      const rows = [
        ...s.receipts.map((r) => ({ id: r.id, date: r.date, number: r.number, type: 'Receipt', party: cus.get(r.customerId)?.name, invoice: sInv.get(r.invoiceId)?.number, mode: r.mode, account: accounts[r.accountId], reference: r.reference, received: Number(r.amount), paid: 0 })),
        ...s.payments.map((p) => ({ id: p.id, date: p.date, number: p.number, type: 'Payment', party: sup.get(p.supplierId)?.name, invoice: pInv.get(p.invoiceId)?.number, mode: p.mode, account: accounts[p.accountId], reference: p.reference, received: 0, paid: Number(p.amount) })),
      ]
        .filter((r) => inR(r.date, f.range) && (!f.type || r.type === f.type) && (!f.mode || r.mode === f.mode))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      const byMode = PAYMENT_MODES.map((m) => ({ label: m, received: sumK(rows.filter((r) => r.mode === m), 'received'), paid: sumK(rows.filter((r) => r.mode === m), 'paid') }))
      const received = sumK(rows, 'received')
      const paid = sumK(rows, 'paid')
      return {
        summary: [
          { label: 'Received from customers', value: inr(received), foot: `${rows.filter((r) => r.type === 'Receipt').length} receipts` },
          { label: 'Paid to suppliers', value: inr(paid), foot: `${rows.filter((r) => r.type === 'Payment').length} payments` },
          { label: 'Net cash flow', value: inr(received - paid) },
          { label: 'Most used mode', value: [...byMode].sort((a, b) => b.received + b.paid - (a.received + a.paid))[0]?.label || '—' },
        ],
        chart: { type: 'bar', title: 'Receipts and payments by mode', data: byMode, xKey: 'label', series: [{ key: 'received', name: 'Received' }, { key: 'paid', name: 'Paid' }], valueFormat: 'inr' },
        columns: [
          col.date(), col.text('number', 'Voucher', { render: (r) => <span className="doc-no">{r.number}</span> }), col.text('type', 'Type', { render: (r) => <span className={r.type === 'Receipt' ? 'text-green' : 'text-blue'}>{r.type}</span> }),
          col.text('party', 'Party'), col.text('invoice', 'Against', { render: (r) => <span className="doc-no">{r.invoice || '—'}</span> }), col.text('mode', 'Mode'), col.text('account', 'Account'),
          col.text('reference', 'Reference', { render: (r) => <span className="small muted">{r.reference}</span> }), col.inr('received', 'Received'), col.inr('paid', 'Paid'),
        ],
        rows,
        totals: { received, paid },
      }
    },
  },

  /* ================= GST ================= */
  {
    id: 'gst-sales', group: 'gst', title: 'GST sales (output tax)', description: 'Invoice-wise B2B outward supplies with rate-wise tax breakup',
    filters: ['range', 'customer'], defaultRange: 'month', note: 'GST return filing (GSTR-1, GSTR-3B) is not part of this demo. Figures are for review and export only.',
    build: (s, f) => gstResult(salesDocs(s, f), byId(s.customers), 'customerId', 'Customer', invLink, (d, p) => d.placeOfSupply || p?.state, 'Output'),
  },
  {
    id: 'gst-purchase', group: 'gst', title: 'GST purchase (input tax)', description: 'Supplier bill-wise inward supplies and eligible input tax',
    filters: ['range', 'supplier'], defaultRange: 'month', note: 'Input tax credit matching with GSTR-2B is not part of this demo.',
    build: (s, f) => gstResult(purchaseDocs(s, f), byId(s.suppliers), 'supplierId', 'Supplier', pinvLink, (d, p) => p?.state, 'Input'),
  },
  {
    id: 'tax-summary', group: 'gst', title: 'GST tax summary', description: 'Output tax against input tax by month and by rate, with net GST payable',
    filters: ['range'], defaultRange: 'fy', note: 'Net payable is indicative. GST return filing and challan payment are not part of this demo.',
    build: (s, f) => {
      const sales = salesDocs(s, f)
      const purchases = purchaseDocs(s, f)
      const all = [...sales.map((d) => ({ ...d, kind: 'out' })), ...purchases.map((d) => ({ ...d, kind: 'in' }))]
      const ts = timeSeries(all, f.range, [
        { key: 'outTaxable', value: (d) => d.totals.taxable, filter: (d) => d.kind === 'out' },
        { key: 'output', value: (d) => d.totals.gst, filter: (d) => d.kind === 'out' },
        { key: 'inTaxable', value: (d) => d.totals.taxable, filter: (d) => d.kind === 'in' },
        { key: 'input', value: (d) => d.totals.gst, filter: (d) => d.kind === 'in' },
      ], true)
      const rows = ts.data.map((b) => ({ id: b.key, month: b.label, outTaxable: b.outTaxable, output: b.output, inTaxable: b.inTaxable, input: b.input, net: round2(b.output - b.input) }))
      const rateMap = new Map()
      const addRates = (docs, side) =>
        docs.forEach((d) =>
          (d.totals.taxBreakup || []).forEach((t) => {
            const r = rateMap.get(t.rate) || { id: `r${t.rate}`, rate: t.rate, outTaxable: 0, output: 0, inTaxable: 0, input: 0 }
            r[`${side}Taxable`] += t.taxable
            r[side === 'out' ? 'output' : 'input'] += t.tax
            rateMap.set(t.rate, r)
          }),
        )
      addRates(sales, 'out')
      addRates(purchases, 'in')
      const rateRows = [...rateMap.values()].map((r) => ({ ...r, outTaxable: round2(r.outTaxable), output: round2(r.output), inTaxable: round2(r.inTaxable), input: round2(r.input), net: round2(r.output - r.input) })).sort((a, b) => b.rate - a.rate)
      const output = sumK(rows, 'output')
      const input = sumK(rows, 'input')
      const rateCols = [
        col.text('rate', 'GST rate', { render: (r) => `${r.rate}%`, accessor: (r) => r.rate }), col.inr('outTaxable', 'Outward taxable'), col.inr('output', 'Output tax'),
        col.inr('inTaxable', 'Inward taxable'), col.inr('input', 'Input tax'), col.inr('net', 'Net tax'),
      ]
      return {
        summary: [
          { label: 'Output tax', value: inr(output), foot: `On ${inr(sumK(rows, 'outTaxable'))} taxable sales` },
          { label: 'Input tax credit', value: inr(input), foot: `On ${inr(sumK(rows, 'inTaxable'))} taxable purchases` },
          { label: 'Net GST payable', value: inr(output - input) },
          { label: 'Effective ITC ratio', value: pctStr(share(input, output)) },
        ],
        chart: { type: 'bar', title: 'Output tax and input tax by month', data: rows.map((r) => ({ label: r.month, output: r.output, input: r.input })), xKey: 'label', series: [{ key: 'output', name: 'Output tax' }, { key: 'input', name: 'Input tax' }], valueFormat: 'inr' },
        tableTitle: 'Month-wise GST position',
        columns: [
          col.text('month', 'Month', { sortValue: (r) => r.id }), col.inr('outTaxable', 'Outward taxable'), col.inr('output', 'Output tax'), col.inr('inTaxable', 'Inward taxable'), col.inr('input', 'Input tax'),
          col.inr('net', 'Net payable', { render: (r) => <b className={r.net < 0 ? 'text-green' : ''}>{inr(r.net)}</b> }),
        ],
        rows,
        totals: totalsOf(rows, ['outTaxable', 'output', 'inTaxable', 'input', 'net']),
        sections: [{ title: 'Rate-wise GST summary', columns: rateCols, rows: rateRows, totals: totalsOf(rateRows, ['outTaxable', 'output', 'inTaxable', 'input', 'net']) }],
      }
    },
  },
]

/* ------------------------------------------------------------------ */
/* Shared result builders                                              */
/* ------------------------------------------------------------------ */
function ledgerResult(led, range, balanceLabel, linkFor) {
  const rows = [
    { id: 'opening', date: range?.from || '', ref: '', kind: 'Opening balance', debit: 0, credit: 0, balance: led.opening },
    ...led.rows.map((r, i) => ({ ...r, id: `${r.refId}-${i}` })),
  ]
  return {
    summary: [
      { label: 'Opening balance', value: inr(led.opening) },
      { label: 'Debit', value: inr(led.totalDebit) },
      { label: 'Credit', value: inr(led.totalCredit) },
      { label: `Closing balance (${balanceLabel.toLowerCase()})`, value: inr(led.closing) },
    ],
    columns: [
      col.date('date', 'Date', { sortable: false }),
      col.text('ref', 'Reference', { sortable: false, render: (r) => (r.ref ? <DocNo to={linkFor(r)}>{r.ref}</DocNo> : '—') }),
      col.text('kind', 'Particulars', { sortable: false, render: (r) => (r.id === 'opening' ? <b>{r.kind}</b> : r.kind) }),
      col.inr2('debit', 'Debit', { sortable: false, render: (r) => (r.debit ? inr(r.debit) : '—') }),
      col.inr2('credit', 'Credit', { sortable: false, render: (r) => (r.credit ? inr(r.credit) : '—') }),
      col.inr2('balance', 'Balance', { sortable: false, render: (r) => <b>{inr(r.balance)}</b> }),
    ],
    rows,
    totals: { debit: led.totalDebit, credit: led.totalCredit, balance: led.closing },
  }
}

function ageingResult(s, f, type) {
  const isRec = type === 'receivable'
  const rows = outstandingRows(s, type)
    .filter((r) => (isRec ? !f.customer || r.partyId === f.customer : !f.supplier || r.partyId === f.supplier))
    .map((r) => ({
      id: r.invoice.id, partyId: r.partyId, party: r.party?.name, number: r.invoice.number, date: r.invoice.date, dueDate: r.invoice.dueDate,
      amount: r.amount, paid: r.paid, balance: r.balance, days: r.daysOverdue, bucket: ageBucket(r), status: r.status,
    }))
    .filter((r) => !f.status || r.bucket === f.status)
  const buckets = AGEING.map((b) => ({ label: b, value: sumK(rows.filter((r) => r.bucket === b), 'balance') }))
  const overdue = rows.filter((r) => r.days > 0)
  return {
    summary: [
      { label: isRec ? 'Total receivable' : 'Total payable', value: inr(sumK(rows, 'balance')), foot: `${rows.length} open ${isRec ? 'invoices' : 'bills'}` },
      { label: 'Overdue', value: inr(sumK(overdue, 'balance')), foot: `${overdue.length} past due date` },
      { label: 'Over 60 days', value: inr(buckets[3].value + buckets[4].value) },
      { label: 'Not yet due', value: inr(buckets[0].value) },
    ],
    chart: { type: 'bar', title: 'Outstanding by age', data: buckets, xKey: 'label', series: [{ key: 'value', name: 'Outstanding' }], valueFormat: 'inr' },
    columns: [
      col.text('party', isRec ? 'Customer' : 'Supplier', { render: (r) => linkTo(isRec ? `/accounts/customer-ledger?customer=${r.partyId}` : `/accounts/supplier-ledger?supplier=${r.partyId}`, r.party) }),
      col.text('number', isRec ? 'Invoice' : 'Bill', { render: isRec ? invLink : pinvLink }), col.date('date', 'Invoice date'), col.date('dueDate', 'Due date'),
      col.inr2('amount', 'Amount'), col.inr2('paid', 'Paid'), col.inr2('balance', 'Outstanding'),
      col.num('days', 'Days overdue', { render: (r) => (r.days > 0 ? <span className={r.days > 60 ? 'text-red' : 'text-amber'}>{r.days}</span> : '—') }),
      col.text('bucket', 'Ageing', { render: (r) => <StatusBadge status={r.status} /> }),
    ],
    rows,
    totals: totalsOf(rows, ['amount', 'paid', 'balance']),
  }
}

function gstResult(docs, parties, partyKey, partyLabel, linkFn, posFn, side) {
  const rows = docs
    .map((d) => {
      const p = parties.get(d[partyKey])
      return {
        id: d.id, date: d.date, number: d.number, party: p?.name, gstin: p?.gstin, pos: posFn(d, p),
        rates: [...new Set((d.totals.taxBreakup || []).map((t) => `${t.rate}%`))].join(', '),
        taxable: d.totals.taxable, cgst: d.totals.cgst, sgst: d.totals.sgst, igst: d.totals.igst, tax: d.totals.gst, value: d.totals.grandTotal,
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  const rateMap = new Map()
  docs.forEach((d) =>
    (d.totals.taxBreakup || []).forEach((t) => {
      const r = rateMap.get(t.rate) || { id: `r${t.rate}`, rate: t.rate, count: new Set(), taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 }
      r.count.add(d.id)
      r.taxable += t.taxable
      if (d.totals.interState) r.igst += t.tax
      else {
        r.cgst += t.tax / 2
        r.sgst += t.tax / 2
      }
      r.tax += t.tax
      rateMap.set(t.rate, r)
    }),
  )
  const rateRows = [...rateMap.values()].map((r) => ({ ...r, count: r.count.size, taxable: round2(r.taxable), cgst: round2(r.cgst), sgst: round2(r.sgst), igst: round2(r.igst), tax: round2(r.tax) })).sort((a, b) => b.rate - a.rate)
  return {
    summary: [
      { label: 'Taxable value', value: inr(sumK(rows, 'taxable')), foot: `${rows.length} documents` },
      { label: 'CGST', value: inr(sumK(rows, 'cgst')) },
      { label: 'SGST', value: inr(sumK(rows, 'sgst')) },
      { label: 'IGST', value: inr(sumK(rows, 'igst')), foot: `${side} tax ${inr(sumK(rows, 'tax'))}` },
    ],
    tableTitle: `${side} tax register`,
    columns: [
      col.date(), col.text('number', 'Document', { render: linkFn }), col.text('party', partyLabel), col.text('gstin', 'GSTIN', { render: (r) => <span className="mono small">{r.gstin}</span> }),
      col.text('pos', 'Place of supply'), col.text('rates', 'Rate'), col.inr2('taxable', 'Taxable'), col.inr2('cgst', 'CGST'), col.inr2('sgst', 'SGST'), col.inr2('igst', 'IGST'), col.inr2('tax', 'Total tax'), col.inr2('value', 'Invoice value'),
    ],
    rows,
    totals: totalsOf(rows, ['taxable', 'cgst', 'sgst', 'igst', 'tax', 'value']),
    sections: [
      {
        title: 'Rate-wise breakup',
        columns: [col.text('rate', 'GST rate', { render: (r) => `${r.rate}%`, accessor: (r) => r.rate }), col.num('count', 'Documents'), col.inr2('taxable', 'Taxable value'), col.inr2('cgst', 'CGST'), col.inr2('sgst', 'SGST'), col.inr2('igst', 'IGST'), col.inr2('tax', 'Total tax')],
        rows: rateRows,
        totals: totalsOf(rateRows, ['count', 'taxable', 'cgst', 'sgst', 'igst', 'tax']),
      },
    ],
  }
}

export const REPORT_MAP = Object.fromEntries(REPORTS.map((r) => [r.id, r]))
