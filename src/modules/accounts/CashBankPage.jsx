/**
 * Cash & bank — opening, receipts, payments and closing per account for a period,
 * derived from receipts/payments in the mock store (frontend-only demo).
 */
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, Banknote, Landmark, Scale, Wallet } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId, cashBankSummary, salaryPayouts } from '../../store/selectors.js'
import { Badge, Button, Card, DataTable, DateRange, DocNo, PageHeader, Select, StatCard, presetRange, inDateRange } from '../../components/ui/index.js'
import ChartTooltip from '../../components/common/ChartTooltip.jsx'
import { CHART, axisProps } from '../../config/theme.js'
import { daysBetween, fmtDate, inr, inrCompact, monthLabel } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { MODE_TONE } from './config.js'
import './accounts.css'

export default function CashBankPage() {
  usePageTitle('Cash & bank')
  const { state } = useErp()
  const [range, setRange] = useState({ ...presetRange('month'), preset: 'month' })
  const [accountId, setAccountId] = useState('')

  const summary = useMemo(() => cashBankSummary(state, range), [state, range])
  const selected = accountId ? summary.filter((s) => s.account.id === accountId) : summary
  const totals = selected.reduce(
    (a, s) => ({ opening: a.opening + s.opening, receipts: a.receipts + s.receipts, payments: a.payments + s.payments, closing: a.closing + s.closing }),
    { opening: 0, receipts: 0, payments: 0, closing: 0 },
  )

  const txns = useMemo(() => {
    const customers = byId(state.customers)
    const suppliers = byId(state.suppliers)
    const accountById = byId(state.settings.accounts || [])
    const list = [
      ...state.receipts.map((r) => ({ ...r, kind: 'Receipt', inflow: Number(r.amount), outflow: 0, party: customers.get(r.customerId)?.name, link: `/accounts/receipts?view=${r.id}` })),
      ...state.payments.map((p) => ({ ...p, kind: 'Payment', inflow: 0, outflow: Number(p.amount), party: suppliers.get(p.supplierId)?.name, link: `/accounts/payments?view=${p.id}` })),
      ...salaryPayouts(state).map((p) => ({ ...p, kind: 'Salary', inflow: 0, outflow: Number(p.amount), party: 'Employees', mode: accountById.get(p.accountId)?.type === 'Cash' ? 'Cash' : 'Bank', link: `/hr/payroll/${p.runId}` })),
    ]
      .filter((t) => inDateRange(t.date, range) && (!accountId || t.accountId === accountId))
      .sort((a, b) => (a.date === b.date ? ((a.createdAt || '') < (b.createdAt || '') ? -1 : 1) : a.date < b.date ? -1 : 1))
    let bal = totals.opening
    return list.map((t) => {
      bal += t.inflow - t.outflow
      return { ...t, key: `${t.kind}-${t.id}`, balance: Math.round(bal) }
    }).reverse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, range, accountId, totals.opening])

  const chart = useMemo(() => {
    const daily = range.from && range.to && daysBetween(range.from, range.to) <= 62
    const map = new Map()
    ;[...txns].reverse().forEach((t) => {
      const key = daily ? t.date : t.date.slice(0, 7)
      if (!map.has(key)) map.set(key, { key, label: daily ? fmtDate(key).slice(0, 6) : monthLabel(`${key}-01`), receipts: 0, payments: 0 })
      const row = map.get(key)
      row.receipts += t.inflow
      row.payments += t.outflow
    })
    return { daily, data: [...map.values()].sort((a, b) => (a.key < b.key ? -1 : 1)) }
  }, [txns, range])

  const accounts = byId(state.settings.accounts || [])
  const columns = [
    { key: 'date', header: 'Date', sortable: false, render: (r) => <span className="nowrap">{fmtDate(r.date)}</span> },
    { key: 'number', header: 'Voucher', sortable: false, render: (r) => <DocNo to={r.link}>{r.number}</DocNo> },
    { key: 'party', header: 'Party', sortable: false, render: (r) => <div><div className="cell-primary">{r.party}</div><div className="cell-secondary">{r.kind === 'Receipt' ? 'Customer receipt' : r.kind === 'Salary' ? 'Salary payout' : 'Supplier payment'}</div></div> },
    { key: 'mode', header: 'Mode', sortable: false, render: (r) => <Badge tone={MODE_TONE[r.mode]}>{r.mode}</Badge> },
    { key: 'account', header: 'Account', sortable: false, accessor: (r) => accounts.get(r.accountId)?.name, render: (r) => <span className="small">{accounts.get(r.accountId)?.name}</span> },
    { key: 'inflow', header: 'Receipt', align: 'right', sortable: false, accessor: (r) => r.inflow, render: (r) => <span className="num nowrap text-green">{r.inflow ? inr(r.inflow) : ''}</span> },
    { key: 'outflow', header: 'Payment', align: 'right', sortable: false, accessor: (r) => r.outflow, render: (r) => <span className="num nowrap">{r.outflow ? inr(r.outflow) : ''}</span> },
    { key: 'balance', header: 'Balance', align: 'right', sortable: false, accessor: (r) => r.balance, render: (r) => <span className="strong num nowrap">{inr(r.balance)}</span> },
  ]

  return (
    <>
      <PageHeader
        title="Cash & bank"
        subtitle="Balances and money movement across cash and bank accounts"
        breadcrumbs={[{ label: 'Accounts', to: '/accounts/receipts' }, { label: 'Cash & bank' }]}
        actions={<DateRange value={range} onChange={setRange} />}
      />

      <div className="grid-4 mb-16">
        <StatCard label="Opening balance" value={inr(totals.opening)} icon={Scale} tone="gray" foot={range.from ? `As on ${fmtDate(range.from)}` : 'Start of records'} />
        <StatCard label="Receipts" value={inr(totals.receipts)} icon={ArrowDownLeft} tone="green" foot={`${txns.filter((t) => t.inflow).length} vouchers`} to="/accounts/receipts" />
        <StatCard label="Payments" value={inr(totals.payments)} icon={ArrowUpRight} tone="amber" foot={`${txns.filter((t) => t.outflow).length} vouchers`} to="/accounts/payments" />
        <StatCard label="Closing balance" value={inr(totals.closing)} icon={Wallet} tone="blue" foot={accountId ? accounts.get(accountId)?.name : 'All accounts'} />
      </div>

      <div className="grid-3 mb-16">
        {summary.map((s) => {
          const Icon = s.account.type === 'Cash' ? Banknote : Landmark
          const active = accountId === s.account.id
          return (
            <Card
              key={s.account.id}
              className={`cash-account ${active ? 'bucket-active' : ''}`}
              title={<span className="row" style={{ gap: 8 }}><Icon size={16} /> {s.account.name}</span>}
              subtitle={s.account.number ? `${s.account.type} account ${s.account.number}` : `${s.account.type} account`}
              actions={
                <Button size="sm" variant={active ? 'soft' : 'ghost'} onClick={() => setAccountId(active ? '' : s.account.id)}>
                  {active ? 'Show all' : 'Transactions'}
                </Button>
              }
            >
              <div className="totals" style={{ maxWidth: 'none' }}>
                <div className="totals-row"><span>Opening balance</span><span>{inr(s.opening)}</span></div>
                <div className="totals-row"><span>Receipts</span><span className="text-green">+ {inr(s.receipts)}</span></div>
                <div className="totals-row"><span>Payments</span><span>− {inr(s.payments)}</span></div>
                <div className="totals-row grand"><span>Closing balance</span><span>{inr(s.closing)}</span></div>
              </div>
            </Card>
          )
        })}
      </div>

      <Card
        className="mb-16"
        title="Money in and out"
        subtitle={chart.daily ? 'Daily receipts and payments in the selected period' : 'Monthly receipts and payments in the selected period'}
        actions={
          <div className="chart-legend">
            <span><span className="sw" style={{ background: CHART.blue }} />Receipts</span>
            <span><span className="sw" style={{ background: CHART.brass }} />Payments</span>
          </div>
        }
      >
        {chart.data.length === 0 ? (
          <p className="muted small">No receipts or payments in this period.</p>
        ) : (
          <div className="chart-box sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
                <YAxis {...axisProps} width={64} tickFormatter={inrCompact} />
                <Tooltip cursor={{ fill: 'rgba(31, 95, 214, 0.06)' }} content={<ChartTooltip formatter={(v) => inr(v)} />} />
                <Bar dataKey="receipts" name="Receipts" fill={CHART.blue} radius={[4, 4, 0, 0]} maxBarSize={16} />
                <Bar dataKey="payments" name="Payments" fill={CHART.brass} radius={[4, 4, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <DataTable
        key={`${accountId}-${range.from}-${range.to}`}
        title="Transactions"
        subtitle="Newest first, balance runs from the opening balance"
        columns={columns}
        data={txns}
        rowKey="key"
        exportName="cash-bank-transactions"
        searchPlaceholder="Search voucher or party…"
        toolbar={
          <Select
            size="sm"
            style={{ width: 230 }}
            options={(state.settings.accounts || []).map((a) => ({ value: a.id, label: a.name }))}
            placeholder="All accounts"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            aria-label="Account"
          />
        }
        emptyTitle="No transactions in this period"
        emptyDescription="Change the date range or account."
      />
    </>
  )
}
