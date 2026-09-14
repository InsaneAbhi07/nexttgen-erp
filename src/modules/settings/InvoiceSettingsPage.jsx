/**
 * Invoice settings — frontend-only demo. Prefix drives new sales invoice numbers;
 * terms and footer appear on the print preview.
 */
import { useMemo, useState } from 'react'
import { Eye, RotateCcw, Save } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { nextDocNumber } from '../../store/numbering.js'
import { fakeDelay } from '../../utils/hooks.js'
import { fmtDate, today } from '../../utils/format.js'
import { Button, Card, Field, Input, Switch, Textarea, useToast } from '../../components/ui/index.js'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import SettingsShell, { isDirty } from './SettingsShell.jsx'

const SWITCHES = [
  { name: 'showBankDetails', title: 'Show bank details', desc: 'Print account number and IFSC for NEFT/RTGS payments' },
  { name: 'showSignature', title: 'Show authorised signatory', desc: 'Adds the signature block at the bottom' },
  { name: 'showAmountInWords', title: 'Show amount in words', desc: 'Rupees Four Lakh Eighty Five Thousand Only' },
]

export default function InvoiceSettingsPage() {
  const { state, updateSettings } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const saved = state.settings.invoice
  const [values, setValues] = useState(saved)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)
  const dirty = isDirty(values, saved)
  const readOnly = !can('Settings', 'edit')

  const set = (name, v) => {
    setValues((s) => ({ ...s, [name]: v }))
    setErrors((e) => ({ ...e, [name]: undefined }))
  }

  const nextNumber = useMemo(
    () => nextDocNumber({ ...state, settings: { ...state.settings, invoice: { ...state.settings.invoice, prefix: (values.prefix || 'INV').trim() } } }, 'salesInvoices', today()),
    [state, values.prefix],
  )

  const latest = useMemo(() => [...state.salesInvoices].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0], [state.salesInvoices])
  const customer = latest ? byId(state.customers).get(latest.customerId) : null

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    const prefix = (values.prefix || '').trim()
    if (!prefix) errs.prefix = 'Enter an invoice prefix'
    else if (!/^[A-Z0-9][A-Z0-9/-]*[A-Z0-9]$/.test(prefix)) errs.prefix = 'Use capital letters, numbers, / or - (not at the start or end)'
    if (!values.series?.trim()) errs.series = 'Enter the invoice series'
    if (!values.terms?.trim()) errs.terms = 'Enter terms and conditions'
    setErrors(errs)
    if (Object.keys(errs).length) return toast.error('Check the highlighted fields')
    setSaving(true)
    await fakeDelay(400)
    updateSettings('invoice', { ...values, prefix })
    updateSettings('company', { invoicePrefix: prefix })
    setSaving(false)
    toast.success('Invoice settings saved', `The next sales invoice will be ${nextNumber}.`)
  }

  return (
    <SettingsShell
      title="Invoice settings"
      subtitle="Numbering, terms and print options for sales invoices."
      actions={
        <>
          <Button icon={Eye} disabled={!latest} onClick={() => { if (dirty) toast.info('Showing saved settings', 'Save your changes to see them in the preview.'); setPreview(true) }}>
            Preview invoice
          </Button>
          {!readOnly && (
            <>
              <Button icon={RotateCcw} disabled={!dirty || saving} onClick={() => { setValues(saved); setErrors({}) }}>
                Discard
              </Button>
              <Button variant="primary" icon={Save} type="submit" form="invoice-form" loading={saving} disabled={!dirty}>
                Save changes
              </Button>
            </>
          )}
        </>
      }
    >
      <form id="invoice-form" onSubmit={submit} noValidate className="settings-grid">
        <div className="stack">
          <Card title="Numbering">
            <div className="form-grid">
              <Field label="Invoice series" required error={errors.series}>
                <Input value={values.series} disabled={readOnly} error={errors.series} onChange={(e) => set('series', e.target.value)} />
              </Field>
              <Field label="Prefix" required error={errors.prefix} hint="Changing the prefix restarts numbering at 0001">
                <Input value={values.prefix} disabled={readOnly} error={errors.prefix} onChange={(e) => set('prefix', e.target.value.toUpperCase())} />
              </Field>
              <Field label="Number format" hint="Financial-year series, resets every April">
                <Input value={values.numberFormat} readOnly />
              </Field>
            </div>
            <div className="mt-16">
              <div className="field-label" style={{ marginBottom: 6 }}>Next invoice number</div>
              <div className="number-preview">{nextNumber}</div>
            </div>
          </Card>

          <Card title="Printed content">
            <div className="stack">
              <Field label="Terms and conditions" required error={errors.terms} hint="One point per line">
                <Textarea rows={6} value={values.terms} disabled={readOnly} onChange={(e) => set('terms', e.target.value)} />
              </Field>
              <Field label="Footer note">
                <Input value={values.footer} disabled={readOnly} onChange={(e) => set('footer', e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card title="Print options">
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
          <Card title="Copies printed">
            <ul className="small ink-2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              {(values.copies || []).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Card>
          {latest && (
            <Card title="Latest invoice" subtitle="Used for the preview">
              <div className="stack-sm small">
                <span className="doc-no">{latest.number}</span>
                <span>{customer?.name}</span>
                <span className="muted">{fmtDate(latest.date)}</span>
              </div>
            </Card>
          )}
        </aside>
      </form>

      {latest && customer && (
        <DocumentPreview
          open={preview}
          onClose={() => setPreview(false)}
          title="Tax Invoice"
          subtitle="Original for Recipient"
          numberLabel="Invoice No."
          number={latest.number}
          date={latest.date}
          meta={[
            { label: 'Due date', value: fmtDate(latest.dueDate) },
            { label: 'Place of supply', value: latest.placeOfSupply },
            { label: 'Sales person', value: latest.salesPerson },
          ]}
          party={{ heading: 'Bill To', name: customer.name, legalName: customer.companyName, address: latest.billingAddress, gstin: customer.gstin, state: customer.state, phone: customer.mobile }}
          shipTo={{ heading: 'Ship To', name: customer.name, address: latest.shippingAddress }}
          lines={latest.lines}
          totals={latest.totals}
          interState={latest.totals.interState}
          showBank={saved.showBankDetails}
          onSend={false}
        />
      )}
    </SettingsShell>
  )
}
