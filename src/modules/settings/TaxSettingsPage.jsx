/**
 * Tax settings — frontend-only demo. GST rates here drive item and document forms.
 * No GST portal or e-invoice integration is connected.
 */
import { useState } from 'react'
import { Plus, RotateCcw, Save, X } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { fakeDelay } from '../../utils/hooks.js'
import { Button, Callout, Card, Field, Input, Select, Switch, useToast } from '../../components/ui/index.js'
import SettingsShell, { isDirty } from './SettingsShell.jsx'

const SWITCHES = [
  { name: 'showHsnOnInvoice', title: 'Show HSN on invoices', desc: 'Print the HSN code for every line item' },
  { name: 'hsnMandatory', title: 'HSN is mandatory for items', desc: 'Block saving items without an HSN code' },
  { name: 'roundOff', title: 'Round off invoice totals', desc: 'Round the grand total to the nearest rupee' },
  { name: 'reverseCharge', title: 'Reverse charge applicable', desc: 'Mark supplies liable to tax under reverse charge' },
  { name: 'compositionScheme', title: 'Composition scheme', desc: 'Enable only if registered under the composition scheme' },
]

export default function TaxSettingsPage() {
  const { state, updateSettings } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const saved = state.settings.tax
  const [values, setValues] = useState(saved)
  const [errors, setErrors] = useState({})
  const [newSlab, setNewSlab] = useState('')
  const [saving, setSaving] = useState(false)
  const dirty = isDirty(values, saved)
  const readOnly = !can('Settings', 'edit')

  const set = (name, v) => {
    setValues((s) => ({ ...s, [name]: v }))
    setErrors((e) => ({ ...e, [name]: undefined }))
  }
  const itemsAt = (rate) => state.items.filter((i) => Number(i.gst) === Number(rate)).length

  const addSlab = () => {
    const v = Number(newSlab)
    if (newSlab === '' || Number.isNaN(v) || v < 0 || v > 40) return toast.error('Enter a GST rate between 0 and 40')
    if (values.gstRates.includes(v)) return toast.error('This slab already exists')
    set('gstRates', [...values.gstRates, v].sort((a, b) => a - b))
    setNewSlab('')
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    ;['cgst', 'sgst', 'igst'].forEach((k) => {
      if (values[k] === '' || Number(values[k]) < 0) errs[k] = 'Enter a rate'
    })
    if (!errs.igst && Number(values.cgst) + Number(values.sgst) !== Number(values.igst)) errs.igst = `IGST should equal CGST + SGST (${Number(values.cgst) + Number(values.sgst)}%)`
    if (!values.gstRates.includes(Number(values.defaultGst))) errs.defaultGst = 'Default rate must be one of the GST slabs'
    setErrors(errs)
    if (Object.keys(errs).length) return toast.error('Check the highlighted fields')
    setSaving(true)
    await fakeDelay(400)
    updateSettings('tax', { ...values, cgst: Number(values.cgst), sgst: Number(values.sgst), igst: Number(values.igst), defaultGst: Number(values.defaultGst), hsnDigits: Number(values.hsnDigits) })
    setSaving(false)
    toast.success('Tax settings saved', 'New items and documents will use these rates.')
  }

  return (
    <SettingsShell
      title="Tax settings"
      subtitle="GST rates, slabs and HSN rules applied to items, invoices and purchase documents."
      actions={
        !readOnly && (
          <>
            <Button icon={RotateCcw} disabled={!dirty || saving} onClick={() => { setValues(saved); setErrors({}) }}>
              Discard
            </Button>
            <Button variant="primary" icon={Save} type="submit" form="tax-form" loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </>
        )
      }
    >
      <form id="tax-form" onSubmit={submit} noValidate className="settings-grid">
        <div className="stack">
          <Card title="Standard GST rates" subtitle="Intra-state sales use CGST + SGST. Inter-state sales use IGST.">
            <div className="form-grid cols-4">
              {[
                ['cgst', 'CGST %'],
                ['sgst', 'SGST %'],
                ['igst', 'IGST %'],
              ].map(([k, label]) => (
                <Field key={k} label={label} required error={errors[k]}>
                  <Input type="number" min="0" step="0.5" value={values[k]} disabled={readOnly} error={errors[k]} onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))} />
                </Field>
              ))}
              <Field label="Default GST %" required error={errors.defaultGst}>
                <Select options={values.gstRates.map((g) => ({ value: g, label: `${g}%` }))} value={values.defaultGst} disabled={readOnly} onChange={(e) => set('defaultGst', Number(e.target.value))} />
              </Field>
            </div>
          </Card>

          <Card title="GST slabs" subtitle="Rates available when creating items and documents">
            <div className="slab-chips">
              {values.gstRates.map((g) => {
                const used = itemsAt(g)
                const isDefault = Number(values.defaultGst) === g
                return (
                  <span key={g} className={`slab-chip ${isDefault ? 'is-default' : ''}`} title={used ? `${used} item(s) use ${g}%` : undefined}>
                    {g}%
                    <span className="tiny muted">{used} items</span>
                    <button type="button" disabled={readOnly || isDefault || used > 0} onClick={() => set('gstRates', values.gstRates.filter((x) => x !== g))} aria-label={`Remove ${g}% slab`}>
                      <X size={12} />
                    </button>
                  </span>
                )
              })}
            </div>
            {!readOnly && (
              <div className="row mt-16" style={{ maxWidth: 280 }}>
                <Input type="number" min="0" max="40" step="0.25" placeholder="New rate, e.g. 3" value={newSlab} onChange={(e) => setNewSlab(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSlab() } }} />
                <Button icon={Plus} onClick={addSlab}>
                  Add slab
                </Button>
              </div>
            )}
            <p className="tiny muted mt-8">Slabs in use by items or set as default can’t be removed.</p>
          </Card>

          <Card title="HSN and invoice rules">
            <div className="form-grid cols-2" style={{ marginBottom: 8 }}>
              <Field label="HSN digits required" hint="Businesses above ₹5 crore turnover must use 6 digits or more">
                <Select options={[{ value: 4, label: '4 digits' }, { value: 6, label: '6 digits' }, { value: 8, label: '8 digits' }]} value={values.hsnDigits} disabled={readOnly} onChange={(e) => set('hsnDigits', Number(e.target.value))} />
              </Field>
            </div>
            <div className="switch-list">
              {SWITCHES.map((s) => (
                <div key={s.name} className="switch-row">
                  <div>
                    <div className="sr-title">{s.title}</div>
                    <div className="sr-desc">{s.desc}</div>
                  </div>
                  <Switch checked={values[s.name]} disabled={readOnly} onChange={(v) => set(s.name, v)} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="settings-aside">
          <Card title="How GST is applied">
            <div className="stack-sm small ink-2">
              <p>
                Company state is <b>{state.settings.company.state}</b>. Sales to parties in the same state are split into CGST {values.cgst}% and SGST {values.sgst}%.
              </p>
              <p>Sales to other states carry IGST {values.igst}%.</p>
              <p>Each line item keeps its own GST rate from the item master.</p>
            </div>
          </Card>
          <Callout tone="gray">GST return filing and e-invoice generation are not connected in this demo.</Callout>
        </aside>
      </form>
    </SettingsShell>
  )
}
