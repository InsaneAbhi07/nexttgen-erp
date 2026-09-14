/**
 * Reports Center — browse every report by group. Frontend-only demo.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Boxes, ChevronRight, FileSearch, IndianRupee, Receipt, ShoppingCart } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { stockValue, totalReceivables } from '../../store/selectors.js'
import { inr } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { EmptyState, PageHeader, SearchBar, Segmented, StatCard, presetRange } from '../../components/ui/index.js'
import { REPORT_GROUPS, REPORTS } from './reportDefs.jsx'
import './reports.css'

export default function ReportsCenter() {
  usePageTitle('Reports Center')
  const { state } = useErp()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const group = params.get('group') || 'all'

  const month = presetRange('month')
  const inMonth = (d) => d.date >= month.from && d.date <= month.to
  const monthSales = state.salesInvoices.filter(inMonth).reduce((a, d) => a + d.totals.grandTotal, 0)
  const monthPurchase = state.purchaseInvoices.filter(inMonth).reduce((a, d) => a + d.totals.grandTotal, 0)

  useEffect(() => {
    if (group !== 'all') document.getElementById(`group-${group}`)?.scrollIntoView({ block: 'nearest' })
  }, [group])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return REPORT_GROUPS.filter((g) => group === 'all' || g.key === group)
      .map((g) => ({
        ...g,
        reports: REPORTS.filter((r) => r.group === g.key && (!q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))),
      }))
      .filter((g) => g.reports.length)
  }, [query, group])

  const setGroup = (g) => {
    const next = new URLSearchParams(params)
    if (g === 'all') next.delete('group')
    else next.set('group', g)
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Reports Center"
        subtitle={`${REPORTS.length} reports across sales, purchase, stock, production, accounts and GST. Every report can be filtered, printed and exported.`}
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Reports' }]}
      />

      <div className="grid-4 mb-16">
        <StatCard label="Sales this month" value={inr(monthSales)} icon={Receipt} tone="blue" to="/reports/sales-summary" foot="Open sales summary" />
        <StatCard label="Purchases this month" value={inr(monthPurchase)} icon={ShoppingCart} tone="violet" to="/reports/purchase-summary" foot="Open purchase summary" />
        <StatCard label="Stock value" value={inr(stockValue(state))} icon={Boxes} tone="teal" to="/reports/stock-valuation" foot="At purchase rate" />
        <StatCard label="Receivables" value={inr(totalReceivables(state))} icon={IndianRupee} tone="amber" to="/reports/receivable-report" foot="Open ageing report" />
      </div>

      <div className="reports-toolbar">
        <SearchBar value={query} onChange={setQuery} placeholder="Find a report, e.g. ledger, GST, wastage" />
        <div className="reports-groups-scroll">
          <Segmented
            options={[{ value: 'all', label: 'All' }, ...REPORT_GROUPS.map((g) => ({ value: g.key, label: g.label.replace(' reports', '') }))]}
            value={group}
            onChange={setGroup}
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card">
          <EmptyState icon={FileSearch} title={`No reports match “${query}”`} description="Try a broader word such as sales, stock or ledger." />
        </div>
      ) : (
        <div className="reports-groups">
          {groups.map((g) => {
            const Icon = g.icon
            return (
              <section key={g.key} id={`group-${g.key}`} className="card report-group">
                <header className="report-group-head">
                  <span className={`stat-icon ${g.tone}`}>
                    <Icon size={16} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h2 className="card-title">{g.label}</h2>
                    <p className="card-subtitle">{g.description}</p>
                  </div>
                  <span className="report-count">{g.reports.length}</span>
                </header>
                <ul className="report-list">
                  {g.reports.map((r) => (
                    <li key={r.id}>
                      <Link to={`/reports/${r.id}`} className="report-link">
                        <span style={{ minWidth: 0 }}>
                          <span className="report-link-title">{r.title}</span>
                          <span className="report-link-desc">{r.description}</span>
                        </span>
                        <ChevronRight size={16} className="report-link-chev" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
