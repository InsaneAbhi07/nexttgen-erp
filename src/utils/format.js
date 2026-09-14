/**
 * Formatting helpers — Indian number system, ₹ currency, dates.
 * NexttGen ERP frontend-only demo.
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})
const inrFormatter2 = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const numFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

/** ₹4,85,000 */
export const inr = (value) => inrFormatter.format(Number(value) || 0)

/** ₹4,85,000.00 */
export const inr2 = (value) => inrFormatter2.format(Number(value) || 0)

/** 2,450 */
export const num = (value) => numFormatter.format(Number(value) || 0)

/** Compact INR for charts/cards: ₹18.4 L, ₹1.2 Cr */
export const inrCompact = (value) => {
  const v = Number(value) || 0
  const abs = Math.abs(v)
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(1)} K`
  return `₹${Math.round(v)}`
}

export const pct = (value, digits = 1) => `${(Number(value) || 0).toFixed(digits)}%`

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** 14 Sep 2026 */
export const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** 14 Sep 2026, 10:42 AM */
export const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${fmtDate(toISODate(d))}, ${h12}:${m} ${ampm}`
}

/** "5 min ago", "3 h ago", "2 days ago" */
export const timeAgo = (iso) => {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return fmtDate(iso)
}

export const monthLabel = (date) => {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00`) : date
  return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

/** Local YYYY-MM-DD (avoids UTC shift) */
export const toISODate = (d = new Date()) => {
  const dt = d instanceof Date ? d : new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export const today = () => toISODate(new Date())

export const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export const daysBetween = (fromIso, toIso) => {
  const a = new Date(`${fromIso}T00:00:00`)
  const b = new Date(`${toIso}T00:00:00`)
  return Math.round((b - a) / 86400000)
}

export const initials = (name = '') =>
  name
    .replace(/[^A-Za-z ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')

/* ----- Amount in words (Indian system) ----- */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

const twoDigits = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`)
const threeDigits = (n) => {
  const h = Math.floor(n / 100)
  const rest = n % 100
  return [h ? `${ONES[h]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ')
}

export const amountInWords = (amount) => {
  const value = Math.abs(Number(amount) || 0)
  let rupees = Math.floor(value)
  const paise = Math.round((value - rupees) * 100)
  if (rupees === 0 && paise === 0) return 'Rupees Zero Only'
  const parts = []
  const crore = Math.floor(rupees / 1e7)
  rupees %= 1e7
  const lakh = Math.floor(rupees / 1e5)
  rupees %= 1e5
  const thousand = Math.floor(rupees / 1e3)
  rupees %= 1e3
  if (crore) parts.push(`${threeDigits(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (rupees) parts.push(threeDigits(rupees))
  let words = `Rupees ${parts.join(' ')}`
  if (paise) words += ` and ${twoDigits(paise)} Paise`
  return `${words} Only`
}
