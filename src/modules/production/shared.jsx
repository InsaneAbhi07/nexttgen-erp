/**
 * Production module helpers (frontend-only demo).
 */
import { Check, FileQuestion } from 'lucide-react'
import { Button, EmptyState } from '../../components/ui/index.js'
import { round2 } from '../../utils/calc.js'

export const CRUMB = { label: 'Production', to: '/production/orders' }
export const COMPONENT_TYPES = ['Raw Material', 'Packaging Material', 'Consumable', 'Semi Finished']
export const MFG_PRODUCT_TYPES = ['Finished Good', 'Semi Finished']
export const SHIFTS = ['Day', 'Night', 'General']
export const OPEN_ORDER_STATUSES = ['Planned', 'Released', 'In Progress']

export const componentRate = (c, items) => Number(c.rate) || Number(items.get(c.itemId)?.purchaseRate) || 0

export const bomUnitCost = (bom, items) =>
  round2(bom.components.reduce((a, c) => a + (Number(c.qty) || 0) * componentRate(c, items), 0) / (Number(bom.outputQty) || 1))

export const suggestBomCode = (product, version) =>
  product ? `BOM-${product.code.replace(/-/g, '')}-V${String(version || '1').split('.')[0] || '1'}` : ''

export const activeBomFor = (state, productId) => state.boms.find((b) => b.productId === productId && b.status === 'Active')

export const supplierFor = (state, itemId) => state.suppliers.find((s) => s.status !== 'Inactive' && s.itemIds?.includes(itemId))

/** Average labour cost per unit from past entries of the same product. */
export const suggestLabourRate = (state, productId) => {
  const entries = state.productionEntries.filter((e) => e.productId === productId && Number(e.producedQty) > 0)
  if (!entries.length) return 15
  const produced = entries.reduce((a, e) => a + Number(e.producedQty), 0)
  const labour = entries.reduce((a, e) => a + (Number(e.labourCost) || 0), 0)
  return Math.round((labour / produced) * 100) / 100 || 15
}

export const STAGES = ['Planned', 'Released', 'Material issued', 'In progress', 'Completed']

export function orderStage(order, prog) {
  if (order.status === 'Completed') return 4
  if (prog.produced > 0) return 3
  if (Object.keys(prog.issued).length) return 2
  if (['Released', 'In Progress'].includes(order.status)) return 1
  return 0
}

export function Stepper({ current, cancelled = false, steps = STAGES }) {
  const allDone = current === steps.length - 1
  return (
    <ol className={`prd-stepper ${cancelled ? 'cancelled' : ''}`}>
      {steps.map((s, i) => {
        const done = i < current || (allDone && i === current)
        const cls = done ? 'done' : i === current && !cancelled ? 'current' : ''
        return (
          <li key={s} className={`prd-step ${cls}`}>
            <span className="prd-dot">{done ? <Check size={14} strokeWidth={2.6} /> : i + 1}</span>
            <span>{s}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Small non-paginated table for sub-lists on detail pages. */
export function MiniTable({ columns, rows, rowKey = 'id', empty = 'Nothing recorded yet', emptyDescription, onRowClick, footer }) {
  if (!rows.length) return <EmptyState compact title={empty} description={emptyDescription} />
  return (
    <div className="table-wrap">
      <table className="table compact">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align ? `align-${c.align}` : ''}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[rowKey]} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={c.align ? `align-${c.align}` : ''}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  )
}

export function MissingRecord({ label, backTo }) {
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <EmptyState
        icon={FileQuestion}
        title={`${label} not found`}
        description="It may have been deleted, or the demo data was reset."
        action={<Button variant="primary" to={backTo}>Back to list</Button>}
      />
    </div>
  )
}
