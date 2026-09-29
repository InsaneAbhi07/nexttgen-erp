/** Record stage output — OK, rejected and rework pieces at one process stage. Frontend-only demo. */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId } from '../../store/selectors.js'
import { currentStageIndex, routingFor, stageProgress } from '../../store/mfg.js'
import { WORK_CENTRES } from '../../data/constants.js'
import { num, today } from '../../utils/format.js'
import { fakeDelay } from '../../utils/hooks.js'
import { Button, Callout, DatePicker, Drawer, Field, Input, Select, StatusBadge, Textarea, useToast } from '../../components/ui/index.js'
import { SHIFTS } from './shared.jsx'

const OPEN = ['Released', 'In Progress']
const qtyValue = (v) => (v === '' ? '' : Number(v))

export default function StageEntryDrawer({ open, onClose, orderId, stage }) {
  const { state, save, patch, get, previewNumber } = useErp()
  const toast = useToast()
  const items = byId(state.items)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const progressOf = (oid) => {
    const o = get('productionOrders', oid)
    return o ? stageProgress(state, o) : []
  }
  const defaultStage = (oid, preferred) => {
    const prog = progressOf(oid)
    if (preferred && prog.some((p) => p.stage === preferred)) return preferred
    return prog[currentStageIndex(prog)]?.stage || ''
  }
  const blankFor = (oid, preferred) => {
    const st = defaultStage(oid, preferred)
    return {
      date: today(),
      productionOrderId: oid || '',
      stage: st,
      okQty: '',
      rejectedQty: 0,
      reworkQty: 0,
      operator: '',
      workCentre: WORK_CENTRES[st]?.[0] || '',
      shift: 'Day',
      remarks: '',
    }
  }

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm(blankFor(orderId, stage))
    } else setForm(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId, stage])

  const order = form ? get('productionOrders', form.productionOrderId) : null
  const progress = order ? stageProgress(state, order) : []
  const op = progress.find((p) => p.stage === form?.stage)
  const product = items.get(order?.productId)
  const jobWork = op?.mode === 'Job Work'

  const orderOptions = state.productionOrders
    .filter((o) => (OPEN.includes(o.status) && routingFor(state, o.productId)) || o.id === form?.productionOrderId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((o) => ({ value: o.id, label: `${o.number}, ${items.get(o.productId)?.name} (${o.status.toLowerCase()})` }))
  const stageOptions = progress.map((p) => ({ value: p.stage, label: `${p.index + 1}. ${p.stage}${p.waiting ? ` (${num(p.waiting)} waiting)` : ''}` }))
  const operators = [...new Set((state.stageEntries || []).map((e) => e.operator).filter(Boolean))].sort()

  const set = (patchValues) => {
    setForm((f) => ({ ...f, ...patchValues }))
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patchValues).map((k) => [k, undefined])) }))
  }
  const onOrder = (oid) => {
    const st = defaultStage(oid)
    set({ productionOrderId: oid, stage: st, workCentre: WORK_CENTRES[st]?.[0] || '' })
  }
  const onStage = (st) => {
    const o = progress.find((p) => p.stage === st)
    set({ stage: st, workCentre: o?.mode === 'Job Work' ? '' : o?.workCentre || WORK_CENTRES[st]?.[0] || '' })
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    const ok = Number(form.okQty) || 0
    const rej = Number(form.rejectedQty) || 0
    if (!form.productionOrderId) errs.productionOrderId = 'Select a production order'
    if (!form.stage) errs.stage = 'Select a stage'
    if (!form.date) errs.date = 'Select the date'
    if (ok < 0) errs.okQty = 'Can’t be negative'
    if (rej < 0) errs.rejectedQty = 'Can’t be negative'
    if (Number(form.reworkQty) < 0) errs.reworkQty = 'Can’t be negative'
    if (!errs.okQty && !errs.rejectedQty) {
      if (ok + rej <= 0) errs.okQty = 'Enter the OK or rejected quantity'
      else if (op && ok + rej > op.waiting) errs.okQty = `Only ${num(op.waiting)} pieces are waiting at this stage`
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    await fakeDelay(350)
    const saved = save('stageEntries', {
      date: form.date,
      productionOrderId: order.id,
      productId: order.productId,
      stage: form.stage,
      operationId: op?.id || '',
      workCentre: jobWork ? '' : form.workCentre,
      mode: op?.mode || 'In-house',
      okQty: ok,
      rejectedQty: rej,
      reworkQty: Number(form.reworkQty) || 0,
      operator: form.operator.trim(),
      shift: form.shift,
      remarks: form.remarks.trim(),
    })
    if (order.status === 'Released') patch('productionOrders', order.id, { status: 'In Progress' }, { silent: true })
    setSaving(false)
    toast.success('Stage output recorded', `${saved.number}: ${num(ok)} OK${rej ? `, ${num(rej)} rejected` : ''} at ${form.stage.toLowerCase()} for ${order.number}.`)
    onClose()
  }

  return (
    <Drawer
      open={open && Boolean(form)}
      onClose={() => !saving && onClose()}
      title="Record stage output"
      subtitle="Pieces that pass a stage move on to the next one"
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" type="submit" form="stage-entry-form" loading={saving}>Record output</Button>
        </>
      }
    >
      {form && (
        <form id="stage-entry-form" onSubmit={submit} noValidate>
          <div className="form-grid cols-2">
            <Field label="Entry no.">
              <Input className="mono" readOnly value={previewNumber('stageEntries', form.date)} />
            </Field>
            <Field label="Date" required error={errors.date}>
              <DatePicker value={form.date} onChange={(v) => set({ date: v })} />
            </Field>
            <Field label="Production order" required error={errors.productionOrderId} span="full" hint={orderOptions.length ? undefined : 'No released orders have a process route yet'}>
              <Select options={orderOptions} placeholder="Select an open production order" value={form.productionOrderId} error={errors.productionOrderId} onChange={(e) => onOrder(e.target.value)} />
            </Field>
            <Field label="Stage" required error={errors.stage} span="full">
              <Select options={stageOptions} placeholder={order ? 'Select stage' : 'Select an order first'} value={form.stage} error={errors.stage} onChange={(e) => onStage(e.target.value)} />
            </Field>
          </div>

          {op && (
            <div className="prd-stage-strip mt-16">
              <div><div className="kv-label">Received</div><div className="kv-value">{num(op.input)}</div></div>
              <div><div className="kv-label">Passed on</div><div className="kv-value">{num(op.ok)}</div></div>
              <div><div className="kv-label">Rejected</div><div className={`kv-value ${op.rejected ? 'text-red' : ''}`}>{num(op.rejected)}</div></div>
              <div><div className="kv-label">Waiting</div><div className="kv-value strong">{num(op.waiting)} {product?.unit}</div></div>
            </div>
          )}

          {jobWork && (
            <Callout icon={Send} style={{ marginTop: 14 }}>
              {form.stage} is done by a job worker ({op.process.toLowerCase()}). Send material on a job work challan, then record the pieces received back here.{' '}
              <Link to={`/production/job-work/new?order=${order.id}&process=${encodeURIComponent(op.process)}`} onClick={onClose}>Create job work challan</Link>
            </Callout>
          )}

          <div className="form-grid mt-16">
            <Field label="OK quantity" required error={errors.okQty}>
              <Input type="number" min="0" step="1" value={form.okQty} error={errors.okQty} onChange={(e) => set({ okQty: qtyValue(e.target.value) })} />
            </Field>
            <Field label="Rejected" error={errors.rejectedQty}>
              <Input type="number" min="0" step="1" value={form.rejectedQty} error={errors.rejectedQty} onChange={(e) => set({ rejectedQty: qtyValue(e.target.value) })} />
            </Field>
            <Field label="Rework" error={errors.reworkQty} hint="Stays at this stage">
              <Input type="number" min="0" step="1" value={form.reworkQty} error={errors.reworkQty} onChange={(e) => set({ reworkQty: qtyValue(e.target.value) })} />
            </Field>
          </div>
          <div className="form-grid cols-2 mt-16">
            {!jobWork && (
              <Field label="Work centre">
                <Select options={WORK_CENTRES[form.stage] || []} placeholder="Select work centre" value={form.workCentre} onChange={(e) => set({ workCentre: e.target.value })} />
              </Field>
            )}
            {!jobWork && (
              <Field label="Operator">
                <Input list="stage-operators" value={form.operator} placeholder="Operator name" onChange={(e) => set({ operator: e.target.value })} />
                <datalist id="stage-operators">
                  {operators.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </Field>
            )}
            <Field label="Shift">
              <Select options={SHIFTS} value={form.shift} onChange={(e) => set({ shift: e.target.value })} />
            </Field>
            {order && (
              <Field label="Order status">
                <div style={{ paddingTop: 6 }}><StatusBadge status={order.status} /></div>
              </Field>
            )}
            <Field label="Remarks" span="full">
              <Textarea rows={2} value={form.remarks} placeholder={jobWork ? 'Received back against JWR…' : 'Die change, machine downtime…'} onChange={(e) => set({ remarks: e.target.value })} />
            </Field>
          </div>
        </form>
      )}
    </Drawer>
  )
}
