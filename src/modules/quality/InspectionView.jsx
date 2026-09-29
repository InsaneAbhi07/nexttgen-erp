/** QC inspection report. Frontend-only demo. */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronDown, ClipboardCheck, FileQuestion, Printer, RotateCcw, ShieldCheck, Trash2, XCircle } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { QC_PLANS } from '../../store/mfg.js'
import { fmtDate, num, pct } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, Callout, Card, DocNo, Dropdown, EmptyState, KeyValue, PageHeader, StatCard, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import { MiniTable } from '../production/shared.jsx'
import { QC_CRUMB, sourceDoc } from './QualityDashboard.jsx'
import './quality.css'

const RESULT_TONE = { Accepted: 'green', 'Accepted with Deviation': 'amber', Rework: 'amber', Rejected: 'red' }

export default function InspectionView() {
  const { id } = useParams()
  const { state, get, remove } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [printing, setPrinting] = useState(false)
  const qc = get('qcInspections', id)
  usePageTitle(qc ? qc.number : 'Inspection')

  if (!qc) {
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <EmptyState icon={FileQuestion} title="Inspection not found" description="It may have been deleted, or the demo data was reset." action={<Button variant="primary" to="/quality/inspections">Back to inspections</Button>} />
      </div>
    )
  }

  const item = get('items', qc.itemId)
  const supplier = get('suppliers', qc.supplierId)
  const order = get('productionOrders', qc.productionOrderId)
  const src = sourceDoc(state, qc)
  const fails = qc.checks.filter((c) => c.result === 'Fail')
  const tone = RESULT_TONE[qc.result] || 'blue'

  const handleDelete = async () => {
    const ok = await confirm({ title: 'Delete inspection?', message: `${qc.number} will be removed. The lot will show as pending inspection again.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('qcInspections', qc.id)
      toast.success('Inspection deleted', qc.number)
      navigate('/quality/inspections')
    }
  }

  const moreItems = [
    { label: 'Print report', icon: Printer, onClick: () => setPrinting(true) },
    src && { label: 'Open source document', icon: ClipboardCheck, to: src.link },
    can('Quality', 'delete') && { divider: true },
    can('Quality', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: handleDelete },
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        title={qc.number}
        badge={<StatusBadge status={qc.result} />}
        subtitle={`${qc.type} inspection of ${item?.name}, ${fmtDate(qc.date)} by ${qc.inspector}`}
        breadcrumbs={[QC_CRUMB, { label: 'Inspections', to: '/quality/inspections' }, { label: qc.number }]}
        actions={
          <>
            <Dropdown width={210} items={moreItems} trigger={({ toggle }) => <Button iconRight={ChevronDown} onClick={toggle}>More</Button>} />
            <Button variant="primary" icon={Printer} onClick={() => setPrinting(true)}>Print report</Button>
          </>
        }
      />

      <Callout tone={tone === 'blue' ? 'blue' : tone} icon={qc.result === 'Accepted' ? CheckCircle2 : qc.result === 'Rejected' ? XCircle : RotateCcw} style={{ marginBottom: 16 }}>
        {qc.result === 'Accepted' && `Lot accepted. All ${qc.checks.length} checks passed on a sample of ${num(qc.sampleQty)}.`}
        {qc.result === 'Accepted with Deviation' && `Lot accepted after segregating ${num(qc.rejectedQty)} defective pieces. ${fails.length} check(s) failed.`}
        {qc.result === 'Rework' && `${num(qc.reworkQty)} pieces sent back for rework. ${fails.map((f) => f.parameter).join(', ') || 'See remarks'}.`}
        {qc.result === 'Rejected' && `Lot rejected: ${num(qc.rejectedQty)} of ${num(qc.lotQty)} pieces defective. ${qc.refCollection === 'productionOrders' ? 'Hold the batch.' : 'Return to the supplier with a debit note.'}`}
      </Callout>

      <div className="grid-5 mb-16">
        <StatCard label="Lot" value={`${num(qc.lotQty)} ${item?.unit || ''}`} icon={ShieldCheck} tone="blue" foot={QC_PLANS[qc.planKey]?.name} />
        <StatCard label="Sample" value={num(qc.sampleQty)} icon={ClipboardCheck} tone="violet" foot={qc.lotQty ? `${pct((qc.sampleQty / qc.lotQty) * 100)} of the lot` : ''} />
        <StatCard label="Accepted" value={num(qc.acceptedQty)} icon={CheckCircle2} tone="green" foot={qc.lotQty ? `${pct((qc.acceptedQty / qc.lotQty) * 100)} of the lot` : ''} />
        <StatCard label="Rejected" value={num(qc.rejectedQty)} icon={XCircle} tone="red" foot={`${fails.length} failed check(s)`} />
        <StatCard label="Rework" value={num(qc.reworkQty)} icon={RotateCcw} tone="amber" foot="Back to the line" />
      </div>

      <div className="qc-split">
        <Card title="Checklist" subtitle={`${qc.checks.length - fails.length} passed, ${fails.length} failed`} flush>
          <MiniTable
            columns={[
              { key: 'parameter', header: 'Parameter', render: (c) => <span className="cell-primary">{c.parameter}</span> },
              { key: 'spec', header: 'Specification', render: (c) => <span className="ink-2">{c.spec}</span> },
              { key: 'observed', header: 'Observed', render: (c) => c.observed || '—' },
              { key: 'result', header: 'Result', render: (c) => <StatusBadge status={c.result} /> },
            ]}
            rows={qc.checks}
          />
        </Card>
        <Card title="Details">
          <KeyValue
            cols={2}
            items={[
              { label: 'Type', value: <StatusBadge status={qc.type} /> },
              { label: 'Date', value: fmtDate(qc.date) },
              { label: 'Item', value: item?.name, span: 2 },
              { label: 'Source', value: src ? <DocNo to={src.link}>{src.number}</DocNo> : '—' },
              { label: 'Production order', value: order ? <DocNo to={`/production/orders/${order.id}`}>{order.number}</DocNo> : '—' },
              { label: qc.type === 'Job Work' ? 'Job worker' : 'Supplier', value: supplier?.name || 'In-house', span: 2 },
              qc.stage && { label: 'Stage', value: qc.stage },
              { label: 'Inspector', value: qc.inspector },
              { label: 'Remarks', value: qc.remarks, span: 2 },
            ].filter(Boolean)}
          />
        </Card>
      </div>

      <DocumentPreview
        open={printing}
        onClose={() => setPrinting(false)}
        onSend={false}
        title="Inspection Report"
        subtitle={`${qc.type} inspection`}
        numberLabel="QC No."
        number={qc.number}
        date={qc.date}
        party={{ heading: supplier ? (qc.type === 'Job Work' ? 'Job worker' : 'Supplier') : 'Product', name: supplier?.name || item?.name, address: supplier ? `${supplier.city}, ${supplier.state}` : `${item?.code}, ${order?.number || ''}` }}
        meta={[
          { label: 'Item', value: item?.name },
          { label: 'Source', value: src?.number },
          { label: 'Lot / sample', value: `${num(qc.lotQty)} / ${num(qc.sampleQty)}` },
          { label: 'Accepted / rejected / rework', value: `${num(qc.acceptedQty)} / ${num(qc.rejectedQty)} / ${num(qc.reworkQty)}` },
          { label: 'Result', value: qc.result },
        ]}
        lines={qc.checks}
        descriptionHeader="Parameter"
        describe={(c) => <div style={{ fontWeight: 600 }}>{c.parameter}</div>}
        columns={[
          { header: 'Specification', render: (c) => c.spec },
          { header: 'Observed', render: (c) => c.observed || '—' },
          { header: 'Result', render: (c) => c.result },
        ]}
        terms={`${QC_PLANS[qc.planKey]?.name || 'Inspection'} as per the approved QC plan. Sample size per IS 2500 (AQL 2.5, general inspection level II).${qc.remarks ? `\nRemarks: ${qc.remarks}` : ''}`}
        signLabel="QC inspector"
      />
    </>
  )
}
