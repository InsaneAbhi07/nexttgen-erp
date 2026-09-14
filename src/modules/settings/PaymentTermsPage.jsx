/**
 * Payment terms — frontend-only demo. Terms are referenced by name on customers and suppliers.
 */
import { useState } from 'react'
import { Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { uid } from '../../store/numbering.js'
import { fakeDelay } from '../../utils/hooks.js'
import { num } from '../../utils/format.js'
import { Button, DataTable, FormField, Modal, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import SettingsShell from './SettingsShell.jsx'

export default function PaymentTermsPage() {
  const { state, updateSettings } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const terms = state.settings.paymentTerms
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const usedBy = (name) => state.customers.filter((c) => c.paymentTerms === name).length + state.suppliers.filter((s) => s.paymentTerms === name).length

  const openAdd = () => setForm({ values: { name: '', days: 30, description: '', status: 'Active' }, errors: {} })
  const openEdit = (t) => setForm({ values: { ...t }, errors: {} })
  const set = (k, v) => setForm((f) => ({ ...f, values: { ...f.values, [k]: v }, errors: { ...f.errors, [k]: undefined } }))

  const submit = async (e) => {
    e.preventDefault()
    const v = form.values
    const errors = {}
    if (!v.name?.trim()) errors.name = 'Enter a name'
    else if (terms.some((t) => t.name.toLowerCase() === v.name.trim().toLowerCase() && t.id !== v.id)) errors.name = 'This payment term already exists'
    if (v.days === '' || Number(v.days) < 0 || Number(v.days) > 365) errors.days = 'Enter 0 to 365 days'
    if (Object.keys(errors).length) return setForm((f) => ({ ...f, errors }))
    setSaving(true)
    await fakeDelay(300)
    const record = { ...v, name: v.name.trim(), days: Number(v.days) }
    updateSettings('paymentTerms', v.id ? terms.map((t) => (t.id === v.id ? record : t)) : [...terms, { ...record, id: uid('pt') }])
    setSaving(false)
    setForm(null)
    toast.success(v.id ? 'Payment term updated' : 'Payment term added', record.name)
  }

  const toggle = (t) => {
    updateSettings('paymentTerms', terms.map((x) => (x.id === t.id ? { ...x, status: x.status === 'Active' ? 'Inactive' : 'Active' } : x)))
    toast.success(t.status === 'Active' ? 'Payment term deactivated' : 'Payment term activated', t.name)
  }

  const del = async (t) => {
    const n = usedBy(t.name)
    if (n) return toast.error('This payment term can’t be deleted', `${n} customer(s) or supplier(s) use ${t.name}. Mark it inactive instead.`)
    const ok = await confirm({ title: 'Delete payment term?', message: `${t.name} will be removed.`, confirmLabel: 'Delete', tone: 'danger' })
    if (!ok) return
    updateSettings('paymentTerms', terms.filter((x) => x.id !== t.id))
    toast.success('Payment term deleted', t.name)
  }

  const editing = form?.values.id
  const nameLocked = editing && usedBy(terms.find((t) => t.id === editing)?.name) > 0

  return (
    <SettingsShell
      title="Payment terms"
      subtitle="Credit periods offered to customers and agreed with suppliers. Due dates are calculated from these."
      actions={
        can('Settings', 'add') && (
          <Button variant="primary" icon={Plus} onClick={openAdd}>
            Add payment term
          </Button>
        )
      }
    >
      <DataTable
        data={terms}
        exportName="payment-terms"
        searchPlaceholder="Search payment terms…"
        initialSort={{ key: 'days', dir: 'asc' }}
        onRowClick={can('Settings', 'edit') ? openEdit : undefined}
        columns={[
          { key: 'name', header: 'Name', render: (t) => <span className="cell-primary">{t.name}</span> },
          { key: 'days', header: 'Credit days', align: 'right', render: (t) => (t.days ? `${t.days} days` : 'Immediate') },
          { key: 'description', header: 'Description', render: (t) => <span className="ink-2">{t.description || '—'}</span> },
          { key: 'used', header: 'Used by', align: 'right', accessor: (t) => usedBy(t.name), render: (t) => `${num(usedBy(t.name))} parties` },
          { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
        ]}
        rowActions={(t) =>
          [
            can('Settings', 'edit') && { label: 'Edit', icon: Pencil, onClick: () => openEdit(t) },
            can('Settings', 'edit') && { label: t.status === 'Active' ? 'Deactivate' : 'Activate', icon: Power, onClick: () => toggle(t) },
            can('Settings', 'delete') && { divider: true },
            can('Settings', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => del(t) },
          ].filter(Boolean)
        }
      />

      <Modal
        open={Boolean(form)}
        onClose={() => !saving && setForm(null)}
        title={editing ? 'Edit payment term' : 'Add payment term'}
        size="sm"
        footer={
          <>
            <Button onClick={() => setForm(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="term-form" loading={saving}>
              {editing ? 'Save changes' : 'Add payment term'}
            </Button>
          </>
        }
      >
        {form && (
          <form id="term-form" onSubmit={submit} noValidate className="form-grid cols-1">
            <FormField def={{ name: 'name', label: 'Name', required: true, placeholder: 'e.g. 90 Days', readOnly: nameLocked, hint: nameLocked ? 'Name is locked because parties use this term' : undefined }} value={form.values.name} error={form.errors.name} onChange={(v) => set('name', v)} />
            <FormField def={{ name: 'days', label: 'Credit days', type: 'number', required: true, step: 1, hint: 'Use 0 for cash or advance' }} value={form.values.days} error={form.errors.days} onChange={(v) => set('days', v)} />
            <FormField def={{ name: 'description', label: 'Description', type: 'textarea', rows: 2 }} value={form.values.description} onChange={(v) => set('description', v)} />
            <FormField def={{ name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], placeholder: undefined }} value={form.values.status} onChange={(v) => set('status', v)} />
          </form>
        )}
      </Modal>
    </SettingsShell>
  )
}
