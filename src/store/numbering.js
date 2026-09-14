/**
 * Document numbering — Indian financial year (April–March) series.
 * Example: PO/26-27/0143
 */
import { COLLECTIONS } from './collections.js'

export const financialYear = (iso) => {
  const d = iso ? new Date(`${iso.slice(0, 10)}T00:00:00`) : new Date()
  const y = d.getFullYear() % 100
  const start = d.getMonth() >= 3 ? y : y - 1
  return `${String(start).padStart(2, '0')}-${String((start + 1) % 100).padStart(2, '0')}`
}

export const formatDocNumber = (prefix, dateIso, seq) =>
  `${prefix}/${financialYear(dateIso)}/${String(seq).padStart(4, '0')}`

/** Next number for a collection based on existing records in the same FY. */
export const nextDocNumber = (state, collection, dateIso) => {
  const meta = COLLECTIONS[collection]
  const prefix = collection === 'salesInvoices' ? state.settings?.invoice?.prefix || meta.prefix : meta?.prefix
  if (!prefix) return ''
  const fy = financialYear(dateIso)
  const head = `${prefix}/${fy}/`
  let max = 0
  ;(state[collection] || []).forEach((r) => {
    if (typeof r.number === 'string' && r.number.startsWith(head)) {
      const n = parseInt(r.number.slice(head.length), 10)
      if (n > max) max = n
    }
  })
  return `${head}${String(max + 1).padStart(4, '0')}`
}

/** Next master code such as CUS-0019 or FG-1015 */
export const nextCode = (list, prefix, pad = 4) => {
  let max = 0
  list.forEach((r) => {
    if (typeof r.code === 'string' && r.code.startsWith(`${prefix}-`)) {
      const n = parseInt(r.code.slice(prefix.length + 1), 10)
      if (n > max) max = n
    }
  })
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`
}

export const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
