/**
 * LineItemsEditor — editable item grid used by PO, quotation, sales order, invoices.
 * Picks rate & GST from the item master, shows HSN and live stock.
 */
import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId, itemStock } from '../../store/selectors.js'
import { calcLine } from '../../utils/calc.js'
import { inr2, num } from '../../utils/format.js'
import { uid } from '../../store/numbering.js'
import { Button, Select } from '../ui/index.js'

export const newLine = (overrides = {}) => ({ id: uid('ln'), itemId: '', qty: 1, rate: 0, discount: 0, gst: 18, ...overrides })

/** Remove empty rows before saving. */
export const cleanLines = (lines = []) => lines.filter((l) => l.itemId && Number(l.qty) > 0)

export default function LineItemsEditor({
  lines,
  onChange,
  rateField = 'salesRate',
  itemFilter,
  showDiscount = true,
  showGst = true,
  showStock = true,
  stockWarehouseId,
  readOnly = false,
  error,
  addLabel = 'Add item',
}) {
  const { state } = useErp()
  const itemMap = byId(state.items)
  const options = useMemo(
    () =>
      state.items
        .filter((i) => i.status !== 'Inactive' && (!itemFilter || itemFilter(i)))
        .map((i) => ({ value: i.id, label: `${i.name} (${i.code})` })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.items],
  )

  const update = (idx, changes) => onChange(lines.map((l, i) => (i === idx ? { ...l, ...changes } : l)))
  const selectItem = (idx, itemId) => {
    const it = itemMap.get(itemId)
    update(idx, { itemId, rate: it ? Number(it[rateField]) || Number(it.purchaseRate) || 0 : 0, gst: it ? Number(it.gst) : 18 })
  }
  const removeLine = (idx) => onChange(lines.length === 1 ? [newLine()] : lines.filter((_, i) => i !== idx))

  return (
    <div>
      <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
        <table className="table line-table">
          <thead>
            <tr>
              <th className="align-center">#</th>
              <th style={{ minWidth: 280 }}>Item</th>
              <th style={{ width: 110 }}>Qty</th>
              <th style={{ width: 70 }}>Unit</th>
              <th style={{ width: 120 }}>Rate (₹)</th>
              {showDiscount && <th style={{ width: 86 }}>Disc. %</th>}
              {showGst && <th style={{ width: 90 }}>GST %</th>}
              <th className="align-right" style={{ width: 130 }}>Amount</th>
              {!readOnly && <th style={{ width: 40 }} aria-label="Remove" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => {
              const it = itemMap.get(l.itemId)
              const c = calcLine(l)
              const stock = it && showStock ? itemStock(state, it.id, stockWarehouseId) : null
              return (
                <tr key={l.id}>
                  <td className="line-no">{idx + 1}</td>
                  <td>
                    <Select size="sm" options={options} placeholder="Select item" value={l.itemId} disabled={readOnly} onChange={(e) => selectItem(idx, e.target.value)} aria-label={`Item for line ${idx + 1}`} />
                    {it && (
                      <div className="line-meta">
                        HSN {it.hsn}
                        {stock !== null && (
                          <>
                            , in stock{' '}
                            <span className={stock <= 0 ? 'text-red' : stock < Number(l.qty) ? 'text-amber' : ''}>
                              {num(stock)} {it.unit}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <input className="input input-sm" type="number" min="0" step="any" value={l.qty} disabled={readOnly} onChange={(e) => update(idx, { qty: e.target.value === '' ? '' : Number(e.target.value) })} aria-label="Quantity" />
                  </td>
                  <td className="line-no" style={{ textAlign: 'left' }}>{it?.unit || '—'}</td>
                  <td>
                    <input className="input input-sm" type="number" min="0" step="any" value={l.rate} disabled={readOnly} onChange={(e) => update(idx, { rate: e.target.value === '' ? '' : Number(e.target.value) })} aria-label="Rate" />
                  </td>
                  {showDiscount && (
                    <td>
                      <input className="input input-sm" type="number" min="0" max="100" step="any" value={l.discount} disabled={readOnly} onChange={(e) => update(idx, { discount: e.target.value === '' ? '' : Number(e.target.value) })} aria-label="Discount percent" />
                    </td>
                  )}
                  {showGst && (
                    <td>
                      <Select size="sm" options={state.settings.tax.gstRates.map((g) => ({ value: g, label: `${g}%` }))} value={l.gst} disabled={readOnly} onChange={(e) => update(idx, { gst: Number(e.target.value) })} aria-label="GST rate" />
                    </td>
                  )}
                  <td className="line-amount">
                    {inr2(showGst ? c.total : c.taxable)}
                    {showGst && c.gstAmt > 0 && <div className="line-meta" style={{ textAlign: 'right' }}>incl. GST {inr2(c.gstAmt)}</div>}
                  </td>
                  {!readOnly && (
                    <td style={{ paddingTop: 8 }}>
                      <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => removeLine(idx)} aria-label={`Remove line ${idx + 1}`}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="row-between mt-8">
        {!readOnly ? (
          <Button size="sm" variant="soft" icon={Plus} onClick={() => onChange([...lines, newLine()])}>
            {addLabel}
          </Button>
        ) : (
          <span />
        )}
        {error ? <span className="field-error">{error}</span> : <span className="tiny muted">{lines.filter((l) => l.itemId).length} item(s)</span>}
      </div>
    </div>
  )
}
