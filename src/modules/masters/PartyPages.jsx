/**
 * Customer & supplier masters — frontend-only demo.
 * Outstanding amounts are derived from mock invoices, receipts and payments.
 */
import { useMemo } from 'react'
import { BookOpen, IndianRupee, ShoppingCart, Receipt, Users, Truck, AlertCircle, Wallet } from 'lucide-react'
import CrudPage from '../../components/common/CrudPage.jsx'
import { Button, DocNo, KeyValue, Progress, StatusBadge } from '../../components/ui/index.js'
import { useErp } from '../../store/ErpStore.jsx'
import { outstandingRows, purchaseInvoiceStatus, salesInvoiceStatus } from '../../store/selectors.js'
import { nextCode } from '../../store/numbering.js'
import { STATE_NAMES } from '../../data/constants.js'
import { fmtDate, inr, inrCompact, num } from '../../utils/format.js'
import { customerUsage, formatMobile, mastersCrumbs, MiniTable, SectionTitle, supplierUsage, validateGstin, validEmail, validMobile } from './shared.jsx'

const partyFields = (isCustomer) => [
  { name: 'code', label: `${isCustomer ? 'Customer' : 'Supplier'} code`, placeholder: 'Auto-generated', hint: 'Leave blank to generate', uppercase: true, section: 'Contact details' },
  { name: 'name', label: `${isCustomer ? 'Customer' : 'Supplier'} name`, required: true, placeholder: isCustomer ? 'e.g. Sharma Hardware' : 'e.g. Singh Lock Industries' },
  { name: 'companyName', label: 'Company name', placeholder: 'Registered business name' },
  { name: 'contactPerson', label: 'Contact person', placeholder: 'e.g. Ramesh Sharma' },
  { name: 'mobile', label: 'Mobile', type: 'tel', required: true, placeholder: '+91 98110 23456' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'accounts@example.in' },
  { name: 'gstin', label: 'GSTIN', uppercase: true, maxLength: 15, placeholder: '07AABFS4521K1Z3', hint: 'Leave blank for unregistered parties', section: 'Address and GST' },
  { name: 'address', label: 'Address', type: 'textarea', required: true, span: 'full', rows: 2 },
  { name: 'city', label: 'City', required: true },
  { name: 'state', label: 'State', type: 'select', required: true, options: STATE_NAMES },
  { name: 'pincode', label: 'Pincode', maxLength: 6, placeholder: '202001' },
  ...(isCustomer ? [{ name: 'creditLimit', label: 'Credit limit', type: 'number', prefix: '₹', section: 'Credit and terms' }] : []),
  { name: 'paymentTerms', label: 'Payment terms', type: 'select', required: true, options: (s) => s.settings.paymentTerms.filter((t) => t.status === 'Active').map((t) => t.name), section: isCustomer ? undefined : 'Credit and terms' },
  { name: 'openingBalance', label: 'Opening balance', type: 'number', prefix: '₹', hint: isCustomer ? 'Amount receivable at the start' : 'Amount payable at the start' },
  { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], required: true },
]

const validateParty = (collection) => (v, s) => {
  const e = {}
  if (v.mobile && !validMobile(v.mobile)) e.mobile = 'Enter a 10-digit Indian mobile number'
  if (!validEmail(v.email)) e.email = 'Enter a valid email address'
  const g = validateGstin(v.gstin, v.state)
  if (g) e.gstin = g
  if (v.pincode && !/^\d{6}$/.test(v.pincode)) e.pincode = 'Pincode must be 6 digits'
  const code = (v.code || '').trim().toUpperCase()
  if (code && s[collection].some((r) => r.code.toUpperCase() === code && r.id !== v.id)) e.code = `Code ${code} is already in use`
  const gst = (v.gstin || '').trim().toUpperCase()
  if (gst && s[collection].some((r) => (r.gstin || '').toUpperCase() === gst && r.id !== v.id)) e.gstin = 'Another party already uses this GSTIN'
  return e
}

const normaliseParty = (collection, prefix) => (v, s) => ({
  ...v,
  code: (v.code || '').trim().toUpperCase() || nextCode(s[collection], prefix),
  name: v.name.trim(),
  companyName: (v.companyName || '').trim() || v.name.trim(),
  mobile: formatMobile(v.mobile),
  email: (v.email || '').trim().toLowerCase(),
  gstin: (v.gstin || '').trim().toUpperCase(),
  creditLimit: v.creditLimit === undefined ? undefined : Number(v.creditLimit) || 0,
  openingBalance: Number(v.openingBalance) || 0,
})

function useOutstanding(type) {
  const { state } = useErp()
  return useMemo(() => {
    const map = {}
    outstandingRows(state, type).forEach((r) => {
      if (!map[r.partyId]) map[r.partyId] = { balance: 0, overdue: 0, count: 0 }
      map[r.partyId].balance += r.balance
      map[r.partyId].count += 1
      if (r.status === 'Overdue') map[r.partyId].overdue += r.balance
    })
    return map
  }, [state, type])
}

const partyCols = (out, isCustomer) => [
  {
    key: 'name',
    header: isCustomer ? 'Customer' : 'Supplier',
    accessor: (r) => `${r.name} ${r.code} ${r.contactPerson || ''}`,
    sortValue: (r) => r.name,
    render: (r) => (
      <div>
        <div className="cell-primary">{r.name}</div>
        <div className="cell-secondary">
          <span className="mono">{r.code}</span>
          {r.contactPerson ? `, ${r.contactPerson}` : ''}
        </div>
      </div>
    ),
  },
  { key: 'mobile', header: 'Mobile', render: (r) => <span className="nowrap">{r.mobile}</span> },
  {
    key: 'city',
    header: 'Location',
    accessor: (r) => `${r.city} ${r.state}`,
    render: (r) => (
      <div>
        <div>{r.city}</div>
        <div className="cell-secondary">{r.state}</div>
      </div>
    ),
  },
  { key: 'gstin', header: 'GSTIN', render: (r) => (r.gstin ? <span className="mono small">{r.gstin}</span> : <span className="muted">Unregistered</span>) },
  { key: 'paymentTerms', header: 'Terms' },
  {
    key: 'outstanding',
    header: isCustomer ? 'Receivable' : 'Payable',
    align: 'right',
    accessor: (r) => Math.round(out[r.id]?.balance || 0),
    render: (r) => {
      const o = out[r.id]
      if (!o) return <span className="muted">Nil</span>
      return (
        <div>
          <div className="num strong">{inr(o.balance)}</div>
          {o.overdue > 0 && <div className="cell-secondary text-red">{inr(o.overdue)} overdue</div>}
        </div>
      )
    },
  },
  ...(isCustomer
    ? [
        {
          key: 'credit',
          header: 'Credit used',
          width: 130,
          accessor: (r) => (r.creditLimit ? Math.round(((out[r.id]?.balance || 0) / r.creditLimit) * 100) : 0),
          render: (r) => {
            if (!r.creditLimit) return <span className="muted">No limit</span>
            const pct = ((out[r.id]?.balance || 0) / r.creditLimit) * 100
            return (
              <div title={`${inr(out[r.id]?.balance || 0)} of ${inr(r.creditLimit)}`}>
                <Progress value={pct} tone={pct > 90 ? 'red' : pct > 60 ? 'amber' : 'green'} />
                <div className="cell-secondary">{Math.round(pct)}% of {inrCompact(r.creditLimit)}</div>
              </div>
            )
          },
        },
      ]
    : []),
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
]

const stateFilter = (collection) => ({ key: 'state', label: 'States', options: (s) => [...new Set(s[collection].map((r) => r.state))].sort() })
const termsFilter = { key: 'paymentTerms', label: 'Terms', placeholder: 'All terms', options: (s) => s.settings.paymentTerms.map((t) => t.name) }
const statusFilter = { key: 'status', label: 'Statuses', options: ['Active', 'Inactive'] }

const baseView = (r) => [
  { label: 'Company name', value: r.companyName },
  { label: 'Contact person', value: r.contactPerson },
  { label: 'Mobile', value: r.mobile },
  { label: 'Email', value: r.email },
  { label: 'GSTIN', value: r.gstin ? <span className="mono">{r.gstin}</span> : 'Unregistered' },
  { label: 'Payment terms', value: r.paymentTerms },
  { label: 'Address', value: `${r.address}, ${r.city}, ${r.state} ${r.pincode || ''}`, span: 2 },
]

export function CustomersPage() {
  const out = useOutstanding('receivable')
  return (
    <CrudPage
      collection="customers"
      singular="Customer"
      title="Customers"
      subtitle="Dealers, distributors and builders you sell to, with credit limits and outstanding."
      breadcrumbs={mastersCrumbs('Customers')}
      fields={partyFields(true)}
      columns={partyCols(out, true)}
      filters={[stateFilter('customers'), termsFilter, statusFilter]}
      defaults={{ paymentTerms: '30 Days', state: 'Uttar Pradesh', creditLimit: 300000, openingBalance: 0 }}
      validate={validateParty('customers')}
      beforeSave={normaliseParty('customers', 'CUS')}
      exportName="customers"
      searchPlaceholder="Search by name, code or contact person…"
      drawerSize="lg"
      initialSort={{ key: 'name', dir: 'asc' }}
      stats={(rows) => {
        const total = Object.values(out).reduce((a, o) => a + o.balance, 0)
        const overdue = Object.values(out).reduce((a, o) => a + o.overdue, 0)
        return [
          { label: 'Customers', value: num(rows.length), icon: Users, tone: 'blue', foot: `${rows.filter((r) => r.status === 'Active').length} active` },
          { label: 'Total receivable', value: inrCompact(total), icon: IndianRupee, tone: 'green', foot: `${Object.keys(out).length} customers with dues`, to: '/accounts/outstanding?tab=receivable' },
          { label: 'Overdue', value: inrCompact(overdue), icon: AlertCircle, tone: 'red', foot: 'Past due date' },
          { label: 'States served', value: num(new Set(rows.map((r) => r.state)).size), icon: Truck, tone: 'teal', foot: 'Across India' },
        ]
      }}
      viewFields={(r) => [...baseView(r), { label: 'Credit limit', value: r.creditLimit ? inr(r.creditLimit) : 'No limit' }, { label: 'Opening balance', value: inr(r.openingBalance) }]}
      viewExtra={(r, s) => <CustomerExtra customer={r} state={s} out={out[r.id]} />}
      deleteGuard={(r, s) => customerUsage(s, r.id)}
    />
  )
}

function CustomerExtra({ customer, state, out }) {
  const invoices = state.salesInvoices.filter((i) => i.customerId === customer.id)
  const received = state.receipts.filter((x) => x.customerId === customer.id).reduce((a, x) => a + Number(x.amount), 0)
  const recent = [...invoices].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)
  return (
    <>
      <div className="card card-body" style={{ background: 'var(--surface-2)' }}>
        <KeyValue
          cols={2}
          items={[
            { label: 'Total billed', value: inr(invoices.reduce((a, i) => a + i.totals.grandTotal, 0)) },
            { label: 'Total received', value: inr(received) },
            { label: 'Outstanding', value: <span className={out?.balance ? 'text-amber' : ''}>{inr(out?.balance || 0)}</span> },
            { label: 'Overdue', value: <span className={out?.overdue ? 'text-red' : ''}>{inr(out?.overdue || 0)}</span> },
          ]}
        />
      </div>
      <div className="row row-wrap">
        <Button size="sm" icon={BookOpen} to={`/accounts/customer-ledger?customer=${customer.id}`}>
          View ledger
        </Button>
        <Button size="sm" icon={Receipt} to={`/sales/orders/new?customer=${customer.id}`}>
          New sales order
        </Button>
        <Button size="sm" icon={Wallet} to={`/accounts/receipts/new?customer=${customer.id}`}>
          Receive payment
        </Button>
      </div>
      <div>
        <SectionTitle>Recent invoices</SectionTitle>
        <MiniTable
          empty="No invoices raised for this customer yet."
          rows={recent}
          columns={[
            { header: 'Invoice', render: (i) => <DocNo to={`/sales/invoices/${i.id}`}>{i.number}</DocNo> },
            { header: 'Date', render: (i) => fmtDate(i.date) },
            { header: 'Amount', align: 'right', render: (i) => inr(i.totals.grandTotal) },
            { header: 'Status', render: (i) => <StatusBadge status={salesInvoiceStatus(state, i).status} /> },
          ]}
        />
      </div>
    </>
  )
}

export function SuppliersPage() {
  const out = useOutstanding('payable')
  return (
    <CrudPage
      collection="suppliers"
      singular="Supplier"
      title="Suppliers"
      subtitle="Vendors for raw materials, components, packaging and traded goods."
      breadcrumbs={mastersCrumbs('Suppliers')}
      fields={partyFields(false)}
      columns={partyCols(out, false)}
      filters={[stateFilter('suppliers'), termsFilter, statusFilter]}
      defaults={{ paymentTerms: '30 Days', state: 'Uttar Pradesh', openingBalance: 0 }}
      validate={validateParty('suppliers')}
      beforeSave={(v, s) => {
        const { creditLimit, ...rest } = normaliseParty('suppliers', 'SUP')(v, s)
        return { itemIds: [], ...rest }
      }}
      exportName="suppliers"
      searchPlaceholder="Search by name, code or contact person…"
      drawerSize="lg"
      initialSort={{ key: 'name', dir: 'asc' }}
      stats={(rows, s) => {
        const total = Object.values(out).reduce((a, o) => a + o.balance, 0)
        const overdue = Object.values(out).reduce((a, o) => a + o.overdue, 0)
        const openPos = s.purchaseOrders.filter((p) => ['Submitted', 'Approved', 'Partially Received'].includes(p.status)).length
        return [
          { label: 'Suppliers', value: num(rows.length), icon: Truck, tone: 'blue', foot: `${rows.filter((r) => r.status === 'Active').length} active` },
          { label: 'Total payable', value: inrCompact(total), icon: IndianRupee, tone: 'violet', foot: `${Object.keys(out).length} suppliers to pay`, to: '/accounts/outstanding?tab=payable' },
          { label: 'Overdue payments', value: inrCompact(overdue), icon: AlertCircle, tone: 'red', foot: 'Past due date' },
          { label: 'Open purchase orders', value: num(openPos), icon: ShoppingCart, tone: 'teal', foot: 'Awaiting material', to: '/purchase/orders' },
        ]
      }}
      viewFields={(r) => [...baseView(r), { label: 'Opening balance', value: inr(r.openingBalance) }]}
      viewExtra={(r, s) => <SupplierExtra supplier={r} state={s} out={out[r.id]} />}
      deleteGuard={(r, s) => supplierUsage(s, r.id)}
    />
  )
}

function SupplierExtra({ supplier, state, out }) {
  const invoices = state.purchaseInvoices.filter((i) => i.supplierId === supplier.id)
  const paid = state.payments.filter((x) => x.supplierId === supplier.id).reduce((a, x) => a + Number(x.amount), 0)
  const recent = [...invoices].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)
  const items = (supplier.itemIds || []).map((id) => state.items.find((i) => i.id === id)).filter(Boolean)
  return (
    <>
      <div className="card card-body" style={{ background: 'var(--surface-2)' }}>
        <KeyValue
          cols={2}
          items={[
            { label: 'Total purchases', value: inr(invoices.reduce((a, i) => a + i.totals.grandTotal, 0)) },
            { label: 'Total paid', value: inr(paid) },
            { label: 'Payable', value: <span className={out?.balance ? 'text-amber' : ''}>{inr(out?.balance || 0)}</span> },
            { label: 'Overdue', value: <span className={out?.overdue ? 'text-red' : ''}>{inr(out?.overdue || 0)}</span> },
          ]}
        />
      </div>
      <div className="row row-wrap">
        <Button size="sm" icon={BookOpen} to={`/accounts/supplier-ledger?supplier=${supplier.id}`}>
          View ledger
        </Button>
        <Button size="sm" icon={ShoppingCart} to={`/purchase/orders/new?supplier=${supplier.id}`}>
          New purchase order
        </Button>
        <Button size="sm" icon={Wallet} to={`/accounts/payments/new?supplier=${supplier.id}`}>
          Make payment
        </Button>
      </div>
      {items.length > 0 && (
        <div>
          <SectionTitle>Items supplied</SectionTitle>
          <div className="row row-wrap" style={{ gap: 6 }}>
            {items.map((i) => (
              <span key={i.id} className="badge badge-gray">{i.name}</span>
            ))}
          </div>
        </div>
      )}
      <div>
        <SectionTitle>Recent purchase invoices</SectionTitle>
        <MiniTable
          empty="No purchase invoices from this supplier yet."
          rows={recent}
          columns={[
            { header: 'Bill', render: (i) => <DocNo to={`/purchase/invoices/${i.id}`}>{i.number}</DocNo> },
            { header: 'Date', render: (i) => fmtDate(i.date) },
            { header: 'Amount', align: 'right', render: (i) => inr(i.totals.grandTotal) },
            { header: 'Status', render: (i) => <StatusBadge status={purchaseInvoiceStatus(state, i).status} /> },
          ]}
        />
      </div>
    </>
  )
}
