/**
 * Customer receipts / Supplier payments — list with filters, view drawer and voucher print.
 * Frontend-only demo: vouchers live in the mock store.
 */
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, CalendarDays, Eye, Landmark, Plus, Printer, Trash2, Wallet } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { PAYMENT_MODES } from '../../data/constants.js'
import {
  Badge, Button, Callout, DataTable, DocNo, Drawer, FilterPanel, KeyValue, PageHeader, StatCard, StatusBadge, inDateRange, presetRange, useConfirm, useToast,
} from '../../components/ui/index.js'
import { fmtDate, fmtDateTime, inr, today } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { MODE_TONE, VOUCHER_KINDS } from './config.js'
import VoucherPreview from './VoucherPaper.jsx'

export default function VoucherList({ kind }) {
  const K = VOUCHER_KINDS[kind]
  usePageTitle(K.title)
  const { state, remove, get } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState({ range: { ...presetRange('fy'), preset: 'fy' }, party: '', mode: '' })
  const [printing, setPrinting] = useState(null)

  const list = state[K.collection]
  const parties = byId(state[K.partyColl])
  const invoices = byId(state[K.invoiceColl])
  const accounts = byId(state.settings.accounts || [])

  const rows = useMemo(
    () =>
      list
        .filter((v) => inDateRange(v.date, filters.range) && (!filters.party || v[K.partyKey] === filters.party) && (!filters.mode || v.mode === filters.mode))
        .sort((a, b) => (a.date === b.date ? ((a.createdAt || '') < (b.createdAt || '') ? 1 : -1) : a.date < b.date ? 1 : -1)),
    [list, filters, K.partyKey],
  )

  const stats = useMemo(() => {
    const t = today()
    const month = presetRange('month')
    const monthList = list.filter((v) => inDateRange(v.date, month))
    const sum = (l) => l.reduce((a, v) => a + (Number(v.amount) || 0), 0)
    return {
      today: sum(list.filter((v) => v.date === t)),
      todayCount: list.filter((v) => v.date === t).length,
      month: sum(monthList),
      monthCount: monthList.length,
      bank: sum(monthList.filter((v) => v.mode !== 'Cash')),
      cash: sum(monthList.filter((v) => v.mode === 'Cash')),
    }
  }, [list])

  const viewing = get(K.collection, params.get('view'))
  const closeView = () => {
    const next = new URLSearchParams(params)
    next.delete('view')
    setParams(next, { replace: true })
  }
  const openView = (row) => {
    const next = new URLSearchParams(params)
    next.set('view', row.id)
    setParams(next)
  }

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: `Delete ${K.singular.toLowerCase()} ${row.number}?`,
      message: `${inr(row.amount)} will be removed and the invoice balance restored. This can’t be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    closeView()
    remove(K.collection, row.id)
    toast.success(`${K.singular} deleted`, `${row.number} was removed from the demo data.`)
  }

  const partyOptions = state[K.partyColl]
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ value: p.id, label: p.name }))

  const columns = [
    { key: 'number', header: 'Voucher', render: (r) => <DocNo>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => <span className="nowrap">{fmtDate(r.date)}</span> },
    {
      key: 'party', header: K.partyLabel, accessor: (r) => parties.get(r[K.partyKey])?.name,
      render: (r) => (
        <Link to={K.ledger(r[K.partyKey])} onClick={(e) => e.stopPropagation()} className="cell-primary" style={{ color: 'var(--ink)' }}>
          {parties.get(r[K.partyKey])?.name}
        </Link>
      ),
    },
    {
      key: 'invoice', header: 'Against invoice', accessor: (r) => invoices.get(r.invoiceId)?.number || 'On account',
      render: (r) => (r.invoiceId && invoices.get(r.invoiceId) ? <DocNo to={`${K.invoiceBase}/${r.invoiceId}`}>{invoices.get(r.invoiceId).number}</DocNo> : <span className="muted">On account</span>),
    },
    { key: 'mode', header: 'Mode', render: (r) => <Badge tone={MODE_TONE[r.mode]}>{r.mode}</Badge> },
    { key: 'reference', header: 'Reference', render: (r) => <span className="small ink-2 truncate" style={{ maxWidth: 200, display: 'inline-block' }}>{r.reference || '—'}</span> },
    { key: 'account', header: 'Account', accessor: (r) => accounts.get(r.accountId)?.name, render: (r) => <span className="small">{accounts.get(r.accountId)?.name || '—'}</span> },
    { key: 'amount', header: 'Amount', align: 'right', accessor: (r) => Number(r.amount), render: (r) => <span className="strong num nowrap">{inr(r.amount)}</span> },
  ]

  const rowActions = (r) => [
    { label: 'View details', icon: Eye, onClick: () => openView(r) },
    { label: 'Print voucher', icon: Printer, onClick: () => setPrinting(r) },
    { label: `Open ${K.partyLabel.toLowerCase()} ledger`, icon: BookOpen, to: K.ledger(r[K.partyKey]) },
    can('Accounts', 'delete') && { divider: true },
    can('Accounts', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(r) },
  ].filter(Boolean)

  const invoice = viewing?.invoiceId ? invoices.get(viewing.invoiceId) : null
  const invoiceStatus = invoice ? K.statusFn(state, invoice) : null
  const totalShown = rows.reduce((a, r) => a + Number(r.amount), 0)

  return (
    <>
      <PageHeader
        title={K.title}
        subtitle={K.subtitle}
        breadcrumbs={[{ label: 'Accounts', to: '/accounts/receipts' }, { label: K.title }]}
        actions={can('Accounts', 'add') && <Button variant="primary" icon={Plus} to={`${K.base}/new`}>{K.addLabel}</Button>}
      />

      <div className="grid-4 mb-16">
        <StatCard label={`${K.flowWord} today`} value={inr(stats.today)} icon={CalendarDays} tone="blue" foot={`${stats.todayCount} vouchers`} />
        <StatCard label={`${K.flowWord} this month`} value={inr(stats.month)} icon={Wallet} tone="green" foot={`${stats.monthCount} vouchers`} />
        <StatCard label="Bank, UPI and cheque" value={inr(stats.bank)} icon={Landmark} tone="teal" foot="This month" />
        <StatCard label="Cash" value={inr(stats.cash)} icon={Wallet} tone="amber" foot="This month" />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        onRowClick={openView}
        rowActions={rowActions}
        exportName={K.collection}
        searchPlaceholder={`Search voucher, ${K.partyLabel.toLowerCase()}, reference…`}
        filters={
          <FilterPanel
            filters={[
              { key: 'range', type: 'daterange' },
              { key: 'party', label: `${K.partyLabel}s`, options: partyOptions, width: 190 },
              { key: 'mode', label: 'Modes', options: PAYMENT_MODES, width: 130 },
            ]}
            values={filters}
            onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
            onReset={() => setFilters({ range: {}, party: '', mode: '' })}
          />
        }
        footer={
          <tr>
            <td colSpan={7}>Total for filtered vouchers</td>
            <td className="align-right num nowrap">{inr(totalShown)}</td>
            <td />
          </tr>
        }
        emptyTitle={`No ${K.singular.toLowerCase()}s in this period`}
        emptyDescription="Change the date range or record a new voucher."
        emptyAction={can('Accounts', 'add') && <Button size="sm" variant="primary" icon={Plus} to={`${K.base}/new`}>{K.addLabel}</Button>}
      />

      <Drawer
        open={Boolean(viewing)}
        onClose={closeView}
        title={viewing ? `${K.singular} ${viewing.number}` : ''}
        subtitle={viewing ? `${inr(viewing.amount)} ${K.flowWord.toLowerCase()} on ${fmtDate(viewing.date)}` : ''}
        footer={
          viewing && (
            <>
              {can('Accounts', 'delete') && (
                <Button variant="ghost" icon={Trash2} style={{ marginRight: 'auto', color: 'var(--red)' }} onClick={() => handleDelete(viewing)}>
                  Delete
                </Button>
              )}
              <Button onClick={closeView}>Close</Button>
              <Button variant="primary" icon={Printer} onClick={() => setPrinting(viewing)}>
                Print voucher
              </Button>
            </>
          )
        }
      >
        {viewing && (
          <div className="stack">
            <KeyValue
              cols={2}
              items={[
                { label: 'Voucher no.', value: <span className="doc-no">{viewing.number}</span> },
                { label: 'Date', value: fmtDate(viewing.date) },
                { label: K.partyLabel, value: <Link to={K.ledger(viewing[K.partyKey])}>{parties.get(viewing[K.partyKey])?.name}</Link> },
                { label: 'Against invoice', value: invoice ? <DocNo to={`${K.invoiceBase}/${invoice.id}`}>{invoice.number}</DocNo> : 'On account' },
                { label: 'Payment mode', value: <Badge tone={MODE_TONE[viewing.mode]}>{viewing.mode}</Badge> },
                { label: 'Account', value: accounts.get(viewing.accountId)?.name },
                { label: 'Reference', value: viewing.reference, span: 2 },
                { label: 'Amount', value: <span className="strong">{inr(viewing.amount)}</span> },
                { label: 'Recorded', value: `${viewing.createdBy || 'Accounts team'}, ${fmtDateTime(viewing.createdAt)}` },
                { label: 'Remarks', value: viewing.remarks, span: 2 },
              ]}
            />
            {invoice && invoiceStatus && (
              <Callout tone={invoiceStatus.status === 'Paid' ? 'green' : invoiceStatus.status === 'Overdue' ? 'red' : 'amber'}>
                <div className="row row-wrap" style={{ gap: 8 }}>
                  <span>
                    Invoice {invoice.number}: {inr(invoiceStatus.amount)} billed, {inr(invoiceStatus.paid)} settled, <b>{inr(invoiceStatus.balance)}</b> outstanding.
                  </span>
                  <StatusBadge status={invoiceStatus.status} />
                </div>
              </Callout>
            )}
          </div>
        )}
      </Drawer>

      <VoucherPreview kind={kind} voucher={printing} onClose={() => setPrinting(null)} />
    </>
  )
}
