/**
 * Inventory module helpers (frontend-only demo).
 */
import { presetRange } from '../../components/ui/index.js'
import { Badge } from '../../components/ui/index.js'

export const INV_CRUMB = { label: 'Inventory', to: '/inventory/stock' }

export const stockStatus = (balance, minStock) => {
  if (balance <= 0) return 'Out of Stock'
  if (Number(minStock) > 0 && balance <= Number(minStock)) return 'Low Stock'
  return 'In Stock'
}

export const warehouseOptions = (state, includeInactive = false) =>
  state.warehouses.filter((w) => includeInactive || w.status === 'Active').map((w) => ({ value: w.id, label: w.name }))

export const itemOptions = (state, filter) =>
  state.items
    .filter((i) => i.status !== 'Inactive' && (!filter || filter(i)))
    .map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))

export const monthRange = () => presetRange('month')

export const inMonth = (date) => {
  const r = monthRange()
  return date >= r.from && date <= r.to
}

export const TRANSACTION_TYPES = [
  'Opening', 'GRN', 'Purchase', 'Purchase Return', 'Delivery', 'Sales', 'Sales Return',
  'Stock In', 'Stock Out', 'Transfer In', 'Transfer Out', 'Adjustment', 'Material Issue', 'Production',
]

export const ADJUSTMENT_REASONS = [
  'Physical verification variance',
  'Damaged units written off',
  'Counting error corrected',
  'Theft or loss',
  'Unit conversion correction',
  'Weighing scale calibration difference',
  'Other',
]

export function MoveBadge({ type, qty }) {
  let tone = qty >= 0 ? 'green' : 'red'
  if (type === 'Opening') tone = 'gray'
  else if (type === 'Adjustment') tone = 'amber'
  else if (type.startsWith('Transfer')) tone = 'blue'
  else if (type === 'Production') tone = 'brass'
  else if (type === 'Material Issue') tone = 'violet'
  return <Badge tone={tone}>{type}</Badge>
}

export function ItemCell({ item, sub }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="cell-primary">{item?.name || '—'}</div>
      <div className="cell-secondary">{sub ?? item?.code}</div>
    </div>
  )
}
