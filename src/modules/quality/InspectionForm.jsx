/** New QC inspection — checklist, sample size and accept / reject / rework decision. Frontend-only demo. */
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardCheck, Plus, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId } from '../../store/selectors.js'
import { QC_PLANS, qcChecklist, qcPlanKey, routingFor, sampleSize, stageProgress } from '../../store/mfg.js'
import { QC_INSPECTORS, QC_RESULTS, QC_TYPES } from '../../data/constants.js'
import { uid } from '../../store/numbering.js'
import { addDays, fmtDate, num, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Button, Callout, Card, DatePicker, DocNo, Field, Input, PageHeader, Segmented, Select, StatusBadge, Textarea, useToast } from '../../components/ui/index.js'
import { QC_CRUMB } from './QualityDashboard.jsx'
import './quality.css'

const REF_OF = { Incoming: 'grns', 'Job Work': 'jobWorkReceipts', 'In-process': 'productionOrders', Final: 'productionOrders' }

/** Suggested decision from the checklist and quantities. */
const suggestResult = (checks, lot, rejected, rework) => {
  const anyFail = checks.some((c) => c.result === 'Fail')
  if (rework > 0) return 'Rework'
  if (lot > 0 && rejected / lot > 0.05) return 'Rejected'
  if (anyFail || rejected > 0) return 'Accepted with Deviation'
  return 'Accepted'
}

export default function InspectionForm() {
  usePageTitle('New inspection')
  const [params] = useSearchParams()
  const { state, save, get, previewNumber } = useErp()
  const navigate = useNavigate()
  const toast = useToast()
  const items = byId(state.items)
  const suppliers = byId(state.suppliers)
  const since = addDays(today(), -60)

  /** Source lots for a type: [{ value: 'refId|itemId', label, refId, itemId, … }] */
  const sourcesFor = (type) => {
    if (type === 'Incoming')
      return state.grns
        .filter((g) => !g.historical && g.date >= since)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .flatMap((g) => g.lines.filter((l) => Number(l.receivedQty) > 0).map((l) => ({
          value: `${g.id}|${l.itemId}`, refId: g.id, itemId: l.itemId, supplierId: g.supplierId, lot: Number(l.receivedQty), rejected: Number(l.rejectedQty) || 0,
          label: `${g.number}, ${items.get(l.itemId)?.name} (${num(l.receivedQty)})`,
        })))
    if (type === 'Job Work')
      return (state.jobWorkReceipts || [])
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .flatMap((r) => r.lines.map((l) => ({
          value: `${r.id}|${l.itemId}`, refId: r.id, itemId: l.itemId, supplierId: r.supplierId, lot: (Number(l.receivedQty) || 0) + (Number(l.rejectedQty) || 0), rejected: Number(l.rejectedQty) || 0,
          label: `${r.number}, ${items.get(l.itemId)?.name} (${num((Number(l.receivedQty) || 0) + (Number(l.rejectedQty) || 0))})`,
        })))
    return state.productionOrders
      .filter((o) => !o.historical && ['Released', 'In Progress', 'Completed'].includes(o.status))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((o) => {
        const qcStage = stageProgress(state, o).find((p) => p.stage === 'Final QC')
        return {
          value: `${o.id}|${o.productId}`, refId: o.id, itemId: o.productId, productionOrderId: o.id, rejected: 0,
          lot: type === 'Final' ? qcStage?.input || Number(o.plannedQty) : 50,
          label: `${o.number}, ${items.get(o.productId)?.name} (${o.status.toLowerCase()})`,
        }
      })
  }

  const buildFor = (type, sourceValue, stage) => {
    const src = sourcesFor(type).find((s) => s.value === sourceValue)
    const item = items.get(src?.itemId)
    const lot = src?.lot || ''
    const route = src?.productionOrderId ? stageProgress(state, get('productionOrders', src.productionOrderId)) : []
    return {
      type,
      source: src?.value || '',
      stage: type === 'Final' ? 'Final QC' : type === 'In-process' ? stage || route[0]?.stage || '' : '',
      lotQty: lot,
      sampleQty: lot ? sampleSize(lot) : '',
      rejectedQty: src?.rejected || 0,
      reworkQty: 0,
      checks: src ? qcChecklist(qcPlanKey(item, type)) : [],
      resultAuto: true,
      result: 'Accepted',
    }
  }

  const [values, setValues] = useState(() => {
    const type = QC_TYPES.includes(params.get('type')) ? params.get('type') : 'Incoming'
    const src = params.get('refId') && params.get('item') ? `${params.get('refId')}|${params.get('item')}` : ''
    return { date: today(), inspector: QC_INSPECTORS[0], remarks: '', ...buildFor(type, src, params.get('stage')) }
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const sources = sourcesFor(values.type)
  const src = sources.find((s) => s.value === values.source)
  const item = items.get(src?.itemId)
  const refCollection = REF_OF[values.type]
  const refDoc = src ? get(refCollection, src.refId) : null
  const order = src?.productionOrderId ? get('productionOrders', src.productionOrderId) : null
  const route = order && routingFor(state, order.productId) ? stageProgress(state, order) : []
  const planKey = qcPlanKey(item, values.type)
  const lot = Number(values.lotQty) || 0
  const rejected = Number(values.rejectedQty) || 0
  const rework = Number(values.reworkQty) || 0
  const accepted = Math.max(0, lot - rejected - rework)
  const suggested = suggestResult(values.checks, lot, rejected, rework)
  const result = values.resultAuto ? suggested : values.result
  const duplicate = src && (state.qcInspections || []).find((q) => q.type === values.type && q.refId === src.refId && q.itemId === src.itemId && (values.type !== 'In-process' || q.stage === values.stage))
  const refLink = !refDoc ? null : refCollection === 'grns' ? `/purchase/grn/${refDoc.id}` : refCollection === 'jobWorkReceipts' ? `/production/job-work/${refDoc.jobWorkOrderId}` : `/production/orders/${refDoc.id}`

  const set = (patch) => {
    setValues((s) => ({ ...s, ...patch }))
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }))
  }
  const setCheck = (idx, patch) => setValues((s) => ({ ...s, checks: s.checks.map((c, i) => (i === idx ? { ...c, ...patch } : c)) }))

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!src) errs.source = 'Select what you are inspecting'
    if (!values.date) errs.date = 'Select the date'
    if (!(lot > 0)) errs.lotQty = 'Enter the lot quantity'
    if (!(Number(values.sampleQty) > 0)) errs.sampleQty = 'Enter the sample size'
    else if (Number(values.sampleQty) > lot) errs.sampleQty = 'Can’t be more than the lot'
    if (rejected < 0 || rework < 0) errs.rejectedQty = 'Can’t be negative'
    else if (rejected + rework > lot) errs.rejectedQty = 'Rejected + rework can’t exceed the lot'
    if (values.type === 'In-process' && !values.stage) errs.stage = 'Select the stage'
    if (!values.checks.length) errs.checks = 'Add at least one check'
    if (values.checks.some((c) => !c.parameter.trim())) errs.checks = 'Every check needs a parameter'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', Object.values(errs)[0])
      return
    }
    setSaving(true)
    await fakeDelay(400)
    const saved = save('qcInspections', {
      date: values.date,
      type: values.type,
      planKey,
      refCollection,
      refId: src.refId,
      itemId: src.itemId,
      supplierId: src.supplierId || null,
      productionOrderId: src.productionOrderId || null,
      stage: values.stage,
      lotQty: lot,
      sampleQty: Number(values.sampleQty),
      checks: values.checks.map((c) => ({ ...c, parameter: c.parameter.trim(), observed: c.observed.trim() })),
      acceptedQty: accepted,
      rejectedQty: rejected,
      reworkQty: rework,
      result,
      inspector: values.inspector,
      remarks: values.remarks.trim(),
    })
    setSaving(false)
    toast.success(`Inspection recorded: ${result.toLowerCase()}`, `${saved.number} for ${num(lot)} ${item?.unit} of ${item?.name}.`)
    navigate(`/quality/inspections/${saved.id}`)
  }

  return (
    <>
      <PageHeader
        title="New inspection"
        subtitle="Check a sample against the QC plan and record the accept, reject or rework decision."
        breadcrumbs={[QC_CRUMB, { label: 'Inspections', to: '/quality/inspections' }, { label: 'New' }]}
      />
      <form onSubmit={submit} noValidate>
        <div className="qc-split">
          <div className="stack">
            <Card title="What is being inspected">
              <div className="form-grid">
                <Field label="QC no.">
                  <Input className="mono" readOnly value={previewNumber('qcInspections', values.date)} />
                </Field>
                <Field label="Date" required error={errors.date}>
                  <DatePicker value={values.date} onChange={(v) => set({ date: v })} />
                </Field>
                <Field label="Inspection type" required>
                  <Select options={QC_TYPES} value={values.type} onChange={(e) => setValues((s) => ({ ...s, ...buildFor(e.target.value, '') }))} />
                </Field>
                <Field
                  label={values.type === 'Incoming' ? 'GRN and item' : values.type === 'Job Work' ? 'Job work receipt and item' : 'Production order'}
                  required
                  error={errors.source}
                  span={values.type === 'In-process' ? 2 : 'full'}
                >
                  <Select options={sources} placeholder={sources.length ? 'Select' : 'Nothing available to inspect'} value={values.source} error={errors.source} onChange={(e) => setValues((s) => ({ ...s, ...buildFor(s.type, e.target.value) }))} />
                </Field>
                {values.type === 'In-process' && (
                  <Field label="Stage" required error={errors.stage}>
                    <Select options={route.map((r) => r.stage)} placeholder={route.length ? 'Select stage' : 'No process route'} value={values.stage} error={errors.stage} onChange={(e) => set({ stage: e.target.value })} />
                  </Field>
                )}
              </div>
              {src && (
                <div className="qc-ref-strip mt-16">
                  <div><div className="kv-label">Item</div><div className="kv-value truncate">{item?.name}</div></div>
                  <div><div className="kv-label">Source</div><div className="kv-value"><DocNo to={refLink}>{refDoc?.number}</DocNo></div></div>
                  <div><div className="kv-label">{src.supplierId ? 'Supplier' : 'Made in'}</div><div className="kv-value truncate">{src.supplierId ? suppliers.get(src.supplierId)?.name : 'In-house'}</div></div>
                  <div><div className="kv-label">QC plan</div><div className="kv-value truncate">{QC_PLANS[planKey]?.name}</div></div>
                </div>
              )}
            </Card>

            {duplicate && (
              <Callout tone="amber">
                {duplicate.number} already inspected this lot on {fmtDate(duplicate.date)} (<StatusBadge status={duplicate.result} />). Save only if this is a re-inspection.
              </Callout>
            )}

            <Card title="Checklist" subtitle={src ? `${values.checks.filter((c) => c.result === 'Fail').length} of ${values.checks.length} checks failed` : 'Select a lot to load its checklist'} flush>
              <div className="qc-checks">
                {values.checks.map((c, idx) => (
                  <div key={c.id} className={`qc-check ${c.result === 'Fail' ? 'fail' : ''}`}>
                    <div>
                      {c.custom ? (
                        <Input size="sm" value={c.parameter} placeholder="Parameter" aria-label="Parameter" onChange={(e) => setCheck(idx, { parameter: e.target.value })} />
                      ) : (
                        <>
                          <div className="qc-check-param">{c.parameter}</div>
                          <div className="qc-check-spec">Spec: {c.spec}</div>
                        </>
                      )}
                    </div>
                    <Input size="sm" value={c.observed} placeholder="Observed value" aria-label={`Observed for ${c.parameter}`} onChange={(e) => setCheck(idx, { observed: e.target.value })} />
                    <div className="row" style={{ gap: 4 }}>
                      <Segmented options={['Pass', 'Fail']} value={c.result} onChange={(v) => setCheck(idx, { result: v })} />
                      {c.custom && <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label="Remove check" onClick={() => set({ checks: values.checks.filter((_, i) => i !== idx) })} />}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '10px 16px' }}>
                {errors.checks && <div className="field-error" style={{ marginBottom: 8 }}>{errors.checks}</div>}
                {src && (
                  <Button size="sm" variant="soft" icon={Plus} onClick={() => set({ checks: [...values.checks, { id: uid('chk'), parameter: '', spec: 'As agreed', observed: '', result: 'Pass', custom: true }] })}>
                    Add check
                  </Button>
                )}
              </div>
            </Card>

            <Card title="Decision">
              <div className="form-grid">
                <Field label="Lot quantity" required error={errors.lotQty}>
                  <Input type="number" min="0" value={values.lotQty} error={errors.lotQty} onChange={(e) => { const v = e.target.value === '' ? '' : Number(e.target.value); set({ lotQty: v, sampleQty: v ? sampleSize(v) : '' }) }} />
                </Field>
                <Field label="Sample size" required error={errors.sampleQty} hint="AQL 2.5, general level II">
                  <Input type="number" min="0" value={values.sampleQty} error={errors.sampleQty} onChange={(e) => set({ sampleQty: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
                <Field label="Rejected" error={errors.rejectedQty}>
                  <Input type="number" min="0" value={values.rejectedQty} error={errors.rejectedQty} onChange={(e) => set({ rejectedQty: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
                <Field label="Rework">
                  <Input type="number" min="0" value={values.reworkQty} onChange={(e) => set({ reworkQty: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
                <Field label="Accepted" hint="Lot − rejected − rework">
                  <Input readOnly value={lot ? num(accepted) : ''} />
                </Field>
                <Field label="Result" hint={values.resultAuto ? 'Suggested from the checklist' : `Suggested: ${suggested}`}>
                  <Select options={QC_RESULTS} value={result} onChange={(e) => set({ result: e.target.value, resultAuto: e.target.value === suggested })} />
                </Field>
                <Field label="Inspector">
                  <Select options={QC_INSPECTORS} value={values.inspector} onChange={(e) => set({ inspector: e.target.value })} />
                </Field>
                <Field label="Remarks" span={2}>
                  <Textarea rows={2} value={values.remarks} placeholder="Segregated defective pieces, informed supplier…" onChange={(e) => set({ remarks: e.target.value })} />
                </Field>
              </div>
            </Card>
          </div>

          <aside className="stack">
            <Card title="Summary">
              <div className="totals" style={{ maxWidth: 'none' }}>
                <div className="totals-row"><span>Lot</span><span>{num(lot)}</span></div>
                <div className="totals-row"><span>Sample checked</span><span>{num(values.sampleQty || 0)}</span></div>
                <div className="totals-row"><span>Rejected</span><span className={rejected ? 'text-red' : ''}>{num(rejected)}</span></div>
                <div className="totals-row"><span>Rework</span><span className={rework ? 'text-amber' : ''}>{num(rework)}</span></div>
                <div className="totals-row grand"><span>Accepted</span><span>{num(accepted)}</span></div>
              </div>
              <div className="qc-result-hero mt-16">
                <ClipboardCheck size={16} />
                <span className="grow">Result</span>
                <StatusBadge status={result} />
              </div>
            </Card>
            <Callout>
              An inspection doesn’t move stock. Rejected pieces are booked on the GRN, job work receipt or production entry.
            </Callout>
          </aside>
        </div>

        <div className="sticky-actions form-actions">
          <Button onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" icon={ClipboardCheck} loading={saving}>Save inspection</Button>
        </div>
      </form>
    </>
  )
}
