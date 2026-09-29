/** Job work challan — balance, receipts back from the job worker, QC and print. Frontend-only demo. */
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlarmClock, Ban, CheckCircle2, ChevronDown, ClipboardList, IndianRupee, PackageCheck, Printer, Send, Undo2, XCircle } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { jobWorkBalance } from '../../store/mfg.js'
import { fmtDate, inr, inr2, num, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Button, Callout, Card, DatePicker, DocNo, Drawer, Dropdown, Field, Input, KeyValue, PageHeader, Select, StatCard, StatusBadge, Textarea, useConfirm, useToast } from '../../components/ui/index.js'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import { CRUMB, MiniTable, MissingRecord } from './shared.jsx'

const OPEN = ['Sent', 'Partially Received']

export default function JobWorkView() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { state, get, save, patch, previewNumber } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [printing, setPrinting] = useState(false)
  const [receive, setReceive] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const jwo = get('jobWorkOrders', id)
  usePageTitle(jwo ? jwo.number : 'Job work')

  const bal = jwo ? jobWorkBalance(state, jwo) : null
  const canReceive = jwo && OPEN.includes(jwo.status) && bal.pending > 0 && can('Production', 'add')

  const openReceive = () => {
    setErrors({})
    setReceive({
      date: today(),
      challanNo: '',
      returnWarehouseId: jwo.returnWarehouseId || 'wh-rms',
      remarks: '',
      lines: bal.lines.filter((l) => l.pending > 0).map((l) => ({ id: l.id, itemId: l.itemId, pending: l.pending, rate: l.rate, receivedQty: l.pending, rejectedQty: 0 })),
    })
  }

  useEffect(() => {
    if (params.get('receive') === '1' && canReceive) openReceive()
    if (params.get('receive')) {
      const next = new URLSearchParams(params)
      next.delete('receive')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  if (!jwo) return <MissingRecord label="Job work challan" backTo="/production/job-work" />

  const items = byId(state.items)
  const warehouses = byId(state.warehouses)
  const worker = get('suppliers', jwo.supplierId)
  const order = get('productionOrders', jwo.productionOrderId)
  const overdue = OPEN.includes(jwo.status) && jwo.expectedDate < today()
  const qcFor = (receiptId, itemId) => (state.qcInspections || []).find((q) => q.refCollection === 'jobWorkReceipts' && q.refId === receiptId && q.itemId === itemId)
  const receiptRows = bal.receipts.flatMap((r) => r.lines.map((l) => ({ ...l, key: `${r.id}-${l.id}`, receipt: r, qc: qcFor(r.id, l.itemId) })))

  const closeShort = async () => {
    const ok = await confirm({
      title: 'Close this challan short?',
      message: `${num(bal.pending)} pending pieces will no longer be expected back from ${worker?.name}. Material stays at the job worker location until adjusted.`,
      confirmLabel: 'Close challan',
      tone: 'danger',
    })
    if (ok) {
      patch('jobWorkOrders', jwo.id, { status: 'Closed' }, { action: 'closed' })
      toast.success('Challan closed', jwo.number)
    }
  }

  const setRLine = (idx, patchValues) => {
    setReceive((r) => ({ ...r, lines: r.lines.map((l, i) => (i === idx ? { ...l, ...patchValues } : l)) }))
    setErrors((e) => ({ ...e, [`line${idx}`]: undefined, lines: undefined }))
  }

  const submitReceive = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!receive.date) errs.date = 'Select the date'
    else if (receive.date < jwo.date) errs.date = 'Can’t be before the challan date'
    receive.lines.forEach((l, idx) => {
      const back = (Number(l.receivedQty) || 0) + (Number(l.rejectedQty) || 0)
      if (Number(l.receivedQty) < 0 || Number(l.rejectedQty) < 0) errs[`line${idx}`] = 'Can’t be negative'
      else if (back > l.pending) errs[`line${idx}`] = `Only ${num(l.pending)} pending`
    })
    if (!receive.lines.some((l) => (Number(l.receivedQty) || 0) + (Number(l.rejectedQty) || 0) > 0)) errs.lines = 'Enter the quantity received back'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    await fakeDelay(400)
    const saved = save('jobWorkReceipts', {
      date: receive.date,
      jobWorkOrderId: jwo.id,
      supplierId: jwo.supplierId,
      returnWarehouseId: receive.returnWarehouseId,
      challanNo: receive.challanNo.trim(),
      remarks: receive.remarks.trim(),
      lines: receive.lines
        .filter((l) => (Number(l.receivedQty) || 0) + (Number(l.rejectedQty) || 0) > 0)
        .map((l) => ({ id: l.id, itemId: l.itemId, receivedQty: Number(l.receivedQty) || 0, rejectedQty: Number(l.rejectedQty) || 0, rate: l.rate })),
    })
    setSaving(false)
    setReceive(null)
    const ok = saved.lines.reduce((a, l) => a + l.receivedQty, 0)
    const rej = saved.lines.reduce((a, l) => a + l.rejectedQty, 0)
    toast.success('Material received back', `${saved.number}: ${num(ok)} OK${rej ? `, ${num(rej)} rejected to scrap yard` : ''}. Inspect the lot in Quality.`)
  }

  const moreItems = [
    { label: 'Print challan', icon: Printer, onClick: () => setPrinting(true) },
    order && { label: 'Open production order', icon: ClipboardList, to: `/production/orders/${order.id}` },
    can('Production', 'edit') && OPEN.includes(jwo.status) && { divider: true },
    can('Production', 'edit') && OPEN.includes(jwo.status) && { label: 'Close short', icon: Ban, danger: true, onClick: closeShort },
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        title={jwo.number}
        badge={<StatusBadge status={jwo.status} />}
        subtitle={`${jwo.process} by ${worker?.name}, sent ${fmtDate(jwo.date)}`}
        breadcrumbs={[CRUMB, { label: 'Job work', to: '/production/job-work' }, { label: jwo.number }]}
        actions={
          <>
            <Dropdown width={210} items={moreItems} trigger={({ toggle }) => <Button iconRight={ChevronDown} onClick={toggle}>More</Button>} />
            {canReceive && <Button variant="primary" icon={PackageCheck} onClick={openReceive}>Receive material</Button>}
          </>
        }
      />

      {overdue && <Callout tone="red" icon={AlarmClock} style={{ marginBottom: 16 }}>Due back on {fmtDate(jwo.expectedDate)}. {num(bal.pending)} pieces are still with {worker?.name} ({worker?.mobile}).</Callout>}
      {jwo.status === 'Received' && <Callout tone="green" icon={CheckCircle2} style={{ marginBottom: 16 }}>All material is back. Job charges payable {inr(bal.charges)}.</Callout>}
      {jwo.status === 'Closed' && <Callout icon={Ban} style={{ marginBottom: 16 }}>This challan was closed short. No more material is expected back.</Callout>}

      <div className="grid-5 mb-16">
        <StatCard label="Sent" value={num(bal.sent)} icon={Send} tone="violet" foot={`${jwo.lines.length} item(s)`} />
        <StatCard label="Received OK" value={num(bal.received)} icon={PackageCheck} tone="green" foot={`To ${warehouses.get(jwo.returnWarehouseId)?.name}`} />
        <StatCard label="Rejected" value={num(bal.rejected)} icon={XCircle} tone="red" foot="Moved to the scrap yard" />
        <StatCard label="Pending" value={num(bal.pending)} icon={Undo2} tone={bal.pending ? 'amber' : 'green'} foot={`Expected ${fmtDate(jwo.expectedDate)}`} />
        <StatCard label="Job charges" value={inr(bal.charges)} icon={IndianRupee} tone="blue" foot="On OK pieces received" />
      </div>

      <div className="prd-split mb-16">
        <Card title="Material" flush>
          <MiniTable
            columns={[
              { key: 'item', header: 'Item', render: (l) => (<div><div className="cell-primary">{items.get(l.itemId)?.name}</div><div className="cell-secondary">{items.get(l.itemId)?.code}</div></div>) },
              { key: 'qty', header: 'Sent', align: 'right', render: (l) => `${num(l.qty)} ${items.get(l.itemId)?.unit || ''}` },
              { key: 'received', header: 'OK back', align: 'right', render: (l) => <span className="strong">{num(l.received)}</span> },
              { key: 'rejected', header: 'Rejected', align: 'right', render: (l) => <span className={l.rejected ? 'text-red' : 'muted'}>{num(l.rejected)}</span> },
              { key: 'pending', header: 'Pending', align: 'right', render: (l) => (l.pending ? num(l.pending) : <span className="text-green">Done</span>) },
              { key: 'rate', header: 'Rate / pc', align: 'right', render: (l) => inr2(l.rate) },
              { key: 'charge', header: 'Charge', align: 'right', render: (l) => inr(l.charge) },
            ]}
            rows={bal.lines}
          />
        </Card>
        <Card title="Details">
          <KeyValue
            cols={2}
            items={[
              { label: 'Job worker', value: <a href={`/masters/suppliers?view=${worker?.id}`} onClick={(e) => { e.preventDefault(); navigate(`/masters/suppliers?view=${worker?.id}`) }}>{worker?.name}</a>, span: 2 },
              { label: 'Process', value: jwo.process },
              { label: 'GSTIN', value: worker?.gstin && <span className="mono">{worker.gstin}</span> },
              { label: 'Sent from', value: warehouses.get(jwo.fromWarehouseId)?.name },
              { label: 'Return to', value: warehouses.get(jwo.returnWarehouseId)?.name },
              { label: 'Production order', value: order ? <DocNo to={`/production/orders/${order.id}`}>{order.number}</DocNo> : 'Not linked' },
              { label: 'Vehicle', value: jwo.vehicleNo },
              { label: 'Remarks', value: jwo.remarks, span: 2 },
            ]}
          />
        </Card>
      </div>

      <Card
        title="Received back"
        subtitle={`${bal.receipts.length} receipt(s)`}
        flush
        actions={canReceive && <Button size="sm" variant="soft" icon={PackageCheck} onClick={openReceive}>Receive material</Button>}
      >
        <MiniTable
          rowKey="key"
          empty="Nothing received back yet"
          emptyDescription={canReceive ? 'Record OK and rejected pieces when the job worker returns them.' : undefined}
          columns={[
            { key: 'number', header: 'Receipt', render: (r) => <DocNo>{r.receipt.number}</DocNo> },
            { key: 'date', header: 'Date', render: (r) => fmtDate(r.receipt.date) },
            { key: 'challanNo', header: 'Their challan', render: (r) => r.receipt.challanNo || '—' },
            { key: 'item', header: 'Item', render: (r) => items.get(r.itemId)?.name },
            { key: 'receivedQty', header: 'OK', align: 'right', render: (r) => <span className="strong">{num(r.receivedQty)}</span> },
            { key: 'rejectedQty', header: 'Rejected', align: 'right', render: (r) => <span className={r.rejectedQty ? 'text-red' : 'muted'}>{num(r.rejectedQty)}</span> },
            {
              key: 'qc',
              header: 'QC',
              render: (r) =>
                r.qc ? (
                  <a href={`/quality/inspections/${r.qc.id}`} onClick={(e) => { e.preventDefault(); navigate(`/quality/inspections/${r.qc.id}`) }}><StatusBadge status={r.qc.result} /></a>
                ) : can('Quality', 'add') ? (
                  <Button size="sm" variant="soft" to={`/quality/inspections/new?type=Job%20Work&ref=jobWorkReceipts&refId=${r.receipt.id}&item=${r.itemId}`}>Inspect</Button>
                ) : (
                  <StatusBadge status="Pending QC" />
                ),
            },
          ]}
          rows={receiptRows}
        />
      </Card>

      <Drawer
        open={Boolean(receive)}
        onClose={() => !saving && setReceive(null)}
        title="Receive material back"
        subtitle={`${jwo.number}, ${worker?.name}`}
        footer={
          <>
            <Button onClick={() => setReceive(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" form="jw-receive-form" loading={saving}>Receive</Button>
          </>
        }
      >
        {receive && (
          <form id="jw-receive-form" onSubmit={submitReceive} noValidate>
            <div className="form-grid cols-2">
              <Field label="Receipt no.">
                <Input className="mono" readOnly value={previewNumber('jobWorkReceipts', receive.date)} />
              </Field>
              <Field label="Date" required error={errors.date}>
                <DatePicker value={receive.date} onChange={(v) => setReceive((r) => ({ ...r, date: v }))} />
              </Field>
              <Field label="Job worker’s challan no.">
                <Input value={receive.challanNo} placeholder="AE/JW/412" onChange={(e) => setReceive((r) => ({ ...r, challanNo: e.target.value }))} />
              </Field>
              <Field label="Receive into">
                <Select
                  options={state.warehouses.filter((w) => w.status === 'Active' && !['wh-jbw', 'wh-scr'].includes(w.id)).map((w) => ({ value: w.id, label: w.name }))}
                  value={receive.returnWarehouseId}
                  onChange={(e) => setReceive((r) => ({ ...r, returnWarehouseId: e.target.value }))}
                />
              </Field>
            </div>
            <div className="form-section-title" style={{ margin: '18px 0 4px' }}>Quantities</div>
            {receive.lines.map((l, idx) => (
              <div key={l.id} className="jw-receive-row">
                <div>
                  <div className="cell-primary">{items.get(l.itemId)?.name}</div>
                  <div className="cell-secondary">{num(l.pending)} pending</div>
                </div>
                <Field label="OK">
                  <Input size="sm" type="number" min="0" value={l.receivedQty} error={errors[`line${idx}`]} onChange={(e) => setRLine(idx, { receivedQty: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
                <Field label="Rejected">
                  <Input size="sm" type="number" min="0" value={l.rejectedQty} onChange={(e) => setRLine(idx, { rejectedQty: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
                <Field label="Charge">
                  <Input size="sm" readOnly value={inr((Number(l.receivedQty) || 0) * (Number(l.rate) || 0))} />
                </Field>
                {errors[`line${idx}`] && <div className="field-error" style={{ gridColumn: '1 / -1' }}>{errors[`line${idx}`]}</div>}
              </div>
            ))}
            {errors.lines && <div className="field-error">{errors.lines}</div>}
            <Field label="Remarks" className="mt-16">
              <Textarea rows={2} value={receive.remarks} placeholder="Shade OK, few burn marks…" onChange={(e) => setReceive((r) => ({ ...r, remarks: e.target.value }))} />
            </Field>
            <Callout style={{ marginTop: 14 }}>OK pieces go back into store. Rejected pieces go to the rejection and scrap yard. Inspect the lot in Quality afterwards.</Callout>
          </form>
        )}
      </Drawer>

      <DocumentPreview
        open={printing}
        onClose={() => setPrinting(false)}
        onSend={false}
        title="Job Work Challan"
        subtitle="Goods sent for job work – not for sale"
        numberLabel="Challan No."
        number={jwo.number}
        date={jwo.date}
        party={{ heading: 'Job worker', name: worker?.companyName || worker?.name, address: `${worker?.address}, ${worker?.city}, ${worker?.state} ${worker?.pincode}`, gstin: worker?.gstin, state: worker?.state, phone: worker?.mobile }}
        meta={[
          { label: 'Process', value: jwo.process },
          { label: 'Expected back', value: fmtDate(jwo.expectedDate) },
          { label: 'Vehicle no.', value: jwo.vehicleNo },
          order && { label: 'Production order', value: order.number },
        ].filter(Boolean)}
        lines={jwo.lines}
        columns={[
          { header: 'Qty', align: 'right', render: (l) => num(l.qty) },
          { header: 'Unit', render: (l, it) => it?.unit },
          { header: 'Value (₹)', align: 'right', render: (l, it) => inr((Number(l.qty) || 0) * (Number(it?.purchaseRate) || 0)) },
          { header: 'Job charge / pc', align: 'right', render: (l) => inr2(l.rate) },
        ]}
        terms={'Goods are sent for job work under Section 143 of the CGST Act, 2017 read with Rule 45 of the CGST Rules. Not for sale.\nProcessed goods, rejects and scrap must be returned within one year of this challan.\nFinish and shade must match the approved master sample.'}
        signLabel="Stores in-charge"
      />
    </>
  )
}
