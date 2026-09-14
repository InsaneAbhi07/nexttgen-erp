/**
 * Company profile — frontend-only demo. Saved to settings in the mock store and
 * used on invoice/PO print previews. Logo is stored as a data URL in localStorage.
 */
import { useRef, useState } from 'react'
import { ImageUp, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { STATE_NAMES, stateCode } from '../../data/constants.js'
import { fakeDelay } from '../../utils/hooks.js'
import { Button, Callout, Card, FormField, useToast } from '../../components/ui/index.js'
import BrandMark from '../../components/layout/BrandMark.jsx'
import SettingsShell, { isDirty } from './SettingsShell.jsx'
import { GSTIN_RE, validEmail } from '../masters/shared.jsx'

const SECTIONS = [
  {
    title: 'Business details',
    fields: [
      { name: 'name', label: 'Company name', required: true, hint: 'Shown on invoices and documents' },
      { name: 'legalName', label: 'Legal name', required: true },
      { name: 'gstin', label: 'GSTIN', required: true, uppercase: true, maxLength: 15 },
      { name: 'pan', label: 'PAN', required: true, uppercase: true, maxLength: 10 },
      { name: 'cin', label: 'CIN', uppercase: true },
      { name: 'msme', label: 'Udyam (MSME) number', uppercase: true },
    ],
  },
  {
    title: 'Address and contact',
    fields: [
      { name: 'address', label: 'Address', type: 'textarea', required: true, span: 'full', rows: 2 },
      { name: 'city', label: 'City', required: true },
      { name: 'state', label: 'State', type: 'select', required: true, options: STATE_NAMES },
      { name: 'pincode', label: 'Pincode', required: true, maxLength: 6 },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'mobile', label: 'Mobile', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'website', label: 'Website' },
    ],
  },
  {
    title: 'Invoicing and bank',
    fields: [
      { name: 'invoicePrefix', label: 'Invoice prefix', required: true, uppercase: true, hint: 'Used for new sales invoice numbers' },
      { name: 'financialYear', label: 'Financial year', readOnly: true, hint: 'April to March' },
      { name: 'bankName', label: 'Bank name' },
      { name: 'bankAccount', label: 'Account number' },
      { name: 'ifsc', label: 'IFSC', uppercase: true, maxLength: 11 },
      { name: 'bankBranch', label: 'Branch' },
    ],
  },
]

export default function CompanyProfilePage() {
  const { state, updateSettings } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const saved = state.settings.company
  const [values, setValues] = useState(saved)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const dirty = isDirty(values, saved)
  const readOnly = !can('Settings', 'edit')

  const set = (name, v) => {
    setValues((s) => ({ ...s, [name]: v }))
    setErrors((e) => ({ ...e, [name]: undefined }))
  }

  const onLogo = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Unsupported file', 'Choose a PNG, JPG or SVG image.')
    if (file.size > 300 * 1024) return toast.error('Logo is too large', 'Use an image under 300 KB so it fits in browser storage.')
    const reader = new FileReader()
    reader.onload = () => set('logo', reader.result)
    reader.readAsDataURL(file)
  }

  const validate = () => {
    const e = {}
    SECTIONS.flatMap((s) => s.fields).forEach((f) => {
      if (f.required && !String(values[f.name] ?? '').trim()) e[f.name] = `${f.type === 'select' ? 'Select' : 'Enter'} ${f.label.toLowerCase()}`
    })
    const g = (values.gstin || '').toUpperCase()
    if (g && !GSTIN_RE.test(g)) e.gstin = 'Enter a valid 15-character GSTIN'
    else if (g && values.state && g.slice(0, 2) !== stateCode(values.state)) e.gstin = `GSTIN should start with ${stateCode(values.state)} for ${values.state}`
    if (values.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(values.pan)) e.pan = 'PAN format is ABCDE1234F'
    else if (g && values.pan && g.slice(2, 12) !== values.pan) e.pan = 'PAN does not match the GSTIN'
    if (!validEmail(values.email)) e.email = 'Enter a valid email address'
    if (values.pincode && !/^\d{6}$/.test(values.pincode)) e.pincode = 'Pincode must be 6 digits'
    if (values.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(values.ifsc)) e.ifsc = 'IFSC format is HDFC0000452'
    return e
  }

  const submit = async (ev) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return toast.error('Check the highlighted fields', `${Object.keys(e).length} field(s) need attention.`)
    setSaving(true)
    await fakeDelay(450)
    updateSettings('company', values)
    updateSettings('invoice', { prefix: values.invoicePrefix })
    setSaving(false)
    toast.success('Company profile saved', 'Invoices and documents now use the updated details.')
  }

  return (
    <SettingsShell
      title="Company profile"
      subtitle="Business identity, GST registration, address and bank details printed on documents."
      actions={
        !readOnly && (
          <>
            <Button icon={RotateCcw} disabled={!dirty || saving} onClick={() => { setValues(saved); setErrors({}) }}>
              Discard
            </Button>
            <Button variant="primary" icon={Save} type="submit" form="company-form" loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </>
        )
      }
    >
      <form id="company-form" onSubmit={submit} noValidate className="settings-grid">
        <div className="stack">
          {readOnly && <Callout tone="amber">You can view these settings. Ask an administrator to make changes.</Callout>}
          {SECTIONS.map((section) => (
            <Card key={section.title} title={section.title}>
              <div className="form-grid">
                {section.fields.map((f) => (
                  <FormField key={f.name} def={{ ...f, disabled: readOnly }} value={values[f.name]} error={errors[f.name]} onChange={(v) => set(f.name, v)} />
                ))}
              </div>
            </Card>
          ))}
        </div>

        <aside className="settings-aside">
          <Card title="Logo" subtitle="PNG, JPG or SVG under 300 KB">
            <div className="row" style={{ gap: 14, alignItems: 'center' }}>
              <div className="logo-box">{values.logo ? <img src={values.logo} alt="Company logo" /> : <BrandMark size={52} />}</div>
              <div className="stack-sm">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogo} />
                <Button size="sm" icon={ImageUp} disabled={readOnly} onClick={() => fileRef.current?.click()}>
                  {values.logo ? 'Replace logo' : 'Upload logo'}
                </Button>
                {values.logo && (
                  <Button size="sm" variant="ghost" icon={Trash2} disabled={readOnly} onClick={() => set('logo', null)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card title="Document header preview" subtitle="Updates as you type">
            <div className="header-preview">
              <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                {values.logo ? <img src={values.logo} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} /> : <BrandMark size={34} />}
                <div style={{ minWidth: 0 }}>
                  <div className="hp-name">{values.name || 'Company name'}</div>
                  <div>{values.legalName}</div>
                  <div>
                    {[values.address, values.city, values.state].filter(Boolean).join(', ')} {values.pincode}
                  </div>
                  <div>
                    Phone {values.phone}, {values.email}
                  </div>
                  <div>
                    <b>GSTIN</b> {values.gstin} &nbsp; <b>PAN</b> {values.pan}
                  </div>
                </div>
              </div>
            </div>
            {dirty && <p className="tiny muted" style={{ marginTop: 8 }}>Unsaved changes. Save to apply them to printed documents.</p>}
          </Card>
        </aside>
      </form>
    </SettingsShell>
  )
}
