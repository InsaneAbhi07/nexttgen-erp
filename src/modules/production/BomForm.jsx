/** BOM builder — create / edit a bill of material. Frontend-only demo. */
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId, itemStock } from '../../store/selectors.js'
import { uid } from '../../store/numbering.js'
import { STATUS } from '../../data/constants.js'
import { inr2, num, pct, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Button, Callout, Card, DatePicker, Field, Input, PageHeader, Progress, Select, useConfirm, useToast } from '../../components/ui/index.js'
import { COMPONENT_TYPES, CRUMB, MFG_PRODUCT_TYPES, MissingRecord, suggestBomCode } from './shared.jsx'

const newComponent = () => ({ id: uid('ln'), itemId: '', qty: 1, unit: '', rate: 0 })

export default function BomForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const editing = Boolean(id)
  const { state, save, patch, get } = useErp()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const items = byId(state.items)
  const existing = editing ? get('boms', id) : null
  usePageTitle(editing ? 'Edit BOM' : 'New BOM')

  const [values, setValues] = useState(() => {
    if (existing) return { ...existing, components: existing.components.map((c) => ({ ...c })) }
    const copy = params.get('copy') ? get('boms', params.get('copy')) : null
    if (copy) {
      const version = `${(parseInt(copy.version, 10) || 1) + 1}.0`
      return {
        productId: copy.productId,
        version,
        code: suggestBomCode(items.get(copy.productId), version),
        unit: copy.unit,
        outputQty: copy.outputQty,
        status: 'Draft',
        remarks: `Revised from ${copy.code}`,
        effectiveFrom: today(),
        components: copy.components.map((c) => ({ ...c, id: uid('ln') })),
      }
    }
    const p = items.get(params.get('product'))
    return { productId: p?.id || '', version: '1.0', code: suggestBomCode(p, '1.0'), unit: p?.unit || '', outputQty: 1, status: 'Active', remarks: '', effectiveFrom: today(), components: [newComponent()] }
  })
  const [codeTouched, setCodeTouched] = useState(editing)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const productOptions = useMemo(
    () =>
      state.items
        .filter((i) => MFG_PRODUCT_TYPES.includes(i.type) && (i.status === 'Active' || i.id === values.productId))
        .map((i) => ({ value: i.id, label: `${i.name} (${i.code})` })),
    [state.items, values.productId],
  )
  const componentOptions = useMemo(
    () =>
      state.items
        .filter((i) => COMPONENT_TYPES.includes(i.type) && i.status === 'Active' && i.id !== values.productId)
        .map((i) => ({ value: i.id, label: `${i.name} (${i.code})` })),
    [state.items, values.productId],
  )

  if (editing && !existing) return <MissingRecord label="BOM" backTo="/production/bom" />

  const product = items.get(values.productId)
  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const onProduct = (pid) => {
    const p = items.get(pid)
    setValues((s) => ({ ...s, productId: pid, unit: p?.unit || '', code: codeTouched ? s.code : suggestBomCode(p, s.version) }))
    setErrors((e) => ({ ...e, productId: undefined }))
  }
  const onVersion = (v) => setValues((s) => ({ ...s, version: v, code: codeTouched ? s.code : suggestBomCode(items.get(s.productId), v) }))
  const updateComp = (idx, changes) => {
    setValues((s) => ({ ...s, components: s.components.map((c, i) => (i === idx ? { ...c, ...changes } : c)) }))
    setErrors((e) => ({ ...e, components: undefined }))
  }
  const selectComp = (idx, itemId) => {
    const it = items.get(itemId)
    updateComp(idx, { itemId, unit: it?.unit || '', rate: Number(it?.purchaseRate) || 0 })
  }
  const removeComp = (idx) => setValues((s) => ({ ...s, components: s.components.length === 1 ? [newComponent()] : s.components.filter((_, i) => i !== idx) }))

  const counts = {}
  values.components.forEach((c) => {
    if (c.itemId) counts[c.itemId] = (counts[c.itemId] || 0) + 1
  })
  const total = values.components.reduce((a, c) => a + (Number(c.qty) || 0) * (Number(c.rate) || 0), 0)
  const unitCost = total / (Number(values.outputQty) || 1)
  const salesRate = Number(product?.salesRate) || 0
  const margin = salesRate ? ((salesRate - unitCost) / salesRate) * 100 : 0

  const validate = () => {
    const errs = {}
    if (!values.productId) errs.productId = 'Select a product'
    if (!String(values.code || '').trim()) errs.code = 'Enter a BOM code'
    else if (state.boms.some((b) => b.code.toLowerCase() === values.code.trim().toLowerCase() && b.id !== values.id)) errs.code = 'This BOM code is already used'
    if (!String(values.version || '').trim()) errs.version = 'Enter a version'
    if (!(Number(values.outputQty) > 0)) errs.outputQty = 'Enter a quantity above 0'
    const valid = values.components.filter((c) => c.itemId)
    if (!valid.length) errs.components = 'Add at least one component'
    else if (Object.values(counts).some((n) => n > 1)) errs.components = 'Each component can be added only once'
    else if (valid.some((c) => !(Number(c.qty) > 0))) errs.components = 'Enter a quantity above 0 for every component'
    return errs
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', `${Object.keys(errs).length} field(s) need attention.`)
      return
    }
    const other = values.status === 'Active' ? state.boms.find((b) => b.productId === values.productId && b.status === 'Active' && b.id !== values.id) : null
    if (other) {
      const ok = await confirm({
        title: 'Replace the active BOM?',
        message: `${other.code} (v${other.version}) is currently active for ${product.name}. It will be marked inactive and new production orders will use this BOM.`,
        confirmLabel: 'Activate this BOM',
      })
      if (!ok) return
    }
    setSaving(true)
    await fakeDelay(400)
    if (other) patch('boms', other.id, { status: 'Inactive' }, { silent: true })
    const saved = save('boms', {
      ...values,
      code: values.code.trim(),
      outputQty: Number(values.outputQty),
      components: values.components
        .filter((c) => c.itemId)
        .map((c) => ({ id: c.id, itemId: c.itemId, qty: Number(c.qty), unit: items.get(c.itemId)?.unit, rate: Number(c.rate) || 0 })),
    })
    setSaving(false)
    toast.success('BOM saved', `${saved.code} for ${product.name} with ${saved.components.length} components.`)
    navigate(`/production/bom/${saved.id}`)
  }

  return (
    <>
      <PageHeader
        title={editing ? `Edit ${existing.code}` : 'New bill of material'}
        subtitle="Define the components and quantities needed to make the output quantity of a product."
        breadcrumbs={[CRUMB, { label: 'Bill of material', to: '/production/bom' }, { label: editing ? existing.code : 'New BOM' }]}
      />
      <form onSubmit={submit} noValidate>
        <div className="prd-split">
          <div className="stack">
            <Card title="BOM details">
              <div className="form-grid">
                <Field label="Product" required error={errors.productId} span={2}>
                  <Select options={productOptions} placeholder="Select a finished product" value={values.productId} error={errors.productId} onChange={(e) => onProduct(e.target.value)} />
                </Field>
                <Field label="BOM code" required error={errors.code} hint={!codeTouched ? 'Suggested from product and version' : undefined}>
                  <Input className="mono" value={values.code} error={errors.code} onChange={(e) => { setCodeTouched(true); set('code', e.target.value.toUpperCase()) }} />
                </Field>
                <Field label="Version" required error={errors.version}>
                  <Input value={values.version} error={errors.version} onChange={(e) => onVersion(e.target.value)} />
                </Field>
                <Field label="Unit">
                  <Input value={values.unit} readOnly placeholder="From product" />
                </Field>
                <Field label="Output quantity" required error={errors.outputQty} hint={`Components below make this many ${values.unit || 'units'}`}>
                  <Input type="number" min="0" step="any" value={values.outputQty} error={errors.outputQty} onChange={(e) => set('outputQty', e.target.value === '' ? '' : Number(e.target.value))} />
                </Field>
                <Field label="Status">
                  <Select options={STATUS.bom} value={values.status} onChange={(e) => set('status', e.target.value)} />
                </Field>
                <Field label="Effective from">
                  <DatePicker value={values.effectiveFrom} onChange={(v) => set('effectiveFrom', v)} />
                </Field>
                <Field label="Remarks">
                  <Input value={values.remarks} placeholder="Approval, trial notes…" onChange={(e) => set('remarks', e.target.value)} />
                </Field>
              </div>
            </Card>

            <Card
              title="Components"
              subtitle={`Raw material, packaging and consumables for ${values.outputQty || 1} ${values.unit || 'unit'}`}
              flush
              actions={<Button size="sm" variant="soft" icon={Plus} onClick={() => setValues((s) => ({ ...s, components: [...s.components, newComponent()] }))}>Add component</Button>}
            >
              <div className="table-wrap">
                <table className="table line-table" style={{ minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th className="align-center">#</th>
                      <th style={{ minWidth: 260 }}>Item</th>
                      <th style={{ width: 110 }}>Quantity</th>
                      <th style={{ width: 70 }}>Unit</th>
                      <th style={{ width: 120 }}>Rate (₹)</th>
                      <th className="align-right" style={{ width: 120 }}>Amount</th>
                      <th className="align-right" style={{ width: 70 }}>Share</th>
                      <th style={{ width: 40 }} aria-label="Remove" />
                    </tr>
                  </thead>
                  <tbody>
                    {values.components.map((c, idx) => {
                      const it = items.get(c.itemId)
                      const amount = (Number(c.qty) || 0) * (Number(c.rate) || 0)
                      const dup = c.itemId && counts[c.itemId] > 1
                      return (
                        <tr key={c.id}>
                          <td className="line-no">{idx + 1}</td>
                          <td>
                            <Select size="sm" options={componentOptions} placeholder="Select component" value={c.itemId} error={dup} onChange={(e) => selectComp(idx, e.target.value)} aria-label={`Component ${idx + 1}`} />
                            {dup ? (
                              <div className="field-error" style={{ marginTop: 3 }}>Already added in another row</div>
                            ) : (
                              it && (
                                <div className="line-meta">
                                  {it.type}, in stock {num(itemStock(state, it.id))} {it.unit}
                                </div>
                              )
                            )}
                          </td>
                          <td>
                            <input className="input input-sm" type="number" min="0" step="any" value={c.qty} aria-label="Quantity" onChange={(e) => updateComp(idx, { qty: e.target.value === '' ? '' : Number(e.target.value) })} />
                          </td>
                          <td className="line-no" style={{ textAlign: 'left' }}>{it?.unit || '—'}</td>
                          <td>
                            <input className="input input-sm" type="number" min="0" step="any" value={c.rate} aria-label="Rate" onChange={(e) => updateComp(idx, { rate: e.target.value === '' ? '' : Number(e.target.value) })} />
                          </td>
                          <td className="line-amount">{inr2(amount)}</td>
                          <td className="line-amount muted" style={{ fontWeight: 400 }}>{total > 0 ? pct((amount / total) * 100, 0) : '—'}</td>
                          <td style={{ paddingTop: 8 }}>
                            <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => removeComp(idx)} aria-label={`Remove component ${idx + 1}`}>
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td />
                      <td>Total material cost</td>
                      <td colSpan={3} />
                      <td className="align-right">{inr2(total)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {errors.components && <div className="field-error" style={{ padding: '10px 16px' }}>{errors.components}</div>}
            </Card>
          </div>

          <aside className="stack">
            <Card title="Cost summary" subtitle={product ? product.name : 'Select a product to compare'}>
              <div className="totals" style={{ maxWidth: 'none' }}>
                <div className="totals-row"><span>Components</span><span>{values.components.filter((c) => c.itemId).length}</span></div>
                <div className="totals-row"><span>Material cost for {values.outputQty || 1} {values.unit || 'unit'}</span><span>{inr2(total)}</span></div>
                <div className="totals-row"><span>Material cost per unit</span><span>{inr2(unitCost)}</span></div>
                <div className="totals-row"><span>Selling price</span><span>{inr2(salesRate)}</span></div>
                <div className="totals-row grand"><span>Material margin</span><span className={margin < 35 ? 'text-amber' : 'text-green'}>{pct(margin)}</span></div>
              </div>
              <Progress value={Math.max(0, margin)} tone={margin < 35 ? 'amber' : 'green'} style={{ marginTop: 10 }} />
              <p className="tiny muted" style={{ marginTop: 8 }}>
                Margin before labour, power and overheads, which are added through production entries.
              </p>
            </Card>
            {product && margin < 35 && total > 0 && (
              <Callout tone="amber">Material margin is below 35%. Review component rates or the selling price of {product.name}.</Callout>
            )}
            {values.status === 'Active' && state.boms.some((b) => b.productId === values.productId && b.status === 'Active' && b.id !== values.id) && (
              <Callout>Saving as active will mark the current active BOM of this product as inactive.</Callout>
            )}
          </aside>
        </div>

        <div className="sticky-actions form-actions">
          <Button onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" icon={Save} loading={saving}>
            Save BOM
          </Button>
        </div>
      </form>
    </>
  )
}
