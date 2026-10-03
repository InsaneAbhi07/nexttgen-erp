/**
 * Derived data for the mock ERP (stock balances, outstanding, ledgers, costing).
 * All computed in the browser from the local state. Results are cached per
 * array identity (state is immutable), so calling them in render is cheap.
 */
import { daysBetween, today } from '../utils/format.js'
import { round2 } from '../utils/calc.js'

const cache = new WeakMap()
const memo = (key, obj, fn) => {
  let entry = cache.get(obj)
  if (!entry) {
    entry = {}
    cache.set(obj, entry)
  }
  if (!(key in entry)) entry[key] = fn()
  return entry[key]
}

/* ---------------- Lookups ---------------- */
export const byId = (list = []) => memo('byId', list, () => new Map(list.map((r) => [r.id, r])))

export const partyName = (state, type, id) => {
  const list = type === 'supplier' ? state.suppliers : state.customers
  return byId(list).get(id)?.name || '—'
}

/* ---------------- Stock ---------------- */

/** Map "itemId|warehouseId" → qty, plus "itemId" → total qty */
export const stockBalances = (state) =>
  memo('balances', state.stockMoves, () => {
    const map = new Map()
    state.stockMoves.forEach((m) => {
      const k = `${m.itemId}|${m.warehouseId}`
      map.set(k, (map.get(k) || 0) + m.qty)
      map.set(m.itemId, (map.get(m.itemId) || 0) + m.qty)
    })
    return map
  })

export const itemStock = (state, itemId, warehouseId) => {
  const map = stockBalances(state)
  return round2(map.get(warehouseId ? `${itemId}|${warehouseId}` : itemId) || 0)
}

/**
 * Stock summary rows — one per item × warehouse with movement.
 * opening = before `from`; inward/outward within [from, to]; balance = end of `to`.
 */
export const stockSummary = (state, { from, to, warehouseId } = {}) => {
  const items = byId(state.items)
  const rows = new Map()
  state.stockMoves.forEach((m) => {
    if (warehouseId && m.warehouseId !== warehouseId) return
    if (to && m.date > to) return
    const k = `${m.itemId}|${m.warehouseId}`
    if (!rows.has(k)) rows.set(k, { key: k, itemId: m.itemId, warehouseId: m.warehouseId, opening: 0, inward: 0, outward: 0, balance: 0 })
    const r = rows.get(k)
    const isOpening = m.type === 'Opening' && !from
    if ((from && m.date < from) || isOpening) r.opening += m.qty
    else if (m.qty >= 0) r.inward += m.qty
    else r.outward += -m.qty
    r.balance += m.qty
  })
  return [...rows.values()]
    .filter((r) => items.has(r.itemId))
    .map((r) => {
      const item = items.get(r.itemId)
      return {
        ...r,
        opening: round2(r.opening),
        inward: round2(r.inward),
        outward: round2(r.outward),
        balance: round2(r.balance),
        item,
        value: round2(r.balance * (Number(item.purchaseRate) || 0)),
      }
    })
}

export const stockValue = (state) =>
  memo('stockValue', state.stockMoves, () => {
    const items = byId(state.items)
    let total = 0
    state.stockMoves.forEach((m) => {
      total += m.qty * (Number(items.get(m.itemId)?.purchaseRate) || 0)
    })
    return Math.round(total)
  })

/** Items at or below minimum stock (includes out-of-stock). */
export const lowStockItems = (state) =>
  state.items
    .filter((i) => i.status !== 'Inactive' && Number(i.minStock) > 0)
    .map((i) => ({ item: i, balance: itemStock(state, i.id), minStock: Number(i.minStock) }))
    .filter((r) => r.balance <= r.minStock)
    .sort((a, b) => a.balance / a.minStock - b.balance / b.minStock)

/** Stock ledger rows with running balance for an item (optionally one warehouse). */
export const stockLedger = (state, { itemId, warehouseId, from, to, type } = {}) => {
  const moves = state.stockMoves
    .filter((m) => (!itemId || m.itemId === itemId) && (!warehouseId || m.warehouseId === warehouseId))
    .sort((a, b) => (a.date === b.date ? (a.type === 'Opening' ? -1 : 0) : a.date < b.date ? -1 : 1))
  let balance = 0
  const rows = []
  let opening = 0
  moves.forEach((m) => {
    if (from && m.date < from) {
      opening += m.qty
      balance += m.qty
      return
    }
    if (to && m.date > to) return
    balance += m.qty
    if (type && m.type !== type) return
    rows.push({ ...m, in: m.qty > 0 ? m.qty : 0, out: m.qty < 0 ? -m.qty : 0, balance: round2(balance) })
  })
  return { opening: round2(opening), rows }
}

/* ---------------- Workflow progress ---------------- */
export const poReceivedQty = (state, poId) => {
  const map = {}
  state.grns.filter((g) => g.poId === poId).forEach((g) =>
    g.lines.forEach((l) => {
      map[l.itemId] = (map[l.itemId] || 0) + (Number(l.receivedQty) || 0)
    }),
  )
  return map
}

export const soDeliveredQty = (state, soId) => {
  const map = {}
  state.deliveryChallans.filter((d) => d.soId === soId).forEach((d) =>
    d.lines.forEach((l) => {
      map[l.itemId] = (map[l.itemId] || 0) + (Number(l.deliveredQty) || 0)
    }),
  )
  return map
}

export const productionProgress = (state, productionOrderId) => {
  const entries = state.productionEntries.filter((e) => e.productionOrderId === productionOrderId)
  const produced = entries.reduce((a, e) => a + (Number(e.producedQty) || 0), 0)
  const rejected = entries.reduce((a, e) => a + (Number(e.rejectedQty) || 0), 0)
  const issuedMap = {}
  state.materialIssues.filter((m) => m.productionOrderId === productionOrderId).forEach((m) =>
    m.lines.forEach((l) => {
      issuedMap[l.itemId] = (issuedMap[l.itemId] || 0) + (Number(l.issuedQty) || 0)
    }),
  )
  return { produced, rejected, good: produced - rejected, entries, issued: issuedMap }
}

/** Required materials for a BOM × quantity with availability in a warehouse. */
export const requiredMaterials = (state, bomId, qty, warehouseId) => {
  const bom = byId(state.boms).get(bomId)
  if (!bom) return []
  const items = byId(state.items)
  const factor = (Number(qty) || 0) / (Number(bom.outputQty) || 1)
  return bom.components.map((c) => {
    const required = round2(Number(c.qty) * factor)
    const available = itemStock(state, c.itemId, warehouseId)
    return {
      itemId: c.itemId,
      item: items.get(c.itemId),
      unit: c.unit || items.get(c.itemId)?.unit,
      perUnit: Number(c.qty),
      rate: Number(c.rate) || Number(items.get(c.itemId)?.purchaseRate) || 0,
      required,
      available,
      shortage: round2(Math.max(0, required - available)),
    }
  })
}

/** Production costing for one production order. */
export const productionCosting = (state, order) => {
  const items = byId(state.items)
  const prog = productionProgress(state, order.id)
  const rawMaterialCost = round2(
    Object.entries(prog.issued).reduce((a, [itemId, q]) => a + q * (Number(items.get(itemId)?.purchaseRate) || 0), 0),
  )
  const labourCost = prog.entries.reduce((a, e) => a + (Number(e.labourCost) || 0), 0)
  const freightCost = prog.entries.reduce((a, e) => a + (Number(e.freightCost) || 0), 0)
  const otherCost = prog.entries.reduce((a, e) => a + (Number(e.otherCost) || 0), 0)
  const totalCost = round2(rawMaterialCost + labourCost + freightCost + otherCost)
  const good = prog.good
  const costPerUnit = good > 0 ? round2(totalCost / good) : 0
  const product = items.get(order.productId)
  const sellingPrice = Number(product?.salesRate) || 0
  const margin = sellingPrice > 0 && costPerUnit > 0 ? round2(((sellingPrice - costPerUnit) / sellingPrice) * 100) : 0
  return { rawMaterialCost, labourCost, freightCost, otherCost, totalCost, good, produced: prog.produced, rejected: prog.rejected, costPerUnit, sellingPrice, margin, product }
}

/* ---------------- Receivables / payables ---------------- */

const paidMap = (list, returns) => {
  const map = {}
  list.forEach((p) => {
    if (p.invoiceId) map[p.invoiceId] = (map[p.invoiceId] || 0) + (Number(p.amount) || 0)
  })
  returns.forEach((r) => {
    if (r.invoiceId) map[r.invoiceId] = (map[r.invoiceId] || 0) + (Number(r.amount) || 0)
  })
  return map
}

const memo2 = (key, a, b, fn) => {
  const inner = memo(key, a, () => new WeakMap())
  if (!inner.has(b)) inner.set(b, fn())
  return inner.get(b)
}

export const salesPaidMap = (state) => memo2('paid', state.receipts, state.salesReturns, () => paidMap(state.receipts, state.salesReturns))
export const purchasePaidMap = (state) => memo2('paid', state.payments, state.purchaseReturns, () => paidMap(state.payments, state.purchaseReturns))

const invoiceStatus = (inv, paid, asOf = today()) => {
  const amount = Number(inv.totals?.grandTotal) || 0
  const balance = round2(Math.max(0, amount - paid))
  const overdueDays = inv.dueDate ? daysBetween(inv.dueDate, asOf) : 0
  let status = 'Unpaid'
  if (balance <= 0.5) status = 'Paid'
  else if (overdueDays > 0) status = 'Overdue'
  else if (paid > 0) status = 'Partially Paid'
  return { amount, paid: round2(Math.min(paid, amount)), balance: status === 'Paid' ? 0 : balance, status, daysOverdue: status === 'Paid' ? 0 : Math.max(0, overdueDays) }
}

export const salesInvoiceStatus = (state, inv) => invoiceStatus(inv, salesPaidMap(state)[inv.id] || 0)
export const purchaseInvoiceStatus = (state, inv) => invoiceStatus(inv, purchasePaidMap(state)[inv.id] || 0)

/** Outstanding rows (only invoices with balance > 0). type: 'receivable' | 'payable' */
export const outstandingRows = (state, type = 'receivable') => {
  const isRec = type === 'receivable'
  const invoices = isRec ? state.salesInvoices : state.purchaseInvoices
  const parties = byId(isRec ? state.customers : state.suppliers)
  return invoices
    .map((inv) => {
      const st = isRec ? salesInvoiceStatus(state, inv) : purchaseInvoiceStatus(state, inv)
      const partyId = isRec ? inv.customerId : inv.supplierId
      return { invoice: inv, partyId, party: parties.get(partyId), ...st }
    })
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
}

export const totalReceivables = (state) => Math.round(outstandingRows(state, 'receivable').reduce((a, r) => a + r.balance, 0))
export const totalPayables = (state) => Math.round(outstandingRows(state, 'payable').reduce((a, r) => a + r.balance, 0))

/**
 * Customer ledger: debit = invoices, credit = receipts & returns. Balance = receivable.
 */
export const customerLedger = (state, customerId, { from, to } = {}) => {
  const customer = byId(state.customers).get(customerId)
  const entries = [
    ...state.salesInvoices.filter((i) => i.customerId === customerId).map((i) => ({ date: i.date, ref: i.number, refId: i.id, kind: 'Sales Invoice', debit: i.totals.grandTotal, credit: 0 })),
    ...state.receipts.filter((r) => r.customerId === customerId).map((r) => ({ date: r.date, ref: r.number, refId: r.id, kind: `Receipt (${r.mode})`, debit: 0, credit: Number(r.amount) })),
    ...state.salesReturns.filter((r) => r.customerId === customerId).map((r) => ({ date: r.date, ref: r.number, refId: r.id, kind: 'Sales Return', debit: 0, credit: Number(r.amount) })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.debit ? -1 : 1))
  return buildLedger(Number(customer?.openingBalance) || 0, entries, from, to, 'debit')
}

/**
 * Supplier ledger: credit = purchase invoices, debit = payments & returns. Balance = payable.
 */
export const supplierLedger = (state, supplierId, { from, to } = {}) => {
  const supplier = byId(state.suppliers).get(supplierId)
  const entries = [
    ...state.purchaseInvoices.filter((i) => i.supplierId === supplierId).map((i) => ({ date: i.date, ref: i.number, refId: i.id, kind: 'Purchase Invoice', debit: 0, credit: i.totals.grandTotal })),
    ...state.payments.filter((p) => p.supplierId === supplierId).map((p) => ({ date: p.date, ref: p.number, refId: p.id, kind: `Payment (${p.mode})`, debit: Number(p.amount), credit: 0 })),
    ...state.purchaseReturns.filter((r) => r.supplierId === supplierId).map((r) => ({ date: r.date, ref: r.number, refId: r.id, kind: 'Purchase Return', debit: Number(r.amount), credit: 0 })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.credit ? -1 : 1))
  return buildLedger(Number(supplier?.openingBalance) || 0, entries, from, to, 'credit')
}

function buildLedger(openingBalance, entries, from, to, nature) {
  const sign = (e) => (nature === 'debit' ? e.debit - e.credit : e.credit - e.debit)
  let balance = openingBalance
  const rows = []
  entries.forEach((e) => {
    if (from && e.date < from) {
      balance += sign(e)
      return
    }
    if (to && e.date > to) return
    rows.push(e)
  })
  const opening = round2(balance)
  const out = rows.map((e) => {
    balance += sign(e)
    return { ...e, balance: round2(balance) }
  })
  const totalDebit = round2(rows.reduce((a, e) => a + e.debit, 0))
  const totalCredit = round2(rows.reduce((a, e) => a + e.credit, 0))
  return { opening, rows: out, totalDebit, totalCredit, closing: round2(balance) }
}

/* ---------------- Cash / bank ---------------- */
/** Salary paid out of cash / bank accounts, one row per account per paid salary sheet. */
export const salaryPayouts = (state) =>
  (state.payrollRuns || [])
    .filter((r) => r.status === 'Paid')
    .flatMap((r) => (r.disbursements || []).map((d, i) => ({ id: `${r.id}-${i}`, runId: r.id, number: r.number, month: r.month, date: r.paidOn, accountId: d.accountId, amount: d.amount, createdAt: r.updatedAt || r.createdAt })))

export const cashBankSummary = (state, { from, to } = {}) => {
  const accounts = state.settings.accounts || []
  return accounts.map((acc) => {
    const inRange = (d) => (!from || d >= from) && (!to || d <= to)
    const rec = state.receipts.filter((r) => r.accountId === acc.id)
    const pay = [...state.payments.filter((p) => p.accountId === acc.id), ...salaryPayouts(state).filter((p) => p.accountId === acc.id)]
    const before = (list) => list.filter((x) => from && x.date < from).reduce((a, x) => a + Number(x.amount), 0)
    const within = (list) => list.filter((x) => inRange(x.date)).reduce((a, x) => a + Number(x.amount), 0)
    const opening = Number(acc.openingBalance) + before(rec) - before(pay)
    const receipts = within(rec)
    const payments = within(pay)
    return { account: acc, opening: round2(opening), receipts: round2(receipts), payments: round2(payments), closing: round2(opening + receipts - payments) }
  })
}

/* ---------------- Period helpers for dashboards / reports ---------------- */
export const sumInRange = (list, from, to, fn = (x) => x.totals?.grandTotal) =>
  Math.round(list.filter((x) => (!from || x.date >= from) && (!to || x.date <= to)).reduce((a, x) => a + (Number(fn(x)) || 0), 0))
