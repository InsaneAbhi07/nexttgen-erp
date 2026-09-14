/**
 * Customer / Supplier ledger — running balance built in the browser from invoices,
 * vouchers and returns in the mock store.
 */
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, CreditCard, HandCoins, Printer, Scale, Wallet } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { customerLedger, outstandingRows, supplierLedger } from '../../store/selectors.js'
import { Button, Card, DataTable, DateRange, DocNo, Field, KeyValue, PageHeader, Select, StatCard, presetRange } from '../../components/ui/index.js'
import { fmtDate, inr, inr2 } from '../../utils/format.js'
import { printPage } from '../../utils/export.js'
import { usePageTitle } from '../../utils/hooks.js'
import { ledgerVoucherLink } from './config.js'

const LEDGERS = {
  customer: {
    partyColl: 'customers', param: 'customer', fn: customerLedger, title: 'Customer ledger', partyLabel: 'Customer', positive: 'Dr', negative: 'Cr',
    subtitle: 'Invoices, receipts and returns with running balance', payLabel: 'Receive payment', payLink: (id) => `/accounts/receipts/new?customer=${id}`, outType: 'receivable',
  },
  supplier: {
    partyColl: 'suppliers', param: 'supplier', fn: supplierLedger, title: 'Supplier ledger', partyLabel: 'Supplier', positive: 'Cr', negative: 'Dr',
    subtitle: 'Purchase bills, payments and returns with running balance', payLabel: 'Make payment', payLink: (id) => `/accounts/payments/new?supplier=${id}`, outType: 'payable',
  },
}

export default function LedgerPage({ kind }) {
  const L = LEDGERS[kind]
  usePageTitle(L.title)
  const { state, get } = useErp()
  const [params, setParams] = useSearchParams()
  const [range, setRange] = useState({ ...presetRange('fy'), preset: 'fy' })

  const parties = useMemo(() => state[L.partyColl].slice().sort((a, b) => a.name.localeCompare(b.name)), [state, L.partyColl])
  const partyId = params.get(L.param) || parties.find((p) => p.status === 'Active')?.id
  const party = get(L.partyColl, partyId)

  const ledger = useMemo(() => (party ? L.fn(state, party.id, range) : null), [state, party, range, L])
  const outstanding = useMemo(() => (party ? outstandingRows(state, L.outType).filter((r) => r.partyId === party.id) : []), [state, party, L.outType])

  const fmtBal = (b) => (Math.abs(b) < 0.5 ? inr2(0) : `${inr2(Math.abs(b))} ${b >= 0 ? L.positive : L.negative}`)

  const rows = useMemo(() => {
    if (!ledger) return []
    return [
      { id: 'opening', date: range.from || '', kind: 'Opening balance', ref: '', debit: 0, credit: 0, balance: ledger.opening, opening: true },
      ...ledger.rows.map((r, i) => ({ ...r, id: `${r.refId}-${i}` })),
    ]
  }, [ledger, range.from])

  const columns = [
    { key: 'date', header: 'Date', sortable: false, render: (r) => <span className="nowrap">{r.date ? fmtDate(r.date) : '—'}</span> },
    { key: 'kind', header: 'Particulars', sortable: false, render: (r) => <span className={r.opening ? 'strong' : ''}>{r.kind}</span> },
    { key: 'ref', header: 'Voucher', sortable: false, render: (r) => (r.ref ? <DocNo to={ledgerVoucherLink(r)}>{r.ref}</DocNo> : '') },
    { key: 'debit', header: 'Debit', align: 'right', sortable: false, render: (r) => <span className="num nowrap">{r.debit ? inr2(r.debit) : ''}</span> },
    { key: 'credit', header: 'Credit', align: 'right', sortable: false, render: (r) => <span className="num nowrap">{r.credit ? inr2(r.credit) : ''}</span> },
    { key: 'balance', header: 'Balance', align: 'right', sortable: false, accessor: (r) => r.balance, render: (r) => <span className="strong num nowrap">{fmtBal(r.balance)}</span> },
  ]

  const creditUse = kind === 'customer' && party?.creditLimit ? (Math.max(0, ledger?.closing || 0) / party.creditLimit) * 100 : null

  return (
    <>
      <PageHeader
        title={L.title}
        subtitle={L.subtitle}
        breadcrumbs={[{ label: 'Accounts', to: '/accounts/receipts' }, { label: L.title }]}
        actions={
          party && (
            <>
              <Button icon={Printer} onClick={printPage}>Print</Button>
              <Button variant="primary" icon={kind === 'customer' ? HandCoins : Wallet} to={L.payLink(party.id)}>{L.payLabel}</Button>
            </>
          )
        }
      />

      <Card className="mb-16">
        <div className="row row-wrap" style={{ gap: 16, alignItems: 'flex-end' }}>
          <Field label={L.partyLabel} className="grow ledger-party">
            <Select
              options={parties.map((p) => ({ value: p.id, label: `${p.name}, ${p.city}${p.status !== 'Active' ? ' (inactive)' : ''}` }))}
              value={partyId || ''}
              onChange={(e) => {
                const next = new URLSearchParams(params)
                next.set(L.param, e.target.value)
                setParams(next, { replace: true })
              }}
            />
          </Field>
          <Field label="Period">
            <DateRange value={range} onChange={setRange} />
          </Field>
        </div>
        {party && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <KeyValue
              cols={4}
              items={[
                { label: 'Code', value: <Link to={`/masters/${L.partyColl}?view=${party.id}`} className="doc-no">{party.code}</Link> },
                { label: 'GSTIN', value: party.gstin },
                { label: 'Location', value: `${party.city}, ${party.state}` },
                { label: 'Payment terms', value: party.paymentTerms },
              ]}
            />
          </div>
        )}
      </Card>

      {ledger && (
        <>
          <div className={`grid-${creditUse !== null ? 5 : 4} mb-16`}>
            <StatCard label="Opening balance" value={fmtBal(ledger.opening)} icon={Scale} tone="gray" foot={range.from ? `As on ${fmtDate(range.from)}` : 'Start of records'} />
            <StatCard label="Total debit" value={inr(ledger.totalDebit)} icon={ArrowUpRight} tone="blue" foot={kind === 'customer' ? 'Invoices raised' : 'Payments and returns'} />
            <StatCard label="Total credit" value={inr(ledger.totalCredit)} icon={ArrowDownLeft} tone="green" foot={kind === 'customer' ? 'Receipts and returns' : 'Bills received'} />
            <StatCard label="Closing balance" value={fmtBal(ledger.closing)} icon={Wallet} tone="teal" foot={`${outstanding.length} open invoices`} to={`/accounts/outstanding?tab=${L.outType}`} />
            {creditUse !== null && (
              <StatCard label="Credit limit used" value={`${Math.round(creditUse)}%`} icon={CreditCard} tone={creditUse > 100 ? 'red' : creditUse > 75 ? 'amber' : 'blue'} foot={`Limit ${inr(party.creditLimit)}`} />
            )}
          </div>

          <DataTable
            key={`${party.id}-${range.from}-${range.to}`}
            columns={columns}
            data={rows}
            searchable={false}
            pageSize={25}
            exportName={`${L.param}-ledger-${party.code}`}
            footer={
              <tr>
                <td colSpan={3}>Total for the period</td>
                <td className="align-right num nowrap">{inr2(ledger.totalDebit)}</td>
                <td className="align-right num nowrap">{inr2(ledger.totalCredit)}</td>
                <td className="align-right num nowrap">{fmtBal(ledger.closing)}</td>
              </tr>
            }
            emptyTitle="No entries in this period"
          />
        </>
      )}
    </>
  )
}
