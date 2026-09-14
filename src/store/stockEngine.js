/**
 * Mock stock & workflow engine (frontend-only).
 *
 * Every stock-affecting document produces "stock moves":
 *   { id, date, itemId, warehouseId, qty (+in / -out), type, ref, sourceType, sourceId }
 * Balances, the stock ledger and valuation are all derived from these moves.
 *
 * syncStatuses() keeps workflow statuses consistent (PO received, SO delivered,
 * production completed...) after any save/delete — a stand-in for server logic.
 */

const mv = (doc, sourceType, idx, fields) => ({
  id: `${doc.id}-${idx}`,
  date: doc.date,
  ref: doc.number || doc.code || '',
  sourceType,
  sourceId: doc.id,
  ...fields,
})

export const STOCK_COLLECTIONS = [
  'items',
  'grns',
  'purchaseInvoices',
  'purchaseReturns',
  'deliveryChallans',
  'salesInvoices',
  'salesReturns',
  'stockIns',
  'stockOuts',
  'stockTransfers',
  'stockAdjustments',
  'materialIssues',
  'productionEntries',
]

export function movesFor(collection, doc) {
  if (!doc || doc.historical) return []
  const lines = doc.lines || []
  switch (collection) {
    case 'items':
      return Number(doc.openingStock) > 0 && doc.warehouseId
        ? [
            {
              id: `${doc.id}-open`,
              date: doc.openingDate || (doc.createdAt || '').slice(0, 10),
              ref: 'Opening Stock',
              sourceType: 'items',
              sourceId: doc.id,
              itemId: doc.id,
              warehouseId: doc.warehouseId,
              qty: Number(doc.openingStock),
              type: 'Opening',
            },
          ]
        : []
    case 'grns':
      return lines
        .filter((l) => Number(l.acceptedQty) > 0)
        .map((l, i) => mv(doc, collection, i, { itemId: l.itemId, warehouseId: doc.warehouseId, qty: Number(l.acceptedQty), type: 'GRN' }))
    case 'purchaseInvoices':
      if (doc.grnId) return []
      return lines.map((l, i) => mv(doc, collection, i, { itemId: l.itemId, warehouseId: doc.warehouseId, qty: Number(l.qty), type: 'Purchase' }))
    case 'purchaseReturns':
      return lines.map((l, i) => mv(doc, collection, i, { itemId: l.itemId, warehouseId: doc.warehouseId, qty: -Number(l.qty), type: 'Purchase Return' }))
    case 'deliveryChallans':
      return lines
        .filter((l) => Number(l.deliveredQty) > 0)
        .map((l, i) => mv(doc, collection, i, { itemId: l.itemId, warehouseId: l.warehouseId || doc.warehouseId, qty: -Number(l.deliveredQty), type: 'Delivery' }))
    case 'salesInvoices':
      if (doc.dcId) return []
      return lines.map((l, i) => mv(doc, collection, i, { itemId: l.itemId, warehouseId: doc.warehouseId, qty: -Number(l.qty), type: 'Sales' }))
    case 'salesReturns':
      return lines.map((l, i) => mv(doc, collection, i, { itemId: l.itemId, warehouseId: doc.warehouseId, qty: Number(l.qty), type: 'Sales Return' }))
    case 'stockIns':
      return [mv(doc, collection, 0, { itemId: doc.itemId, warehouseId: doc.warehouseId, qty: Number(doc.qty), type: 'Stock In' })]
    case 'stockOuts':
      return [mv(doc, collection, 0, { itemId: doc.itemId, warehouseId: doc.warehouseId, qty: -Number(doc.qty), type: 'Stock Out' })]
    case 'stockTransfers':
      return lines.flatMap((l, i) => [
        mv(doc, collection, `${i}o`, { itemId: l.itemId, warehouseId: doc.fromWarehouseId, qty: -Number(l.qty), type: 'Transfer Out' }),
        mv(doc, collection, `${i}i`, { itemId: l.itemId, warehouseId: doc.toWarehouseId, qty: Number(l.qty), type: 'Transfer In' }),
      ])
    case 'stockAdjustments':
      return Number(doc.difference)
        ? [mv(doc, collection, 0, { itemId: doc.itemId, warehouseId: doc.warehouseId, qty: Number(doc.difference), type: 'Adjustment' })]
        : []
    case 'materialIssues':
      return lines
        .filter((l) => Number(l.issuedQty) > 0)
        .map((l, i) => mv(doc, collection, i, { itemId: l.itemId, warehouseId: doc.warehouseId, qty: -Number(l.issuedQty), type: 'Material Issue' }))
    case 'productionEntries': {
      const good = (Number(doc.producedQty) || 0) - (Number(doc.rejectedQty) || 0)
      return good > 0
        ? [mv(doc, collection, 0, { itemId: doc.productId, warehouseId: doc.warehouseId, qty: good, type: 'Production' })]
        : []
    }
    default:
      return []
  }
}

/** Replace the moves of one document inside a moves array. */
export function replaceMoves(moves, collection, doc, removeOnly = false) {
  if (!STOCK_COLLECTIONS.includes(collection)) return moves
  const kept = moves.filter((m) => m.sourceId !== doc.id)
  return removeOnly ? kept : kept.concat(movesFor(collection, doc))
}

export function rebuildAllMoves(state) {
  const moves = []
  STOCK_COLLECTIONS.forEach((c) => (state[c] || []).forEach((d) => moves.push(...movesFor(c, d))))
  return moves
}

/* ---------------- Workflow status sync ---------------- */

const sumBy = (list, key, fn) => {
  const map = {}
  list.forEach((x) => {
    const k = x[key]
    if (!k) return
    map[k] = (map[k] || 0) + fn(x)
  })
  return map
}

const setIfChanged = (list, fn) => {
  let changed = false
  const next = list.map((r) => {
    const s = fn(r)
    if (s && s !== r.status) {
      changed = true
      return { ...r, status: s }
    }
    return r
  })
  return changed ? next : list
}

export function syncStatuses(state) {
  const s = { ...state }

  // Purchase Orders ← GRNs
  const receivedByPoItem = {}
  s.grns.forEach((g) => {
    if (!g.poId) return
    ;(g.lines || []).forEach((l) => {
      const k = `${g.poId}|${l.itemId}`
      receivedByPoItem[k] = (receivedByPoItem[k] || 0) + (Number(l.receivedQty) || 0)
    })
  })
  s.purchaseOrders = setIfChanged(s.purchaseOrders, (po) => {
    if (['Draft', 'Cancelled'].includes(po.status)) return null
    const lines = po.lines || []
    const got = lines.map((l) => receivedByPoItem[`${po.id}|${l.itemId}`] || 0)
    if (!got.some((q) => q > 0)) return ['Partially Received', 'Received'].includes(po.status) ? 'Approved' : null
    return lines.every((l, i) => got[i] >= Number(l.qty)) ? 'Received' : 'Partially Received'
  })

  // Requisitions ← POs
  const convertedPr = new Set(s.purchaseOrders.filter((p) => p.prId).map((p) => p.prId))
  s.purchaseRequisitions = setIfChanged(s.purchaseRequisitions, (pr) => (convertedPr.has(pr.id) ? 'Converted' : null))

  // Quotations ← Sales Orders
  const convertedQt = new Set(s.salesOrders.filter((o) => o.quotationId).map((o) => o.quotationId))
  s.quotations = setIfChanged(s.quotations, (q) => (convertedQt.has(q.id) ? 'Converted' : null))

  // Sales Orders ← Challans / Invoices
  const deliveredBySoItem = {}
  s.deliveryChallans.forEach((dc) => {
    if (!dc.soId) return
    ;(dc.lines || []).forEach((l) => {
      const k = `${dc.soId}|${l.itemId}`
      deliveredBySoItem[k] = (deliveredBySoItem[k] || 0) + (Number(l.deliveredQty) || 0)
    })
  })
  const invoicedSo = new Set(s.salesInvoices.filter((i) => i.soId).map((i) => i.soId))
  s.salesOrders = setIfChanged(s.salesOrders, (so) => {
    if (so.status === 'Cancelled') return null
    const lines = so.lines || []
    const got = lines.map((l) => deliveredBySoItem[`${so.id}|${l.itemId}`] || 0)
    const full = lines.length > 0 && lines.every((l, i) => got[i] >= Number(l.qty))
    if (invoicedSo.has(so.id) && (full || !got.some((q) => q > 0))) return 'Invoiced'
    if (full) return 'Delivered'
    if (got.some((q) => q > 0)) return 'Partially Delivered'
    return ['Partially Delivered', 'Delivered', 'Invoiced'].includes(so.status) ? 'Confirmed' : null
  })

  // Challans ← Invoices
  const invoicedDc = new Set(s.salesInvoices.filter((i) => i.dcId).map((i) => i.dcId))
  s.deliveryChallans = setIfChanged(s.deliveryChallans, (dc) =>
    invoicedDc.has(dc.id) ? 'Invoiced' : dc.status === 'Invoiced' ? 'Delivered' : null,
  )

  // Production Orders ← Issues / Entries
  const produced = sumBy(s.productionEntries, 'productionOrderId', (e) => Number(e.producedQty) || 0)
  const issued = new Set(s.materialIssues.map((m) => m.productionOrderId))
  s.productionOrders = setIfChanged(s.productionOrders, (po) => {
    if (po.status === 'Cancelled') return null
    const p = produced[po.id] || 0
    if (p >= Number(po.plannedQty) && p > 0) return 'Completed'
    if (p > 0 || issued.has(po.id)) return 'In Progress'
    return ['In Progress', 'Completed'].includes(po.status) ? 'Released' : null
  })

  return s
}
