/**
 * ReportViewer — renders any report from reportDefs.jsx with filters, KPIs, chart,
 * table, totals and print/export. Frontend-only demo: all figures come from the mock store.
 */
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { FileSearch, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { usePageTitle } from '../../utils/hooks.js'
import { exportCsv, printPage } from '../../utils/export.js'
import { fmtDate, fmtDateTime, inr, inr2, num } from '../../utils/format.js'
import { SALES_PERSONS } from '../../data/constants.js'
import { Button, Callout, Card, DataTable, EmptyState, FilterPanel, PageHeader, StatCard, presetRange, useToast } from '../../components/ui/index.js'
import { REPORT_GROUPS, REPORT_MAP } from './reportDefs.jsx'
import ReportChart from './ReportChart.jsx'
import './reports.css'

const FORMAT = {
  date: (v) => fmtDate(v),
  inr: (v) => inr(v),
  inr2: (v) => inr2(v),
  num: (v) => num(v),
  pct: (v) => `${(Number(v) || 0).toFixed(1)}%`,
}

const RANGE_TEXT = {
  today: 'Today', yesterday: 'Yesterday', '7d': 'Last 7 days', '30d': 'Last 30 days', month: 'This month', lastMonth: 'Last month',
  quarter: 'This quarter', fy: 'This financial year', '12m': 'Last 12 months', all: 'All dates',
}

/** Normalise report columns: default accessor, render by format. */
const normalise = (columns = []) =>
  columns.map((c) => ({
    ...c,
    accessor: c.accessor || ((r) => r[c.key]),
    render: c.render || (c.format ? (r) => (r[c.key] === null || r[c.key] === undefined || r[c.key] === '' ? '—' : FORMAT[c.format](r[c.key])) : undefined),
  }))

function TotalsRow({ columns, totals }) {
  if (!totals) return null
  return (
    <tr>
      {columns.map((c, i) => (
        <td key={c.key} className={c.align ? `align-${c.align}` : ''}>
          {i === 0 ? 'Total' : totals[c.key] !== undefined ? (c.format ? FORMAT[c.format](totals[c.key]) : num(totals[c.key])) : ''}
        </td>
      ))}
    </tr>
  )
}

function initialValues(def, params) {
  const values = { ...(def.defaultFilters || {}) }
  if (def.filters.includes('range')) {
    const preset = def.defaultRange || 'fy'
    values.range = preset === 'all' ? { from: '', to: '', preset } : { ...presetRange(preset), preset }
  }
  def.filters.forEach((k) => {
    if (k !== 'range' && params.get(k)) values[k] = params.get(k)
  })
  return values
}

export default function ReportViewer() {
  const { reportId } = useParams()
  const def = REPORT_MAP[reportId]
  if (!def) return <UnknownReport id={reportId} />
  return <Report key={reportId} def={def} />
}

function UnknownReport({ id }) {
  usePageTitle('Report not found')
  return (
    <>
      <PageHeader title="Report not found" breadcrumbs={[{ label: 'Reports', to: '/reports' }, { label: id }]} />
      <div className="card">
        <EmptyState
          icon={FileSearch}
          title={`There is no report called “${id}”`}
          description="Open the Reports Center to browse all sales, purchase, inventory, production, accounts and GST reports."
          action={<Button variant="primary" to="/reports">Open Reports Center</Button>}
        />
      </div>
    </>
  )
}

function Report({ def }) {
  usePageTitle(def.title)
  const { state } = useErp()
  const toast = useToast()
  const [params] = useSearchParams()
  const [values, setValues] = useState(() => initialValues(def, params))
  const group = REPORT_GROUPS.find((g) => g.key === def.group)

  const result = useMemo(() => def.build(state, values), [def, state, values])
  const columns = useMemo(() => normalise(result.columns), [result.columns])
  const rows = useMemo(() => (result.rows || []).map((r, i) => ({ ...r, _k: `${r.id ?? 'row'}-${i}` })), [result.rows])

  const filterConfig = useMemo(() => {
    const itemPool = state.items.filter((i) => {
      if (def.itemFilter === 'product') return ['Finished Good', 'Semi Finished'].includes(i.type)
      if (def.itemFilter === 'material') return ['Raw Material', 'Consumable', 'Packaging Material'].includes(i.type)
      return true
    })
    const label = (k, fallback) => def.labels?.[k] || fallback
    const required = (k) => def.required?.includes(k)
    const make = {
      range: { key: 'range', type: 'daterange' },
      customer: { key: 'customer', label: label('customer', 'Customers'), placeholder: required('customer') ? 'Select customer' : 'All customers', options: state.customers.map((c) => ({ value: c.id, label: c.name })), width: 200 },
      supplier: { key: 'supplier', label: label('supplier', 'Suppliers'), placeholder: required('supplier') ? 'Select supplier' : 'All suppliers', options: state.suppliers.map((c) => ({ value: c.id, label: c.name })), width: 200 },
      item: { key: 'item', label: label('item', 'Items'), placeholder: required('item') ? `Select ${label('item', 'item').toLowerCase()}` : `All ${label('item', 'item').toLowerCase()}s`, options: itemPool.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` })), width: 230 },
      warehouse: { key: 'warehouse', label: 'Warehouses', placeholder: 'All warehouses', options: state.warehouses.map((w) => ({ value: w.id, label: w.name })), width: 190 },
      category: { key: 'category', label: 'Categories', placeholder: 'All categories', options: state.categories.map((c) => c.name), width: 170 },
      salesPerson: { key: 'salesPerson', label: 'Salespersons', placeholder: 'All salespersons', options: SALES_PERSONS, width: 170 },
    }
    return def.filters.map((k) => make[k] || { key: k, label: label(k, k), placeholder: `All ${label(k, k).toLowerCase()}s`, options: def.options?.[k] || [], width: 170 })
  }, [def, state])

  const period = values.range
    ? values.range.from || values.range.to
      ? `${fmtDate(values.range.from)} to ${fmtDate(values.range.to)}`
      : 'All dates'
    : 'As on today'

  const handleExcel = () => {
    exportCsv(
      def.id,
      columns.map((c) => ({ header: typeof c.header === 'string' ? c.header : c.key, value: (r) => c.accessor(r) })),
      rows,
    )
    toast.success('Excel file downloaded', `${rows.length} rows exported to ${def.id}.csv`)
  }
  const handlePdf = () => {
    toast.info('Preparing PDF', 'Choose “Save as PDF” in the print dialog.')
    printPage()
  }

  const resetFilters = () => setValues(initialValues(def, new URLSearchParams()))
  const tableKey = JSON.stringify(values)

  return (
    <>
      <PageHeader
        title={def.title}
        subtitle={def.description}
        breadcrumbs={[{ label: 'Reports', to: '/reports' }, { label: group?.label || 'Reports', to: `/reports?group=${def.group}` }, { label: def.title }]}
        actions={
          <>
            <Button icon={FileSpreadsheet} onClick={handleExcel} disabled={!rows.length}>Export Excel</Button>
            <Button icon={FileText} onClick={handlePdf}>Export PDF</Button>
            <Button variant="primary" icon={Printer} onClick={printPage}>Print</Button>
          </>
        }
      />

      <Card className="report-filters no-print mb-16" bodyClassName="report-filter-body">
        <FilterPanel filters={filterConfig} values={values} onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))} onReset={resetFilters} />
        <span className="small muted report-period">
          {values.range?.preset && RANGE_TEXT[values.range.preset] ? `${RANGE_TEXT[values.range.preset]}, ` : ''}
          {period}
        </span>
      </Card>

      {def.note && (
        <Callout tone="gray" style={{ marginBottom: 16 }}>
          {def.note}
        </Callout>
      )}

      <div className="report-sheet print-area">
        <div className="report-print-head">
          <div>
            <div className="report-print-company">{state.settings.company.name}</div>
            <div className="small muted">
              {state.settings.company.address}, {state.settings.company.city}. GSTIN {state.settings.company.gstin}
            </div>
          </div>
          <div className="report-print-title">
            <div className="strong">{def.title}</div>
            <div className="small muted">Period: {period}</div>
            <div className="tiny muted">Generated {fmtDateTime(new Date().toISOString())}</div>
          </div>
        </div>

        {result.emptyMessage ? (
          <div className="card">
            <EmptyState icon={FileSearch} title={result.emptyMessage} description="Use the filter above to choose one." />
          </div>
        ) : (
          <div className="stack">
            {result.summary?.length > 0 && (
              <div className={`grid-${Math.min(result.summary.length, 4)} report-kpis`}>
                {result.summary.map((k) => (
                  <StatCard key={k.label} label={k.label} value={k.value} foot={k.foot} />
                ))}
              </div>
            )}

            {result.chart && rows.length > 0 && <ReportChart chart={result.chart} />}

            <DataTable
              key={tableKey}
              title={result.tableTitle}
              subtitle={result.tableTitle ? `${rows.length} rows` : undefined}
              columns={columns}
              data={rows}
              rowKey="_k"
              pageSize={rows.length > 60 ? 25 : 15}
              exportName={def.id}
              searchPlaceholder={`Search ${def.title.toLowerCase()}…`}
              emptyTitle="No data for these filters"
              emptyDescription="Widen the date range or clear a filter to see results."
              footer={<TotalsRow columns={columns} totals={result.totals} />}
            />

            {(result.sections || []).map((sec) => {
              const secCols = normalise(sec.columns)
              return (
                <DataTable
                  key={`${sec.title}-${tableKey}`}
                  title={sec.title}
                  columns={secCols}
                  data={sec.rows.map((r, i) => ({ ...r, _k: `${r.id}-${i}` }))}
                  rowKey="_k"
                  searchable={false}
                  simulateLoading={false}
                  pageSize={25}
                  exportName={`${def.id}-${sec.title.toLowerCase().replace(/[^a-z]+/g, '-')}`}
                  emptyTitle="No data for these filters"
                  footer={<TotalsRow columns={secCols} totals={sec.totals} />}
                />
              )
            })}
          </div>
        )}
      </div>

      <p className="tiny muted no-print" style={{ marginTop: 16 }}>
        Figures are calculated from the sample data in this browser. <Link to="/reports">Back to all reports</Link>
      </p>
    </>
  )
}
