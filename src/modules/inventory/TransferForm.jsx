/**
 * Stock transfer form (new / edit) — frontend-only demo.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Plus, Save, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock } from '../../store/selectors.js'
import { uid } from '../../store/numbering.js'
import { inr, num, today } from '../../utils/format.js'
import { fakeDelay, usePageTitle } from '../../utils/hooks.js'
import { Button, Callout, Card, DatePicker, EmptyState, Field, Input, PageHeader, Select, Textarea, useToast } from '../../components/ui/index.js'
import NotFound from '../../pages/NotFound.jsx'
import { INV_CRUMB, itemOptions, warehouseOptions } from './helpers.jsx'

const blankLine = () => ({ id: uid('ln'), itemId: '', qty: '' })

export default function TransferForm() {
  const { id } = useParams()
  const { state, save, previewNumber } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const orig = id ? state.stockTransfers.find((t) => t.id === id) : null
  usePageTitle(orig ? `Edit ${orig.number}` : 'New stock transfer')

  const [values, setValues] = useState(() =>
    orig
      ? { date: orig.date, fromWarehouseId: orig.fromWarehouseId, toWarehouseId: orig.toWarehouseId, vehicleNo: orig.vehicleNo || '', status: orig.status, remarks: orig.remarks || '' }
      : { date: today(), fromWarehouseId: 'wh-fgg', toWarehouseId: 'wh-del', vehicleNo: '', status: 'In Transit', remarks: 'Replenishment for Delhi Depot' },
  )
  const [lines, setLines] = useState(() => (orig ? orig.lines.map((l) => ({ ...l })) : [blankLine()]))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  if (id && !orig) return <NotFound />

  const items = byId(state.items)
  const warehouses = byId(state.warehouses)

  const availableFor = (itemId) => {
    if (!itemId || !values.fromWarehouseId) return 0
    let a = itemStock(state, itemId, values.fromWarehouseId)
    if (orig && orig.fromWarehouseId === values.fromWarehouseId) {
      a += orig.lines.filter((l) => l.itemId === itemId).reduce((s, l) => s + Number(l.qty), 0)
    }
    return a
  }

  const setValue = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const updateLine = (idx, changes) => {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...changes } : l)))
    setErrors((e) => ({ ...e, lines: undefined, [`line-${idx}`]: undefined }))
  }

  const options = itemOptions(state, (i) => availableFor(i.id) > 0 || lines.some((l) => l.itemId === i.id))
  const filled = lines.filter((l) => l.itemId)
  const totalQty = filled.reduce((a, l) => a + (Number(l.qty) || 0), 0)
  const totalValue = filled.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(items.get(l.itemId)?.purchaseRate) || 0), 0)

  const submit = async () => {
    const errs = {}
    if (!values.date) errs.date = 'Select a date'
    if (!values.fromWarehouseId) errs.fromWarehouseId = 'Select the source warehouse'
    if (!values.toWarehouseId) errs.toWarehouseId = 'Select the destination warehouse'
    if (values.fromWarehouseId && values.fromWarehouseId === values.toWarehouseId) errs.toWarehouseId = 'Destination must be different from the source'
    if (!filled.length) errs.lines = 'Add at least one item to transfer'
    const seen = new Set()
    lines.forEach((l, idx) => {
      if (!l.itemId) return
      const avail = availableFor(l.itemId)
      if (seen.has(l.itemId)) errs[`line-${idx}`] = 'This item is already in the list'
      else if (!(Number(l.qty) > 0)) errs[`line-${idx}`] = 'Enter a quantity'
      else if (Number(l.qty) > avail) errs[`line-${idx}`] = `Only ${num(avail)} available`
      seen.add(l.itemId)
    })
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the transfer details', 'Some fields need attention before saving.')
      return
    }
    setSaving(true)
    await fakeDelay(450)
    const saved = save('stockTransfers', {
      ...(orig || {}),
      ...values,
      vehicleNo: values.vehicleNo.trim().toUpperCase(),
      remarks: values.remarks.trim(),
      lines: filled.map((l) => ({ id: l.id, itemId: l.itemId, qty: Number(l.qty) })),
    })
    setSaving(false)
    toast.success(orig ? 'Stock transfer updated' : 'Stock transfer saved', `${saved.number}: ${num(totalQty)} units from ${warehouses.get(saved.fromWarehouseId)?.name} to ${warehouses.get(saved.toWarehouseId)?.name}.`)
    navigate(`/inventory/transfers/${saved.id}`)
  }

  if (!can('Inventory', orig ? 'edit' : 'add')) {
    return (
      <div className="card">
        <EmptyState title="You don’t have access to this action" description="Ask an administrator to grant inventory permissions." action={<Button to="/inventory/transfers">Back to transfers</Button>} />
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={orig ? `Edit transfer ${orig.number}` : 'New stock transfer'}
        subtitle="Stock leaves the source warehouse and is added to the destination as soon as you save."
        breadcrumbs={[INV_CRUMB, { label: 'Stock transfers', to: '/inventory/transfers' }, { label: orig ? orig.number : 'New transfer' }]}
      />

      <div className="stack">
        <Card title="Transfer details">
          <div className="form-grid">
            <Field label="Transfer number">
              <Input readOnly className="mono" value={orig ? orig.number : previewNumber('stockTransfers', values.date)} />
            </Field>
            <Field label="Date" required error={errors.date}>
              <DatePicker value={values.date} max={today()} onChange={(d) => setValue('date', d)} />
            </Field>
            <Field label="Status">
              <Select options={['In Transit', 'Received']} value={values.status} onChange={(e) => setValue('status', e.target.value)} />
            </Field>
            <Field label="From warehouse" required error={errors.fromWarehouseId}>
              <Select options={warehouseOptions(state)} placeholder="Select source" value={values.fromWarehouseId} error={errors.fromWarehouseId} onChange={(e) => setValue('fromWarehouseId', e.target.value)} />
            </Field>
            <Field label="To warehouse" required error={errors.toWarehouseId}>
              <Select options={warehouseOptions(state)} placeholder="Select destination" value={values.toWarehouseId} error={errors.toWarehouseId} onChange={(e) => setValue('toWarehouseId', e.target.value)} />
            </Field>
            <Field label="Vehicle number" hint="Leave blank for hand delivery within the plant">
              <Input value={values.vehicleNo} placeholder="UP81 AT 4521" onChange={(e) => setValue('vehicleNo', e.target.value)} />
            </Field>
            <Field label="Remarks" span="full">
              <Textarea rows={2} value={values.remarks} onChange={(e) => setValue('remarks', e.target.value)} />
            </Field>
          </div>
          {values.fromWarehouseId && values.toWarehouseId && values.fromWarehouseId !== values.toWarehouseId && (
            <div className="row mt-16 small ink-2" style={{ gap: 10 }}>
              <span className="strong">{warehouses.get(values.fromWarehouseId)?.name}</span>
              <ArrowRight size={15} style={{ color: 'var(--brass)' }} />
              <span className="strong">{warehouses.get(values.toWarehouseId)?.name}</span>
            </div>
          )}
        </Card>

        <Card title="Items to transfer" subtitle="Only items with stock in the source warehouse are listed">
          {errors.lines && <Callout tone="red" style={{ marginBottom: 12 }}>{errors.lines}</Callout>}
          <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
            <table className="table line-table" style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th className="align-center">#</th>
                  <th style={{ minWidth: 280 }}>Item</th>
                  <th className="align-right" style={{ width: 150 }}>Available</th>
                  <th style={{ width: 140 }}>Quantity</th>
                  <th style={{ width: 70 }}>Unit</th>
                  <th className="align-right" style={{ width: 130 }}>Value</th>
                  <th style={{ width: 40 }} aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const it = items.get(l.itemId)
                  const avail = l.itemId ? availableFor(l.itemId) : null
                  const err = errors[`line-${idx}`]
                  return (
                    <tr key={l.id}>
                      <td className="line-no">{idx + 1}</td>
                      <td>
                        <Select size="sm" options={options} placeholder="Select item" value={l.itemId} onChange={(e) => updateLine(idx, { itemId: e.target.value })} aria-label={`Item for line ${idx + 1}`} />
                        {err && <div className="field-error" style={{ marginTop: 3 }}>{err}</div>}
                      </td>
                      <td className="line-amount" style={{ fontWeight: 400 }}>
                        {avail === null ? '—' : <span className={Number(l.qty) > avail ? 'text-red' : ''}>{num(avail)}</span>}
                      </td>
                      <td>
                        <input className={`input input-sm ${err ? 'has-error' : ''}`} type="number" min="0" step="any" value={l.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} aria-label="Quantity" />
                      </td>
                      <td className="line-no" style={{ textAlign: 'left' }}>{it?.unit || '—'}</td>
                      <td className="line-amount">{it ? inr((Number(l.qty) || 0) * it.purchaseRate) : '—'}</td>
                      <td style={{ paddingTop: 8 }}>
                        <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setLines((ls) => (ls.length === 1 ? [blankLine()] : ls.filter((_, i) => i !== idx)))} aria-label={`Remove line ${idx + 1}`}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="row-between mt-8 row-wrap">
            <Button size="sm" variant="soft" icon={Plus} onClick={() => setLines((ls) => [...ls, blankLine()])}>
              Add item
            </Button>
            <span className="small ink-2">
              {filled.length} item(s), <b>{num(totalQty)}</b> units, value <b>{inr(totalValue)}</b>
            </span>
          </div>
        </Card>
      </div>

      <div className="sticky-actions form-actions">
        <Button onClick={() => navigate(orig ? `/inventory/transfers/${orig.id}` : '/inventory/transfers')} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" icon={Save} loading={saving} onClick={submit}>
          {orig ? 'Save changes' : 'Save transfer'}
        </Button>
      </div>
    </>
  )
}
