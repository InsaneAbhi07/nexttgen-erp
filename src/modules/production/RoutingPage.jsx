/** Process routes — the ordered stages a product passes through on the shop floor. Frontend-only demo. */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Eye, Pencil, Plus, Power, Route, Send, Trash2, Workflow } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { JOB_WORK_PROCESSES, OPERATION_MODES, PROCESS_STAGES, WORK_CENTRES } from '../../data/constants.js'
import { uid } from '../../store/numbering.js'
import { inr2, num } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Badge, Button, DataTable, Drawer, Field, FilterPanel, Input, KeyValue, PageHeader, Select, StatCard, StatusBadge, Textarea, useConfirm, useToast } from '../../components/ui/index.js'
import { CRUMB, MFG_PRODUCT_TYPES, MiniTable } from './shared.jsx'

const newOp = (stage = 'Machining') => ({ id: uid('op'), stage, workCentre: WORK_CENTRES[stage]?.[0] || '', mode: 'In-house', process: '', outputPerHour: '', ratePerPc: '', qcRequired: stage === 'Final QC' })

export function RouteChips({ operations = [] }) {
  return (
    <div className="prd-route-chips">
      {operations.map((op, i) => (
        <span key={op.id} className="row" style={{ gap: 4 }}>
          {i > 0 && <span aria-hidden>→</span>}
          <span className={`prd-route-chip ${op.mode === 'Job Work' ? 'jw' : ''}`} title={op.mode === 'Job Work' ? `Job work: ${op.process}` : op.workCentre}>
            {op.stage}
          </span>
        </span>
      ))}
    </div>
  )
}

export default function RoutingPage() {
  usePageTitle('Process routes')
  const { state, save, remove, get } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState({})
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const items = byId(state.items)
  const routings = state.routings || []
  const viewing = params.get('view') ? get('routings', params.get('view')) : null

  const openAdd = () => {
    setErrors({})
    setForm({ code: '', productId: '', status: 'Active', remarks: '', operations: [newOp('Machining'), newOp('Assembly'), newOp('Final QC'), newOp('Packing')] })
  }
  const openEdit = (r) => {
    setErrors({})
    closeView()
    setForm({ ...r, operations: r.operations.map((o) => ({ ...o })) })
  }

  useEffect(() => {
    if (params.get('new') === '1') {
      openAdd()
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const closeView = () => {
    const next = new URLSearchParams(params)
    next.delete('view')
    setParams(next, { replace: true })
  }
  const openView = (r) => {
    const next = new URLSearchParams(params)
    next.set('view', r.id)
    setParams(next)
  }

  const rows = useMemo(
    () =>
      routings.map((r) => {
        const product = items.get(r.productId)
        return { ...r, product, productName: product?.name || '—', stages: r.operations.length, jobWork: r.operations.filter((o) => o.mode === 'Job Work').length }
      }),
    [routings, items],
  )
  const data = rows.filter((r) => (!filters.status || r.status === filters.status) && (!filters.stage || r.operations.some((o) => o.stage === filters.stage)))

  const mfgItems = state.items.filter((i) => MFG_PRODUCT_TYPES.includes(i.type) && i.status === 'Active')
  const withoutRoute = mfgItems.filter((i) => i.type === 'Finished Good' && state.boms.some((b) => b.productId === i.id && b.status === 'Active') && !routings.some((r) => r.productId === i.id && r.status === 'Active'))
  const productOptions = mfgItems.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))

  const setField = (k, v) => {
    setForm((f) => {
      const next = { ...f, [k]: v }
      if (k === 'productId' && !f.id) {
        const p = items.get(v)
        next.code = p ? `RT-${p.code.replace(/-/g, '')}` : ''
      }
      return next
    })
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const setOp = (idx, patch) =>
    setForm((f) => ({
      ...f,
      operations: f.operations.map((o, i) => {
        if (i !== idx) return o
        const next = { ...o, ...patch }
        if ('stage' in patch) {
          next.workCentre = WORK_CENTRES[patch.stage]?.[0] || ''
          next.qcRequired = patch.stage === 'Final QC'
        }
        if ('mode' in patch) {
          next.process = patch.mode === 'Job Work' ? next.process || JOB_WORK_PROCESSES[0] : ''
          next.workCentre = patch.mode === 'Job Work' ? '' : WORK_CENTRES[next.stage]?.[0] || ''
        }
        return next
      }),
    }))
  const moveOp = (idx, dir) =>
    setForm((f) => {
      const ops = [...f.operations]
      const j = idx + dir
      if (j < 0 || j >= ops.length) return f
      ;[ops[idx], ops[j]] = [ops[j], ops[idx]]
      return { ...f, operations: ops }
    })
  const removeOp = (idx) => setForm((f) => ({ ...f, operations: f.operations.filter((_, i) => i !== idx) }))

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.productId) errs.productId = 'Select a product'
    if (!form.code.trim()) errs.code = 'Enter a route code'
    if (!form.operations.length) errs.operations = 'Add at least one stage'
    if (form.status === 'Active' && routings.some((r) => r.productId === form.productId && r.status === 'Active' && r.id !== form.id))
      errs.productId = 'This product already has an active route. Deactivate it first.'
    if (form.operations.some((o) => o.mode === 'Job Work' && !o.process)) errs.operations = 'Select the job work process for every job work stage'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', Object.values(errs)[0])
      return
    }
    setSaving(true)
    await fakeDelay(350)
    const saved = save('routings', {
      ...form,
      code: form.code.trim(),
      bomId: state.boms.find((b) => b.productId === form.productId && b.status === 'Active')?.id || null,
      operations: form.operations.map((o) => ({ ...o, outputPerHour: Number(o.outputPerHour) || 0, ratePerPc: Number(o.ratePerPc) || 0 })),
    })
    setSaving(false)
    setForm(null)
    toast.success(form.id ? 'Process route updated' : 'Process route added', `${saved.code}: ${saved.operations.length} stages for ${items.get(saved.productId)?.name}.`)
  }

  const toggle = (r) => {
    const status = r.status === 'Active' ? 'Inactive' : 'Active'
    if (status === 'Active' && routings.some((x) => x.productId === r.productId && x.status === 'Active' && x.id !== r.id)) {
      toast.error('Can’t activate this route', 'The product already has another active route.')
      return
    }
    save('routings', { ...r, status })
    toast.success(status === 'Active' ? 'Route activated' : 'Route deactivated', r.code)
  }
  const handleDelete = async (r) => {
    const used = (state.stageEntries || []).some((e) => e.productId === r.productId)
    if (used && r.status === 'Active') {
      toast.error('This route can’t be deleted', 'Stage output has been recorded against it. Deactivate it instead.')
      return
    }
    const ok = await confirm({ title: 'Delete process route?', message: `${r.code} will be removed.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      closeView()
      remove('routings', r.id)
      toast.success('Process route deleted', r.code)
    }
  }

  const columns = [
    { key: 'code', header: 'Route', render: (r) => <span className="doc-no">{r.code}</span> },
    { key: 'productName', header: 'Product', render: (r) => (<div><div className="cell-primary">{r.productName}</div><div className="cell-secondary">{r.product?.code}</div></div>) },
    { key: 'stages', header: 'Stage flow', accessor: (r) => r.operations.map((o) => o.stage).join(' '), render: (r) => <RouteChips operations={r.operations} /> },
    { key: 'jobWork', header: 'Job work', align: 'right', render: (r) => (r.jobWork ? <Badge tone="violet">{r.jobWork} stage{r.jobWork > 1 ? 's' : ''}</Badge> : <span className="muted">—</span>) },
    { key: 'rate', header: 'Labour / pc', align: 'right', accessor: (r) => r.operations.reduce((a, o) => a + (Number(o.ratePerPc) || 0), 0), render: (r) => inr2(r.operations.reduce((a, o) => a + (Number(o.ratePerPc) || 0), 0)) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  const stageUse = PROCESS_STAGES.map((s) => ({ s, n: routings.filter((r) => r.status === 'Active' && r.operations.some((o) => o.stage === s)).length }))

  return (
    <>
      <PageHeader
        title="Process routes"
        subtitle="The sequence of shop-floor stages each product passes through, from die casting to packing."
        breadcrumbs={[CRUMB, { label: 'Process routes' }]}
        actions={
          <>
            <Button icon={Workflow} to="/production/shop-floor">Shop floor</Button>
            {can('Production', 'add') && <Button variant="primary" icon={Plus} onClick={openAdd}>Add process route</Button>}
          </>
        }
      />

      <div className="grid-4 mb-16">
        <StatCard label="Active routes" value={routings.filter((r) => r.status === 'Active').length} icon={Route} tone="brass" foot={`${routings.length} routes in total`} />
        <StatCard label="Stages defined" value={PROCESS_STAGES.length} icon={Workflow} tone="blue" foot={stageUse.filter((x) => x.n).map((x) => x.s).slice(0, 3).join(', ') + '…'} />
        <StatCard label="Job work stages" value={routings.reduce((a, r) => a + r.operations.filter((o) => o.mode === 'Job Work').length, 0)} icon={Send} tone="violet" foot="Plating and finishing sent outside" to="/production/job-work" />
        <StatCard label="Products without a route" value={withoutRoute.length} icon={Power} tone={withoutRoute.length ? 'amber' : 'green'} foot={withoutRoute.length ? withoutRoute.slice(0, 2).map((i) => i.name).join(', ') : 'Every BOM product has a route'} />
      </div>

      <DataTable
        columns={columns}
        data={data}
        exportName="process-routes"
        initialSort={{ key: 'code', dir: 'asc' }}
        searchPlaceholder="Search route or product…"
        onRowClick={openView}
        filters={
          <FilterPanel
            filters={[
              { key: 'stage', label: 'Stage', options: PROCESS_STAGES, placeholder: 'Any stage' },
              { key: 'status', label: 'Status', options: ['Active', 'Inactive'], placeholder: 'All statuses' },
            ]}
            values={filters}
            onChange={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
            onReset={() => setFilters({})}
          />
        }
        rowActions={(r) => [
          { label: 'View route', icon: Eye, onClick: () => openView(r) },
          can('Production', 'edit') && { label: 'Edit', icon: Pencil, onClick: () => openEdit(r) },
          can('Production', 'edit') && { label: r.status === 'Active' ? 'Deactivate' : 'Activate', icon: Power, onClick: () => toggle(r) },
          can('Production', 'delete') && { divider: true },
          can('Production', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(r) },
        ].filter(Boolean)}
        emptyTitle="No process routes yet"
        emptyDescription="Define the stages a product goes through to track work-in-progress on the shop floor."
        emptyAction={can('Production', 'add') && <Button size="sm" variant="primary" icon={Plus} onClick={openAdd}>Add process route</Button>}
      />

      {/* View */}
      <Drawer
        open={Boolean(viewing)}
        onClose={closeView}
        size="lg"
        title={viewing ? items.get(viewing.productId)?.name : ''}
        subtitle={viewing ? <span className="row" style={{ gap: 8, marginTop: 4 }}><span className="doc-no">{viewing.code}</span><StatusBadge status={viewing.status} /></span> : null}
        footer={
          viewing && (
            <>
              <Button onClick={closeView}>Close</Button>
              {can('Production', 'edit') && <Button variant="primary" icon={Pencil} onClick={() => openEdit(viewing)}>Edit route</Button>}
            </>
          )
        }
      >
        {viewing && (
          <div className="stack">
            <KeyValue
              cols={2}
              items={[
                { label: 'Product', value: items.get(viewing.productId)?.name },
                { label: 'BOM', value: state.boms.find((b) => b.id === viewing.bomId)?.code },
                { label: 'Stages', value: viewing.operations.length },
                { label: 'Labour per piece', value: inr2(viewing.operations.reduce((a, o) => a + (Number(o.ratePerPc) || 0), 0)) },
                { label: 'Remarks', value: viewing.remarks, span: 2 },
              ]}
            />
            <RouteChips operations={viewing.operations} />
            <MiniTable
              columns={[
                { key: 'n', header: '#', render: (o) => viewing.operations.indexOf(o) + 1 },
                { key: 'stage', header: 'Stage', render: (o) => <span className="cell-primary">{o.stage}</span> },
                { key: 'mode', header: 'Done by', render: (o) => <StatusBadge status={o.mode} /> },
                { key: 'where', header: 'Work centre / process', render: (o) => (o.mode === 'Job Work' ? o.process : o.workCentre) || '—' },
                { key: 'outputPerHour', header: 'Output / hr', align: 'right', render: (o) => (o.outputPerHour ? num(o.outputPerHour) : '—') },
                { key: 'ratePerPc', header: 'Rate / pc', align: 'right', render: (o) => inr2(o.ratePerPc) },
              ]}
              rows={viewing.operations}
            />
          </div>
        )}
      </Drawer>

      {/* Add / edit */}
      <Drawer
        open={Boolean(form)}
        onClose={() => !saving && setForm(null)}
        size="lg"
        title={form?.id ? `Edit ${form.code}` : 'Add process route'}
        subtitle="Stages run top to bottom. Pieces that pass one stage move to the next."
        footer={
          <>
            <Button onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" form="routing-form" loading={saving}>{form?.id ? 'Save changes' : 'Add route'}</Button>
          </>
        }
      >
        {form && (
          <form id="routing-form" onSubmit={submit} noValidate>
            <div className="form-grid cols-2">
              <Field label="Product" required error={errors.productId} span="full">
                <Select options={productOptions} placeholder="Select finished or semi-finished product" value={form.productId} error={errors.productId} onChange={(e) => setField('productId', e.target.value)} />
              </Field>
              <Field label="Route code" required error={errors.code}>
                <Input className="mono" value={form.code} error={errors.code} onChange={(e) => setField('code', e.target.value.toUpperCase())} />
              </Field>
              <Field label="Status">
                <Select options={['Active', 'Inactive']} value={form.status} onChange={(e) => setField('status', e.target.value)} />
              </Field>
            </div>

            <div className="form-section-title" style={{ margin: '18px 0 10px' }}>Stages</div>
            {errors.operations && <div className="field-error" style={{ marginBottom: 8 }}>{errors.operations}</div>}
            <div className="prd-ops-editor">
              {form.operations.map((op, i) => (
                <div key={op.id} className="prd-op-row">
                  <div className="prd-op-row-head">
                    <span>{i + 1}. {op.stage}</span>
                    <span className="actions">
                      <Button size="sm" variant="ghost" iconOnly icon={ArrowUp} aria-label="Move up" disabled={i === 0} onClick={() => moveOp(i, -1)} />
                      <Button size="sm" variant="ghost" iconOnly icon={ArrowDown} aria-label="Move down" disabled={i === form.operations.length - 1} onClick={() => moveOp(i, 1)} />
                      <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label="Remove stage" onClick={() => removeOp(i)} />
                    </span>
                  </div>
                  <div className="form-grid cols-2">
                    <Field label="Stage">
                      <Select size="sm" options={PROCESS_STAGES} value={op.stage} onChange={(e) => setOp(i, { stage: e.target.value })} />
                    </Field>
                    <Field label="Done by">
                      <Select size="sm" options={OPERATION_MODES} value={op.mode} onChange={(e) => setOp(i, { mode: e.target.value })} />
                    </Field>
                    {op.mode === 'Job Work' ? (
                      <Field label="Job work process">
                        <Select size="sm" options={JOB_WORK_PROCESSES} value={op.process} onChange={(e) => setOp(i, { process: e.target.value })} />
                      </Field>
                    ) : (
                      <Field label="Work centre">
                        <Select size="sm" options={WORK_CENTRES[op.stage] || []} value={op.workCentre} onChange={(e) => setOp(i, { workCentre: e.target.value })} />
                      </Field>
                    )}
                    <Field label="Output per hour">
                      <Input size="sm" type="number" min="0" value={op.outputPerHour} disabled={op.mode === 'Job Work'} onChange={(e) => setOp(i, { outputPerHour: e.target.value === '' ? '' : Number(e.target.value) })} />
                    </Field>
                    <Field label={op.mode === 'Job Work' ? 'Job charge per piece' : 'Labour rate per piece'}>
                      <Input size="sm" type="number" min="0" step="any" prefix="₹" value={op.ratePerPc} onChange={(e) => setOp(i, { ratePerPc: e.target.value === '' ? '' : Number(e.target.value) })} />
                    </Field>
                  </div>
                </div>
              ))}
              <Button size="sm" variant="soft" icon={Plus} onClick={() => setForm((f) => ({ ...f, operations: [...f.operations, newOp()] }))} style={{ alignSelf: 'flex-start' }}>
                Add stage
              </Button>
            </div>
            <Field label="Remarks" span="full" className="mt-16">
              <Textarea rows={2} value={form.remarks || ''} onChange={(e) => setField('remarks', e.target.value)} />
            </Field>
          </form>
        )}
      </Drawer>
    </>
  )
}
