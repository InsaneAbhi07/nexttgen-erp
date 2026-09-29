/**
 * Lock & handle manufacturing helpers (frontend-only demo).
 * Shared by process stages (routing / WIP), job work, QC and product variants.
 * Everything is derived in the browser from the mock store.
 */
import { byId } from './selectors.js'
import { round2 } from '../utils/calc.js'

const sum = (list, fn) => list.reduce((a, x) => a + (Number(fn(x)) || 0), 0)

/* ------------------------------------------------------------------ */
/* Process routing & stage-wise WIP                                    */
/* ------------------------------------------------------------------ */

/** Active process route for a product, if any. */
export const routingFor = (state, productId) => (state.routings || []).find((r) => r.productId === productId && r.status === 'Active')

/**
 * Stage-wise progress for a production order.
 * Each stage receives the OK output of the previous stage (first stage: planned qty).
 *   ok        – pieces passed on to the next stage
 *   rejected  – pieces scrapped at this stage
 *   rework    – pieces sent back for rework (still sitting at this stage)
 *   waiting   – input received but not yet processed (WIP at this stage)
 */
export function stageProgress(state, order) {
  const routing = routingFor(state, order.productId)
  const ops = routing?.operations || []
  const entries = (state.stageEntries || []).filter((e) => e.productionOrderId === order.id)
  let prevOk = Number(order.plannedQty) || 0
  return ops.map((op, index) => {
    const list = entries.filter((e) => e.stage === op.stage).sort((a, b) => (a.date < b.date ? 1 : -1))
    const ok = sum(list, (e) => e.okQty)
    const rejected = sum(list, (e) => e.rejectedQty)
    const rework = sum(list, (e) => e.reworkQty)
    const input = prevOk
    const waiting = Math.max(0, input - ok - rejected)
    prevOk = ok
    return {
      ...op,
      index,
      input,
      ok,
      rejected,
      rework,
      waiting,
      entries: list,
      done: input > 0 && waiting === 0 && ok + rejected > 0,
      pct: order.plannedQty ? Math.min(100, (ok / order.plannedQty) * 100) : 0,
    }
  })
}

/** Index of the first stage that still has work (or the last stage when everything is done). */
export const currentStageIndex = (progress) => {
  if (!progress.length) return -1
  const i = progress.findIndex((p) => p.waiting > 0 || p.ok + p.rejected === 0)
  return i === -1 ? progress.length - 1 : i
}

export const OPEN_FOR_WIP = ['Released', 'In Progress']

/** WIP board rows: every open order with its stage-wise progress. */
export function wipBoard(state) {
  const items = byId(state.items)
  return state.productionOrders
    .filter((o) => OPEN_FOR_WIP.includes(o.status))
    .map((o) => {
      const progress = stageProgress(state, o)
      return { order: o, product: items.get(o.productId), progress, current: currentStageIndex(progress) }
    })
    .filter((r) => r.progress.length)
}

/* ------------------------------------------------------------------ */
/* Job work                                                            */
/* ------------------------------------------------------------------ */

/** Line-wise balance of a job work challan. */
export function jobWorkBalance(state, jwo) {
  const receipts = (state.jobWorkReceipts || []).filter((r) => r.jobWorkOrderId === jwo.id).sort((a, b) => (a.date < b.date ? -1 : 1))
  const lines = (jwo.lines || []).map((l) => {
    const rl = receipts.flatMap((r) => r.lines.filter((x) => x.itemId === l.itemId))
    const received = sum(rl, (x) => x.receivedQty)
    const rejected = sum(rl, (x) => x.rejectedQty)
    const pending = jwo.status === 'Closed' ? 0 : Math.max(0, round2(Number(l.qty) - received - rejected))
    return { ...l, received, rejected, pending, charge: round2(received * (Number(l.rate) || 0)) }
  })
  return {
    receipts,
    lines,
    sent: sum(lines, (l) => l.qty),
    received: sum(lines, (l) => l.received),
    rejected: sum(lines, (l) => l.rejected),
    pending: sum(lines, (l) => l.pending),
    charges: round2(sum(lines, (l) => l.charge)),
  }
}

export const isJobWorker = (s) => Boolean(s?.jobWorker)

/* ------------------------------------------------------------------ */
/* Quality control                                                     */
/* ------------------------------------------------------------------ */

export const QC_PLANS = {
  Lock: {
    name: 'Lock final inspection',
    checks: [
      ['Key operation (10 cycles)', 'Smooth, no jamming'],
      ['Latch / bolt throw', '≥ 15 mm'],
      ['Keys per lock & key differs', '3 keys, unique combination'],
      ['Plating thickness', '≥ 8 µm'],
      ['Salt spray test (sample)', '48 h, no red rust'],
      ['Finish & appearance', 'No scratches or dents'],
    ],
  },
  Handle: {
    name: 'Handle / fitting final inspection',
    checks: [
      ['Length & hole centres', '± 0.5 mm of drawing'],
      ['Plating adhesion (tape test)', 'No peel-off'],
      ['Finish & shade', 'Matches master sample'],
      ['Screw hole threads', 'Go / No-go gauge pass'],
      ['Load test (sample)', '25 kg pull, no bend'],
    ],
  },
  'Raw Material': {
    name: 'Incoming material inspection',
    checks: [
      ['Test certificate', 'Received, grade as per PO'],
      ['Dimensions', 'As per drawing'],
      ['Hardness / grade', 'As per specification'],
      ['Surface defects', 'No blow holes, cracks or rust'],
    ],
  },
  Packaging: {
    name: 'Packaging inspection',
    checks: [
      ['Print & colour', 'Matches approved artwork'],
      ['Carton strength', 'Burst ≥ 12 kg/cm²'],
      ['Dimensions', '± 2 mm'],
    ],
  },
  'Job Work': {
    name: 'Job work return inspection',
    checks: [
      ['Plating / finish thickness', '≥ 8 µm'],
      ['Adhesion (bend / tape test)', 'No peel-off'],
      ['Colour / shade', 'Matches master sample'],
      ['Surface defects', 'No pits, burns or patches'],
    ],
  },
  'In-process': {
    name: 'In-process patrol inspection',
    checks: [
      ['First-piece approval', 'Matches drawing & sample'],
      ['Critical dimensions', 'Within tolerance'],
      ['Surface finish', 'No burrs, flash or dents'],
    ],
  },
}

const LOCK_CATEGORIES = ['Door Locks', 'Padlocks']

/** Which QC plan applies. kind: 'Incoming' | 'In-process' | 'Final' | 'Job Work' */
export function qcPlanKey(item, kind) {
  if (kind === 'Job Work') return 'Job Work'
  if (kind === 'In-process') return 'In-process'
  if (!item) return 'Raw Material'
  if (item.type === 'Packaging Material') return 'Packaging'
  if (['Raw Material', 'Consumable', 'Semi Finished'].includes(item.type)) return 'Raw Material'
  if (LOCK_CATEGORIES.includes(item.category) || /lock/i.test(item.name)) return 'Lock'
  return 'Handle'
}

export const qcChecklist = (planKey) => (QC_PLANS[planKey]?.checks || []).map(([parameter, spec], i) => ({ id: `chk-${i + 1}`, parameter, spec, observed: '', result: 'Pass' }))

/**
 * Lots still waiting for inspection:
 *   – GRN lines (last 30 days) with no incoming inspection
 *   – Job work receipts with no inspection
 *   – Production orders that have reached Final QC / completed with no final inspection
 */
export function qcPending(state, sinceIso) {
  const done = new Set((state.qcInspections || []).map((q) => `${q.type}|${q.refId}|${q.itemId}`))
  const out = []
  state.grns
    .filter((g) => !g.historical && (!sinceIso || g.date >= sinceIso))
    .forEach((g) =>
      g.lines.forEach((l) => {
        if (Number(l.receivedQty) > 0 && !done.has(`Incoming|${g.id}|${l.itemId}`))
          out.push({ key: `${g.id}|${l.itemId}`, type: 'Incoming', refCollection: 'grns', refId: g.id, refNumber: g.number, date: g.date, itemId: l.itemId, lotQty: Number(l.receivedQty), supplierId: g.supplierId, link: `/purchase/grn/${g.id}` })
      }),
    )
  ;(state.jobWorkReceipts || [])
    .filter((r) => !sinceIso || r.date >= sinceIso)
    .forEach((r) =>
      r.lines.forEach((l) => {
        const lot = (Number(l.receivedQty) || 0) + (Number(l.rejectedQty) || 0)
        if (lot > 0 && !done.has(`Job Work|${r.id}|${l.itemId}`))
          out.push({ key: `${r.id}|${l.itemId}`, type: 'Job Work', refCollection: 'jobWorkReceipts', refId: r.id, refNumber: r.number, date: r.date, itemId: l.itemId, lotQty: lot, supplierId: r.supplierId, link: `/production/job-work/${r.jobWorkOrderId}` })
      }),
    )
  state.productionOrders
    .filter((o) => !o.historical && ['In Progress', 'Completed'].includes(o.status) && (!sinceIso || o.date >= sinceIso))
    .forEach((o) => {
      if (done.has(`Final|${o.id}|${o.productId}`)) return
      const prog = stageProgress(state, o)
      const qcStage = prog.find((p) => p.stage === 'Final QC')
      const lot = qcStage ? qcStage.input : 0
      if (lot > 0 || o.status === 'Completed')
        out.push({ key: `${o.id}|${o.productId}`, type: 'Final', refCollection: 'productionOrders', refId: o.id, refNumber: o.number, date: o.date, itemId: o.productId, lotQty: lot || Number(o.plannedQty), productionOrderId: o.id, link: `/production/orders/${o.id}` })
    })
  return out.sort((a, b) => (a.date < b.date ? 1 : -1))
}

/** Sample size per a simplified IS 2500 / AQL 2.5 general inspection level II table. */
export function sampleSize(lot) {
  const n = Number(lot) || 0
  if (n <= 8) return n
  if (n <= 15) return 3
  if (n <= 25) return 5
  if (n <= 50) return 8
  if (n <= 90) return 13
  if (n <= 150) return 20
  if (n <= 280) return 32
  if (n <= 500) return 50
  if (n <= 1200) return 80
  if (n <= 3200) return 125
  return 200
}

/* ------------------------------------------------------------------ */
/* Product families & variants                                          */
/* ------------------------------------------------------------------ */

/**
 * Family: { attributes: [{ name: 'Finish', values: ['Stainless Steel', …], adjust: { 'Antique Brass': 15 } }, …],
 *           baseSalesRate, basePurchaseRate, name, … }
 * Variant items carry familyId + attributes { Finish: 'Antique Brass', Size: '8"' }.
 */
export const familyVariants = (state, familyId) => state.items.filter((i) => i.familyId === familyId)

export const variantKey = (attrs = {}) =>
  Object.keys(attrs)
    .sort()
    .map((k) => `${k}=${attrs[k]}`)
    .join('|')

export function variantName(family, attrs) {
  const parts = family.attributes.map((a) => attrs[a.name]).filter(Boolean)
  return `${family.name} ${parts.join(' ')}`.trim()
}

export function variantRates(family, attrs) {
  const factor = family.attributes.reduce((f, a) => f * (1 + (Number(a.adjust?.[attrs[a.name]]) || 0) / 100), 1)
  return {
    salesRate: Math.round((Number(family.baseSalesRate) || 0) * factor),
    purchaseRate: Math.round((Number(family.basePurchaseRate) || 0) * factor),
  }
}

/** Every attribute combination for a family (cartesian product). */
export function allCombinations(family) {
  return family.attributes.reduce((acc, a) => acc.flatMap((c) => (a.values || []).map((v) => ({ ...c, [a.name]: v }))), [{}])
}
