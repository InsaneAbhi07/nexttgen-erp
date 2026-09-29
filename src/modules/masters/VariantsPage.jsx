/**
 * Product variants — families of one design made in several finishes and sizes.
 * Each variant is a real item, so stock, sales and production work unchanged.
 * Frontend-only demo (mock store).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Boxes, Grid3x3, Layers3, PackageX, Plus, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { itemStock } from '../../store/selectors.js'
import { allCombinations, familyVariants, variantKey } from '../../store/mfg.js'
import { nextCode } from '../../store/numbering.js'
import { num } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Button, DataTable, Drawer, Field, Input, PageHeader, Progress, Select, StatCard, StatusBadge, Textarea, useToast } from '../../components/ui/index.js'
import { mastersCrumbs } from './shared.jsx'
import './variants.css'

const blankAttr = (name = '') => ({ name, valuesText: '', adjust: {} })

/** Stats for one family: created vs possible variants, stock, missing combinations. */
export function familyStats(state, family) {
  const variants = familyVariants(state, family.id)
  const have = new Set(variants.map((v) => variantKey(v.attributes)))
  const combos = allCombinations(family)
  const stock = variants.reduce((a, v) => a + itemStock(state, v.id), 0)
  return {
    variants,
    combos,
    missing: combos.filter((c) => !have.has(variantKey(c))),
    stock,
    outOfStock: variants.filter((v) => v.status === 'Active' && itemStock(state, v.id) <= 0).length,
  }
}

/** Add / edit drawer for a product family (used here and on the family view). */
export function FamilyDrawer({ open, family, onClose, onSaved }) {
  const { state, save } = useErp()
  const toast = useToast()
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setForm(null)
      return
    }
    setErrors({})
    setForm(
      family
        ? { ...family, attributes: family.attributes.map((a) => ({ name: a.name, valuesText: a.values.join(', '), adjust: { ...(a.adjust || {}) } })) }
        : {
            name: '', code: '', category: '', subCategory: '', brand: 'NexttGen', unit: 'PCS', hsn: '', gst: state.settings.tax.defaultGst,
            baseSalesRate: '', basePurchaseRate: '', description: '', status: 'Active', attributes: [blankAttr('Size'), blankAttr('Finish')],
          },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, family])

  if (!form) return <Drawer open={false} onClose={onClose} />

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const setAttr = (i, patch) => {
    setForm((f) => ({ ...f, attributes: f.attributes.map((a, j) => (j === i ? { ...a, ...patch } : a)) }))
    setErrors((e) => ({ ...e, attributes: undefined }))
  }
  const valuesOf = (a) => a.valuesText.split(',').map((x) => x.trim()).filter(Boolean)

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    const name = form.name.trim()
    if (!name) errs.name = 'Enter the family name'
    else if ((state.productFamilies || []).some((f) => f.name.toLowerCase() === name.toLowerCase() && f.id !== form.id)) errs.name = 'A family with this name already exists'
    if (!form.category) errs.category = 'Select a category'
    if (!form.unit) errs.unit = 'Select a unit'
    if (!/^\d{4,8}$/.test(String(form.hsn).trim())) errs.hsn = 'HSN must be 4 to 8 digits'
    if (!(Number(form.baseSalesRate) > 0)) errs.baseSalesRate = 'Enter the base sales rate'
    const attrs = form.attributes.filter((a) => a.name.trim())
    if (!attrs.length || attrs.some((a) => !valuesOf(a).length)) errs.attributes = 'Add at least one attribute, each with at least one value'
    if (new Set(attrs.map((a) => a.name.trim().toLowerCase())).size !== attrs.length) errs.attributes = 'Attribute names must be different'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', Object.values(errs)[0])
      return
    }
    setSaving(true)
    await fakeDelay(350)
    const saved = save('productFamilies', {
      ...form,
      name,
      code: form.code.trim().toUpperCase() || nextCode(state.productFamilies || [], 'FAM', 3),
      hsn: String(form.hsn).trim(),
      gst: Number(form.gst),
      baseSalesRate: Number(form.baseSalesRate) || 0,
      basePurchaseRate: Number(form.basePurchaseRate) || 0,
      attributes: attrs.map((a) => {
        const values = valuesOf(a)
        const adjust = Object.fromEntries(values.filter((v) => Number(a.adjust[v])).map((v) => [v, Number(a.adjust[v])]))
        return { name: a.name.trim(), values, adjust }
      }),
    })
    setSaving(false)
    toast.success(form.id ? 'Product family updated' : 'Product family added', form.id ? saved.name : `${saved.name}: open the matrix to create its variants.`)
    onSaved?.(saved)
    onClose()
  }

  const opts = (list) => list.filter((x) => x.status === 'Active').map((x) => x.name)

  return (
    <Drawer
      open={open}
      onClose={() => !saving && onClose()}
      size="lg"
      title={form.id ? `Edit ${form.name}` : 'Add product family'}
      subtitle="One design, made in several finishes and sizes"
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" type="submit" form="family-form" loading={saving}>{form.id ? 'Save changes' : 'Add family'}</Button>
        </>
      }
    >
      <form id="family-form" onSubmit={submit} noValidate>
        <div className="form-grid cols-2">
          <Field label="Family name" required error={errors.name}>
            <Input value={form.name} error={errors.name} placeholder="e.g. Pull Handle" onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Code" hint="Leave blank to generate">
            <Input className="mono" value={form.code} placeholder="FAM-PH" onChange={(e) => set('code', e.target.value.toUpperCase())} />
          </Field>
          <Field label="Category" required error={errors.category}>
            <Select options={opts(state.categories)} placeholder="Select" value={form.category} error={errors.category} onChange={(e) => set('category', e.target.value)} />
          </Field>
          <Field label="Sub category">
            <Input value={form.subCategory} placeholder="e.g. Pull Handles" onChange={(e) => set('subCategory', e.target.value)} />
          </Field>
          <Field label="Brand">
            <Select options={opts(state.brands)} value={form.brand} onChange={(e) => set('brand', e.target.value)} />
          </Field>
          <Field label="Unit" required error={errors.unit}>
            <Select options={opts(state.units)} value={form.unit} onChange={(e) => set('unit', e.target.value)} />
          </Field>
          <Field label="HSN code" required error={errors.hsn}>
            <Input value={form.hsn} error={errors.hsn} maxLength={8} placeholder="83024110" onChange={(e) => set('hsn', e.target.value)} />
          </Field>
          <Field label="GST %">
            <Select options={state.settings.tax.gstRates.map((g) => ({ value: g, label: `${g}%` }))} value={form.gst} onChange={(e) => set('gst', e.target.value)} />
          </Field>
          <Field label="Base sales rate" required error={errors.baseSalesRate} hint="Rate of the base variant; others are priced by % adjustment">
            <Input type="number" min="0" prefix="₹" value={form.baseSalesRate} error={errors.baseSalesRate} onChange={(e) => set('baseSalesRate', e.target.value === '' ? '' : Number(e.target.value))} />
          </Field>
          <Field label="Base purchase / cost rate">
            <Input type="number" min="0" prefix="₹" value={form.basePurchaseRate} onChange={(e) => set('basePurchaseRate', e.target.value === '' ? '' : Number(e.target.value))} />
          </Field>
          <Field label="Description" span="full">
            <Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>

        <div className="form-section-title" style={{ margin: '18px 0 10px' }}>Attributes</div>
        {errors.attributes && <div className="field-error" style={{ marginBottom: 8 }}>{errors.attributes}</div>}
        <div className="stack">
          {form.attributes.map((a, i) => (
            <div key={i} className="var-attr-block">
              <div className="var-attr-head">
                <Field label="Attribute">
                  <Input size="sm" value={a.name} placeholder="Size, Finish, Lever…" onChange={(e) => setAttr(i, { name: e.target.value })} />
                </Field>
                <Field label="Values (comma-separated)">
                  <Input size="sm" value={a.valuesText} placeholder={'6", 8", 10"'} onChange={(e) => setAttr(i, { valuesText: e.target.value })} />
                </Field>
                <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label="Remove attribute" disabled={form.attributes.length === 1} onClick={() => set('attributes', form.attributes.filter((_, j) => j !== i))} />
              </div>
              {valuesOf(a).length > 0 && (
                <div>
                  <div className="small muted" style={{ marginBottom: 6 }}>Price adjustment over base, in %</div>
                  <div className="var-adjust-grid">
                    {valuesOf(a).map((v) => (
                      <div key={v}>
                        <label htmlFor={`adj-${i}-${v}`}>{v}</label>
                        <input
                          id={`adj-${i}-${v}`}
                          className="input input-sm"
                          type="number"
                          step="any"
                          value={a.adjust[v] ?? ''}
                          placeholder="0"
                          onChange={(e) => setAttr(i, { adjust: { ...a.adjust, [v]: e.target.value === '' ? '' : Number(e.target.value) } })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {form.attributes.length < 3 && (
            <Button size="sm" variant="soft" icon={Plus} style={{ alignSelf: 'flex-start' }} onClick={() => set('attributes', [...form.attributes, blankAttr()])}>
              Add attribute
            </Button>
          )}
        </div>
      </form>
    </Drawer>
  )
}

export default function VariantsPage() {
  usePageTitle('Product variants')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const families = state.productFamilies || []

  useEffect(() => {
    if (params.get('new') === '1') {
      setAdding(true)
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const rows = useMemo(() => families.map((f) => ({ ...f, stats: familyStats(state, f) })), [families, state])
  const variantCount = rows.reduce((a, r) => a + r.stats.variants.length, 0)
  const missing = rows.reduce((a, r) => a + r.stats.missing.length, 0)
  const outOfStock = rows.reduce((a, r) => a + r.stats.outOfStock, 0)

  const columns = [
    { key: 'name', header: 'Family', accessor: (r) => `${r.name} ${r.code}`, sortValue: (r) => r.name, render: (r) => (<div><div className="cell-primary">{r.name}</div><div className="cell-secondary"><span className="mono">{r.code}</span>, {r.brand}</div></div>) },
    { key: 'category', header: 'Category', render: (r) => (<div><div>{r.category}</div><div className="cell-secondary">{r.subCategory}</div></div>) },
    {
      key: 'attributes',
      header: 'Attributes',
      accessor: (r) => r.attributes.map((a) => `${a.name} ${a.values.join(' ')}`).join(' '),
      render: (r) => (
        <div className="var-attr-summary">
          {r.attributes.map((a) => (
            <span key={a.name}><b>{a.name}:</b> {a.values.length > 4 ? `${a.values.slice(0, 4).join(' · ')} +${a.values.length - 4}` : a.values.join(' · ')}</span>
          ))}
        </div>
      ),
    },
    {
      key: 'coverage',
      header: 'Variants created',
      accessor: (r) => r.stats.variants.length,
      render: (r) => (
        <div style={{ minWidth: 120 }}>
          <Progress value={r.stats.combos.length ? (r.stats.variants.length / r.stats.combos.length) * 100 : 0} tone="brass" />
          <div className="cell-secondary" style={{ marginTop: 3 }}>{r.stats.variants.length} of {r.stats.combos.length} combinations</div>
        </div>
      ),
    },
    { key: 'stock', header: 'Stock', align: 'right', accessor: (r) => r.stats.stock, render: (r) => <span className="num strong">{num(r.stats.stock)} <span className="muted small">{r.unit}</span></span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Product variants"
        subtitle="One design in many finishes and sizes. Each variant is a stock item with its own code, rate and stock."
        breadcrumbs={mastersCrumbs('Product variants')}
        actions={can('Masters', 'add') && <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add product family</Button>}
      />

      <div className="grid-4 mb-16">
        <StatCard label="Product families" value={families.length} icon={Layers3} tone="brass" foot={`${families.filter((f) => f.status === 'Active').length} active`} />
        <StatCard label="Variant items" value={variantCount} icon={Grid3x3} tone="blue" foot="Stocked and sold as items" to="/masters/items" />
        <StatCard label="Combinations not created" value={missing} icon={Plus} tone="violet" foot="Create them from the matrix" />
        <StatCard label="Variants out of stock" value={outOfStock} icon={PackageX} tone={outOfStock ? 'red' : 'green'} foot={outOfStock ? 'Plan production or purchase' : 'All variants in stock'} />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        exportName="product-families"
        initialSort={{ key: 'name', dir: 'asc' }}
        searchPlaceholder="Search family, category or attribute value…"
        onRowClick={(r) => navigate(`/masters/variants/${r.id}`)}
        rowActions={(r) => [{ label: 'Open variant matrix', icon: Grid3x3, to: `/masters/variants/${r.id}` }, { label: 'View items', icon: Boxes, to: '/masters/items' }]}
        emptyTitle="No product families yet"
        emptyDescription="Group a design’s finishes and sizes into one family to see them as a matrix."
        emptyAction={can('Masters', 'add') && <Button size="sm" variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add product family</Button>}
      />

      <FamilyDrawer open={adding} onClose={() => setAdding(false)} onSaved={(f) => navigate(`/masters/variants/${f.id}`)} />
    </>
  )
}
