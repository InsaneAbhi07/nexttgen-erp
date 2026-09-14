/**
 * Document calculations (line totals, discount, GST split).
 * Pure functions — used by forms, previews, the mock store and seed data.
 */

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

/**
 * Calculate a single line.
 * line: { qty, rate, discount (%), gst (%) }
 */
export const calcLine = (line) => {
  const qty = Number(line.qty) || 0
  const rate = Number(line.rate) || 0
  const discountPct = Number(line.discount) || 0
  const gstPct = Number(line.gst) || 0
  const gross = qty * rate
  const discountAmt = round2((gross * discountPct) / 100)
  const taxable = round2(gross - discountAmt)
  const gstAmt = round2((taxable * gstPct) / 100)
  return { gross: round2(gross), discountAmt, taxable, gstAmt, total: round2(taxable + gstAmt) }
}

/**
 * Calculate document totals.
 * @param {Array} lines
 * @param {Object} opts { interState: boolean } — IGST when true, CGST+SGST otherwise
 */
export const calcTotals = (lines = [], { interState = false } = {}) => {
  let subtotal = 0
  let discount = 0
  let taxable = 0
  let gst = 0
  const taxByRate = {}
  lines.forEach((l) => {
    const c = calcLine(l)
    subtotal += c.gross
    discount += c.discountAmt
    taxable += c.taxable
    gst += c.gstAmt
    const key = Number(l.gst) || 0
    if (!taxByRate[key]) taxByRate[key] = { rate: key, taxable: 0, tax: 0 }
    taxByRate[key].taxable += c.taxable
    taxByRate[key].tax += c.gstAmt
  })
  gst = round2(gst)
  const cgst = interState ? 0 : round2(gst / 2)
  const sgst = interState ? 0 : round2(gst - cgst)
  const igst = interState ? gst : 0
  const exact = taxable + gst
  const grandTotal = Math.round(exact)
  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    taxable: round2(taxable),
    gst,
    cgst,
    sgst,
    igst,
    roundOff: round2(grandTotal - exact),
    grandTotal,
    taxBreakup: Object.values(taxByRate).map((t) => ({ ...t, taxable: round2(t.taxable), tax: round2(t.tax) })),
    interState,
  }
}

/** Company is in Uttar Pradesh (09). Other states → IGST. */
export const isInterState = (partyState, companyState = 'Uttar Pradesh') =>
  Boolean(partyState) && partyState !== companyState

export const sum = (arr, fn = (x) => x) => arr.reduce((acc, x) => acc + (Number(fn(x)) || 0), 0)
