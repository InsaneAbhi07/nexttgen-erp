/**
 * Record receipt / Record payment — adjusts against an open invoice or on account.
 * Frontend-only demo: saving updates the mock store, outstanding and ledgers instantly.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { outstandingRows } from '../../store/selectors.js'
import { PAYMENT_MODES } from '../../data/constants.js'
import {
  Button, Callout, Card, DatePicker, Field, Input, KeyValue, PageHeader, Progress, Select, StatusBadge, Textarea, useToast,
} from '../../components/ui/index.js'
import { fmtDate, inr, today } from '../../utils/format.js'
import { fakeDelay, usePageTitle } from '../../utils/hooks.js'
import { REFERENCE_LABEL, VOUCHER_KINDS } from './config.js'

const defaultAccount = (mode, accounts) => (mode === 'Cash' ? accounts.find((a) => a.type === 'Cash') : accounts.find((a) => a.type === 'Bank'))?.id || ''

export default function VoucherForm({ kind }) {
  const K = VOUCHER_KINDS[kind]
  usePageTitle(K.addLabel)
  const { state, save, get, previewNumber } = useErp()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const accounts = state.settings.accounts || []

  const [values, setValues] = useState(() => {
    const inv = params.get('invoice') ? get(K.invoiceColl, params.get('invoice')) : null
    const partyId = inv?.[K.partyKey] || params.get(K.partyParam) || ''
    return {
      date: today(),
      partyId,
      invoiceId: inv?.id || '',
      amount: inv ? K.statusFn(state, inv).balance : '',
      mode: 'Bank',
      accountId: defaultAccount('Bank', accounts),
      reference: '',
      remarks: '',
    }
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (patchValues) => {
    setValues((v) => ({ ...v, ...patchValues }))
    setErrors((e) => {
      const next = { ...e }
      Object.keys(patchValues).forEach((k) => delete next[k])
      return next
    })
  }

  const party = get(K.partyColl, values.partyId)
  const openInvoices = useMemo(
    () =>
      values.partyId
        ? state[K.invoiceColl]
            .filter((i) => i[K.partyKey] === values.partyId)
            .map((inv) => ({ inv, st: K.statusFn(state, inv) }))
            .filter((r) => r.st.balance > 0)
            .sort((a, b) => (a.inv.date < b.inv.date ? -1 : 1))
        : [],
    [state, values.partyId, K],
  )
  const selected = openInvoices.find((r) => r.inv.id === values.invoiceId)
  const partyOutstanding = useMemo(
    () => outstandingRows(state, K.outType).filter((r) => r.partyId === values.partyId),
    [state, values.partyId, K.outType],
  )
  const outstandingTotal = partyOutstanding.reduce((a, r) => a + r.balance, 0)
  const overdueTotal = partyOutstanding.filter((r) => r.status === 'Overdue').reduce((a, r) => a + r.balance, 0)
  const amount = Number(values.amount) || 0
  const refMeta = REFERENCE_LABEL[values.mode]

  const partyOptions = state[K.partyColl]
    .filter((p) => p.status === 'Active' || p.id === values.partyId)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ value: p.id, label: `${p.name}, ${p.city}` }))

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!values.date) errs.date = 'Select the voucher date'
    if (!values.partyId) errs.partyId = `Select a ${K.partyLabel.toLowerCase()}`
    if (!(amount > 0)) errs.amount = 'Enter an amount greater than zero'
    if (!values.accountId) errs.accountId = 'Select the cash or bank account'
    if (values.mode !== 'Cash' && !values.reference.trim()) errs.reference = `Enter the ${refMeta.label.toLowerCase()}`
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', `${Object.keys(errs).length} field(s) need attention.`)
      return
    }
    setSaving(true)
    await fakeDelay(450)
    const saved = save(K.collection, {
      date: values.date,
      [K.partyKey]: values.partyId,
      invoiceId: values.invoiceId || null,
      amount,
      mode: values.mode,
      accountId: values.accountId,
      reference: values.reference.trim(),
      remarks: values.remarks.trim() || (selected && amount >= selected.st.balance ? 'Full settlement' : selected ? 'Part payment against invoice' : 'On account'),
    })
    setSaving(false)
    toast.success(
      `${K.singular} saved`,
      selected
        ? `${saved.number} recorded. ${selected.inv.number} balance is now ${inr(Math.max(0, selected.st.balance - amount))}.`
        : `${saved.number} recorded on account for ${party?.name}.`,
    )
    navigate(`${K.base}?view=${saved.id}`)
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={K.addLabel}
        subtitle={`Voucher ${previewNumber(K.collection, values.date)} will be created`}
        breadcrumbs={[{ label: 'Accounts', to: '/accounts/receipts' }, { label: K.title, to: K.base }, { label: K.addLabel }]}
      />

      <div className="grid-3">
        <Card className="span-2" title="Voucher details">
          <div className="form-grid cols-2">
            <Field label="Voucher no." hint="Generated automatically on save">
              <Input value={previewNumber(K.collection, values.date)} readOnly className="mono" />
            </Field>
            <Field label="Date" required error={errors.date}>
              <DatePicker value={values.date} max={today()} onChange={(date) => set({ date })} />
            </Field>
            <Field label={K.partyLabel} required error={errors.partyId} span={2}>
              <Select
                options={partyOptions}
                placeholder={`Select ${K.partyLabel.toLowerCase()}`}
                value={values.partyId}
                error={errors.partyId}
                onChange={(e) => set({ partyId: e.target.value, invoiceId: '', amount: '' })}
              />
            </Field>
            <Field label="Against invoice" span={2} hint={values.partyId && openInvoices.length === 0 ? 'No open invoices. The amount will be kept on account.' : 'Pick an open invoice or keep the amount on account'}>
              <Select
                disabled={!values.partyId}
                options={[
                  { value: '', label: 'On account (no invoice)' },
                  ...openInvoices.map((r) => ({ value: r.inv.id, label: `${r.inv.number}, ${fmtDate(r.inv.date)}, balance ${inr(r.st.balance)}${r.st.status === 'Overdue' ? ' (overdue)' : ''}` })),
                ]}
                value={values.invoiceId}
                onChange={(e) => {
                  const row = openInvoices.find((r) => r.inv.id === e.target.value)
                  set({ invoiceId: e.target.value, amount: row ? row.st.balance : values.amount })
                }}
              />
            </Field>
            <Field label="Amount" required error={errors.amount}>
              <Input type="number" min="0" step="any" prefix="₹" value={values.amount} error={errors.amount} onChange={(e) => set({ amount: e.target.value === '' ? '' : Number(e.target.value) })} />
            </Field>
            <Field label="Payment mode" required>
              <Select
                options={PAYMENT_MODES}
                value={values.mode}
                onChange={(e) => set({ mode: e.target.value, accountId: defaultAccount(e.target.value, accounts), reference: '' })}
              />
            </Field>
            <Field label={values.mode === 'Cash' ? 'Cash account' : 'Bank account'} required error={errors.accountId}>
              <Select
                options={accounts.filter((a) => (values.mode === 'Cash' ? a.type === 'Cash' : a.type === 'Bank')).map((a) => ({ value: a.id, label: `${a.name}${a.number ? ` (${a.number})` : ''}` }))}
                value={values.accountId}
                error={errors.accountId}
                onChange={(e) => set({ accountId: e.target.value })}
              />
            </Field>
            <Field label={refMeta.label} required={values.mode !== 'Cash'} error={errors.reference}>
              <Input value={values.reference} placeholder={refMeta.placeholder} error={errors.reference} onChange={(e) => set({ reference: e.target.value })} />
            </Field>
            <Field label="Remarks" span={2}>
              <Textarea rows={2} value={values.remarks} placeholder="e.g. Part payment, balance promised next week" onChange={(e) => set({ remarks: e.target.value })} />
            </Field>
          </div>
          {selected && amount > selected.st.balance + 0.5 && (
            <Callout tone="amber" style={{ marginTop: 14 }}>
              The amount is {inr(amount - selected.st.balance)} more than the invoice balance. The excess will stay on account.
            </Callout>
          )}
        </Card>

        <div className="stack">
          <Card title={party ? party.name : `${K.partyLabel} summary`} subtitle={party ? `${party.code}, ${party.city}, ${party.paymentTerms}` : `Select a ${K.partyLabel.toLowerCase()} to see their balance`}>
            {party ? (
              <div className="stack" style={{ gap: 12 }}>
                <KeyValue
                  cols={2}
                  items={[
                    { label: 'Total outstanding', value: inr(outstandingTotal) },
                    { label: 'Overdue', value: <span className={overdueTotal > 0 ? 'text-red' : ''}>{inr(overdueTotal)}</span> },
                    { label: 'Open invoices', value: partyOutstanding.length },
                    { label: 'GSTIN', value: <span className="small">{party.gstin}</span> },
                  ]}
                />
                {kind === 'receipts' && Number(party.creditLimit) > 0 && (
                  <div>
                    <div className="row-between small">
                      <span className="muted">Credit limit used</span>
                      <span className="strong">{Math.round((outstandingTotal / party.creditLimit) * 100)}% of {inr(party.creditLimit)}</span>
                    </div>
                    <Progress value={(outstandingTotal / party.creditLimit) * 100} tone={outstandingTotal > party.creditLimit ? 'red' : outstandingTotal > party.creditLimit * 0.75 ? 'amber' : ''} style={{ marginTop: 6 }} />
                  </div>
                )}
                <Link to={K.ledger(party.id)} className="small row" style={{ gap: 6 }}>
                  <BookOpen size={14} /> Open ledger
                </Link>
              </div>
            ) : (
              <p className="small muted">The balance, overdue amount and credit usage appear here.</p>
            )}
          </Card>

          {selected && (
            <Card title="Selected invoice" subtitle={`${selected.inv.number}, due ${fmtDate(selected.inv.dueDate)}`} actions={<StatusBadge status={selected.st.status} />}>
              <div className="totals" style={{ maxWidth: 'none' }}>
                <div className="totals-row"><span>Invoice amount</span><span>{inr(selected.st.amount)}</span></div>
                <div className="totals-row"><span>Already settled</span><span>{inr(selected.st.paid)}</span></div>
                <div className="totals-row"><span>Balance before this voucher</span><span>{inr(selected.st.balance)}</span></div>
                <div className="totals-row"><span>This voucher</span><span>− {inr(Math.min(amount, selected.st.balance))}</span></div>
                <div className="totals-row grand"><span>Balance after saving</span><span>{inr(Math.max(0, selected.st.balance - amount))}</span></div>
              </div>
              {selected.st.daysOverdue > 0 && <p className="small text-red" style={{ marginTop: 8 }}>Overdue by {selected.st.daysOverdue} days</p>}
            </Card>
          )}
        </div>
      </div>

      <div className="sticky-actions form-actions">
        <Button to={K.base} disabled={saving}>Cancel</Button>
        <Button type="submit" variant="primary" loading={saving}>
          {K.saveLabel}
        </Button>
      </div>
    </form>
  )
}
