/** QC inspections register. Frontend-only demo. */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Plus } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { QC_INSPECTORS, QC_RESULTS, QC_TYPES } from '../../data/constants.js'
import { fmtDate, num } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, DataTable, DocNo, FilterPanel, PageHeader, StatusBadge, Tabs, inDateRange } from '../../components/ui/index.js'
import { QC_CRUMB, sourceDoc } from './QualityDashboard.jsx'
import './quality.css'

export default function InspectionList() {
  usePageTitle('QC inspections')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState({})
  const items = byId(state.items)
  const suppliers = byId(state.suppliers)

  const allRows = useMemo(
    () =>
      (state.qcInspections || []).map((q) => ({
        ...q,
        item: items.get(q.itemId),
        supplier: suppliers.get(q.supplierId),
        src: sourceDoc(state, q),
      })),
    [state, items, suppliers],
  )
  const filtered = allRows.filter(
    (r) => (!filters.result || r.result === filters.result) && (!filters.inspector || r.inspector === filters.inspector) && inDateRange(r.date, filters.period),
  )
  const rows = tab === 'All' ? filtered : filtered.filter((r) => r.type === tab)

  const columns = [
    { key: 'number', header: 'QC no.', render: (r) => <DocNo to={`/quality/inspections/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'type', header: 'Type', render: (r) => (<div><StatusBadge status={r.type} />{r.type === 'In-process' && r.stage && <div className="cell-secondary">{r.stage}</div>}</div>) },
    { key: 'src', header: 'Source', accessor: (r) => r.src?.number, render: (r) => (r.src ? <DocNo to={r.src.link}>{r.src.number}</DocNo> : '—') },
    { key: 'item', header: 'Item', accessor: (r) => `${r.item?.name} ${r.supplier?.name || ''}`, render: (r) => (<div><div className="cell-primary">{r.item?.name}</div><div className="cell-secondary">{r.supplier?.name || 'In-house'}</div></div>) },
    { key: 'lotQty', header: 'Lot', align: 'right', render: (r) => num(r.lotQty) },
    { key: 'sampleQty', header: 'Sample', align: 'right', render: (r) => num(r.sampleQty) },
    { key: 'acceptedQty', header: 'Accepted', align: 'right', render: (r) => <span className="strong">{num(r.acceptedQty)}</span> },
    { key: 'rejectedQty', header: 'Rejected', align: 'right', render: (r) => <span className={r.rejectedQty ? 'text-red' : 'muted'}>{num(r.rejectedQty)}</span> },
    { key: 'reworkQty', header: 'Rework', align: 'right', render: (r) => <span className={r.reworkQty ? 'text-amber' : 'muted'}>{num(r.reworkQty)}</span> },
    { key: 'result', header: 'Result', render: (r) => <StatusBadge status={r.result} /> },
    { key: 'inspector', header: 'Inspector' },
  ]

  return (
    <>
      <PageHeader
        title="QC inspections"
        subtitle="Every inspection with its checklist, sample size and accept / reject decision."
        breadcrumbs={[QC_CRUMB, { label: 'Inspections' }]}
        actions={can('Quality', 'add') && <Button variant="primary" icon={Plus} to="/quality/inspections/new">New inspection</Button>}
      />

      <Tabs
        style={{ marginBottom: 12 }}
        value={tab}
        onChange={setTab}
        tabs={['All', ...QC_TYPES].map((s) => ({ key: s, label: s === 'All' ? 'All inspections' : s, count: s === 'All' ? filtered.length : filtered.filter((r) => r.type === s).length }))}
      />

      <DataTable
        columns={columns}
        data={rows}
        exportName="qc-inspections"
        initialSort={{ key: 'date', dir: 'desc' }}
        searchPlaceholder="Search QC no., source, item or supplier…"
        onRowClick={(r) => navigate(`/quality/inspections/${r.id}`)}
        filters={
          <FilterPanel
            filters={[
              { key: 'result', label: 'Result', options: QC_RESULTS, placeholder: 'All results' },
              { key: 'inspector', label: 'Inspector', options: QC_INSPECTORS, placeholder: 'All inspectors' },
              { key: 'period', type: 'daterange' },
            ]}
            values={filters}
            onChange={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
            onReset={() => setFilters({})}
          />
        }
        rowActions={(r) => [{ label: 'Open report', icon: Eye, to: `/quality/inspections/${r.id}` }]}
        emptyTitle={tab === 'All' ? 'No inspections yet' : `No ${tab.toLowerCase()} inspections`}
        emptyDescription="Inspect GRNs, job work returns and finished batches from the Quality dashboard."
        emptyAction={can('Quality', 'add') && <Button size="sm" variant="primary" icon={Plus} to="/quality">Open pending list</Button>}
      />
    </>
  )
}
