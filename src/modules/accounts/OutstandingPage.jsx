/**
 * Outstanding — receivables and payables with ageing, invoice-wise or party-wise.
 * Frontend-only demo: reminders are simulated.
 */
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BellRing, BookOpen, Eye, HandCoins, Wallet } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { outstandingRows } from '../../store/selectors.js'
import { Button, DataTable, DocNo, FilterPanel, PageHeader, Segmented, StatCard, StatusBadge, Tabs, useToast } from '../../components/ui/index.js'
import { fmtDate, inr, num } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'

const BUCKETS = [
  { key: 'notdue', label: 'Not due', test: (d) => d === 0, tone: 'green' },
  { key: '1-30', label: '1–30 days overdue', test: (d) => d >= 1 && d <= 30, tone: 'amber' },
  { key: '31-60', label: '31–60 days overdue', test: (d) => d >= 31 && d <= 60, tone: 'amber' },
  { key: '61-90', label: '61–90 days overdue', test: (d) => d >= 61 && d <= 90, tone: 'red' },
  { key: '90+', label: 'Over 90 days', test: (d) => d > 90, tone: 'red' },
]

export default function OutstandingPage() {
  usePageTitle('Outstanding')
  const { state, logActivity } = useErp()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'payable' ? 'payable' : 'receivable'
  const isRec = tab === 'receivable'
  const [filters, setFilters] = useState({ party: '', status: '', bucket: '' })
  const [grouping, setGrouping] = useState('invoice')

  const receivable = useMemo(() => outstandingRows(state, 'receivable'), [state])
  const payable = useMemo(() => outstandingRows(state, 'payable'), [state])
  const all = isRec ? receivable : payable

  const rows = useMemo(
    () =>
      all.filter(
        (r) =>
          (!filters.party || r.partyId === filters.party) &&
          (!filters.status || r.status === filters.status) &&
          (!filters.bucket || BUCKETS.find((b) => b.key === filters.bucket).test(r.daysOverdue)),
      ),
    [all, filters],
  )

  const buckets = BUCKETS.map((b) => {
    const list = all.filter((r) => b.test(r.daysOverdue))
    return { ...b, amount: list.reduce((a, r) => a + r.balance, 0), count: list.length }
  })
  const total = all.reduce((a, r) => a + r.balance, 0)

  const switchTab = (t) => {
    setFilters({ party: '', status: '', bucket: '' })
    setParams({ tab: t }, { replace: true })
  }

  const payLink = (r) => (isRec ? `/accounts/receipts/new?invoice=${r.invoice.id}` : `/accounts/payments/new?invoice=${r.invoice.id}`)
  const invoiceLink = (r) => (isRec ? `/sales/invoices/${r.invoice.id}` : `/purchase/invoices/${r.invoice.id}`)
  const ledgerLink = (partyId) => (isRec ? `/accounts/customer-ledger?customer=${partyId}` : `/accounts/supplier-ledger?supplier=${partyId}`)

  const remind = (partyName, amount, ref) => {
    logActivity('sent a payment reminder for', 'invoice', ref, 'Accounts', '/accounts/outstanding')
    toast.success('Reminder sent (demo)', `${partyName} would get an email and WhatsApp reminder for ${inr(amount)}.`)
  }

  const invoiceColumns = [
    {
      key: 'party', header: isRec ? 'Customer' : 'Supplier', accessor: (r) => r.party?.name,
      render: (r) => (
        <div>
          <Link to={ledgerLink(r.partyId)} className="cell-primary" style={{ color: 'var(--ink)' }} onClick={(e) => e.stopPropagation()}>{r.party?.name}</Link>
          <div className="cell-secondary">{r.party?.city}</div>
        </div>
      ),
    },
    { key: 'invoice', header: 'Invoice', accessor: (r) => r.invoice.number, render: (r) => <DocNo to={invoiceLink(r)}>{r.invoice.number}</DocNo> },
    { key: 'date', header: 'Invoice date', accessor: (r) => r.invoice.date, render: (r) => <span className="nowrap">{fmtDate(r.invoice.date)}</span> },
    { key: 'due', header: 'Due date', accessor: (r) => r.invoice.dueDate, render: (r) => <span className="nowrap">{fmtDate(r.invoice.dueDate)}</span> },
    { key: 'amount', header: 'Amount', align: 'right', accessor: (r) => r.amount, render: (r) => <span className="num nowrap">{inr(r.amount)}</span> },
    { key: 'paid', header: 'Paid', align: 'right', accessor: (r) => r.paid, render: (r) => <span className="num nowrap">{inr(r.paid)}</span> },
    { key: 'balance', header: 'Outstanding', align: 'right', accessor: (r) => r.balance, render: (r) => <span className="strong num nowrap">{inr(r.balance)}</span> },
    { key: 'days', header: 'Days overdue', align: 'right', accessor: (r) => r.daysOverdue, render: (r) => <span className={`num ${r.daysOverdue > 0 ? 'text-red strong' : 'muted'}`}>{r.daysOverdue > 0 ? r.daysOverdue : '—'}</span> },
    { key: 'status', header: 'Status', accessor: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ]

  const partyRows = useMemo(() => {
    const map = {}
    rows.forEach((r) => {
      if (!map[r.partyId]) map[r.partyId] = { id: r.partyId, party: r.party, count: 0, amount: 0, balance: 0, overdue: 0, oldest: 0 }
      const p = map[r.partyId]
      p.count += 1
      p.amount += r.amount
      p.balance += r.balance
      if (r.status === 'Overdue') p.overdue += r.balance
      p.oldest = Math.max(p.oldest, r.daysOverdue)
    })
    return Object.values(map).sort((a, b) => b.balance - a.balance)
  }, [rows])

  const partyColumns = [
    { key: 'party', header: isRec ? 'Customer' : 'Supplier', accessor: (r) => r.party?.name, render: (r) => <div><div className="cell-primary">{r.party?.name}</div><div className="cell-secondary">{r.party?.city}, {r.party?.paymentTerms}</div></div> },
    { key: 'count', header: 'Open invoices', align: 'right', accessor: (r) => r.count },
    { key: 'amount', header: 'Invoiced', align: 'right', accessor: (r) => r.amount, render: (r) => <span className="num nowrap">{inr(r.amount)}</span> },
    { key: 'balance', header: 'Outstanding', align: 'right', accessor: (r) => r.balance, render: (r) => <span className="strong num nowrap">{inr(r.balance)}</span> },
    { key: 'overdue', header: 'Overdue', align: 'right', accessor: (r) => r.overdue, render: (r) => <span className={`num nowrap ${r.overdue > 0 ? 'text-red' : 'muted'}`}>{inr(r.overdue)}</span> },
    { key: 'oldest', header: 'Oldest overdue', align: 'right', accessor: (r) => r.oldest, render: (r) => (r.oldest > 0 ? `${r.oldest} days` : '—') },
  ]

  const partyOptions = [...new Map(all.map((r) => [r.partyId, r.party?.name])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]))).map(([value, label]) => ({ value, label }))
  const overdueCount = all.filter((r) => r.status === 'Overdue')

  return (
    <>
      <PageHeader
        title="Outstanding"
        subtitle="What customers owe you and what you owe suppliers, with ageing"
        breadcrumbs={[{ label: 'Accounts', to: '/accounts/receipts' }, { label: 'Outstanding' }]}
        actions={
          isRec && overdueCount.length > 0 && (
            <Button
              icon={BellRing}
              onClick={() => {
                logActivity('sent payment reminders for', 'overdue invoices', `${overdueCount.length} invoices`, 'Accounts', '/accounts/outstanding')
                toast.success('Reminders sent (demo)', `${overdueCount.length} overdue invoices would be reminded by email and WhatsApp.`)
              }}
            >
              Remind all overdue
            </Button>
          )
        }
      />

      <Tabs
        tabs={[
          { key: 'receivable', label: 'Receivable', count: receivable.length, icon: HandCoins },
          { key: 'payable', label: 'Payable', count: payable.length, icon: Wallet },
        ]}
        value={tab}
        onChange={switchTab}
        style={{ marginBottom: 16 }}
      />

      <div className="grid-3 mb-16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <StatCard label={isRec ? 'Total receivable' : 'Total payable'} value={inr(total)} icon={isRec ? HandCoins : Wallet} tone="blue" foot={`${all.length} invoices`} onClick={() => setFilters((f) => ({ ...f, bucket: '' }))} className={!filters.bucket ? 'bucket-active' : ''} />
        {buckets.map((b) => (
          <StatCard
            key={b.key}
            label={b.label}
            value={inr(b.amount)}
            tone={b.tone}
            foot={`${num(b.count)} invoices`}
            className={filters.bucket === b.key ? 'bucket-active' : ''}
            onClick={() => setFilters((f) => ({ ...f, bucket: f.bucket === b.key ? '' : b.key }))}
          />
        ))}
      </div>

      {grouping === 'invoice' ? (
        <DataTable
          key={`inv-${tab}`}
          columns={invoiceColumns}
          data={rows}
          exportName={`outstanding-${tab}`}
          initialSort={{ key: 'days', dir: 'desc' }}
          searchPlaceholder="Search party or invoice…"
          filters={
            <FilterPanel
              filters={[
                { key: 'party', label: isRec ? 'Customers' : 'Suppliers', options: partyOptions, width: 190 },
                { key: 'status', label: 'Statuses', options: ['Overdue', 'Unpaid', 'Partially Paid'], width: 150 },
                { key: 'bucket', label: 'Ageing', options: BUCKETS.map((b) => ({ value: b.key, label: b.label })), placeholder: 'Any ageing', width: 170 },
              ]}
              values={filters}
              onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
              onReset={() => setFilters({ party: '', status: '', bucket: '' })}
            />
          }
          toolbar={<Segmented options={[{ value: 'invoice', label: 'Invoice-wise' }, { value: 'party', label: 'Party-wise' }]} value={grouping} onChange={setGrouping} />}
          rowActions={(r) => [
            { label: isRec ? 'Receive payment' : 'Make payment', icon: isRec ? HandCoins : Wallet, to: payLink(r) },
            isRec && { label: 'Send reminder', icon: BellRing, onClick: () => remind(r.party?.name, r.balance, r.invoice.number) },
            { label: 'View invoice', icon: Eye, to: invoiceLink(r) },
            { label: 'Open ledger', icon: BookOpen, to: ledgerLink(r.partyId) },
          ].filter(Boolean)}
          footer={
            <tr>
              <td colSpan={4}>Total ({rows.length} invoices)</td>
              <td className="align-right num nowrap">{inr(rows.reduce((a, r) => a + r.amount, 0))}</td>
              <td className="align-right num nowrap">{inr(rows.reduce((a, r) => a + r.paid, 0))}</td>
              <td className="align-right num nowrap">{inr(rows.reduce((a, r) => a + r.balance, 0))}</td>
              <td colSpan={3} />
            </tr>
          }
          emptyTitle="Nothing outstanding"
          emptyDescription={isRec ? 'Every customer invoice matching these filters is fully paid.' : 'Every supplier bill matching these filters is fully paid.'}
        />
      ) : (
        <DataTable
          key={`party-${tab}`}
          columns={partyColumns}
          data={partyRows}
          exportName={`outstanding-${tab}-partywise`}
          initialSort={{ key: 'balance', dir: 'desc' }}
          searchPlaceholder="Search party…"
          toolbar={<Segmented options={[{ value: 'invoice', label: 'Invoice-wise' }, { value: 'party', label: 'Party-wise' }]} value={grouping} onChange={setGrouping} />}
          rowActions={(r) => [
            { label: 'Open ledger', icon: BookOpen, to: ledgerLink(r.id) },
            { label: isRec ? 'Receive payment' : 'Make payment', icon: isRec ? HandCoins : Wallet, to: isRec ? `/accounts/receipts/new?customer=${r.id}` : `/accounts/payments/new?supplier=${r.id}` },
            isRec && { label: 'Send reminder', icon: BellRing, onClick: () => remind(r.party?.name, r.balance, `${r.count} invoices`) },
          ].filter(Boolean)}
          footer={
            <tr>
              <td>Total ({partyRows.length} parties)</td>
              <td className="align-right num">{partyRows.reduce((a, r) => a + r.count, 0)}</td>
              <td className="align-right num nowrap">{inr(partyRows.reduce((a, r) => a + r.amount, 0))}</td>
              <td className="align-right num nowrap">{inr(partyRows.reduce((a, r) => a + r.balance, 0))}</td>
              <td className="align-right num nowrap">{inr(partyRows.reduce((a, r) => a + r.overdue, 0))}</td>
              <td colSpan={2} />
            </tr>
          }
          emptyTitle="Nothing outstanding"
        />
      )}
    </>
  )
}
