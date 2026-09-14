/** Receipt / payment configuration shared by list, form and voucher print (frontend-only demo). */
import { purchaseInvoiceStatus, salesInvoiceStatus } from '../../store/selectors.js'

export const VOUCHER_KINDS = {
  receipts: {
    collection: 'receipts',
    partyKey: 'customerId',
    partyColl: 'customers',
    partyParam: 'customer',
    partyLabel: 'Customer',
    invoiceColl: 'salesInvoices',
    invoiceBase: '/sales/invoices',
    statusFn: salesInvoiceStatus,
    outType: 'receivable',
    singular: 'Receipt',
    title: 'Customer receipts',
    subtitle: 'Money received from customers against sales invoices',
    base: '/accounts/receipts',
    ledger: (id) => `/accounts/customer-ledger?customer=${id}`,
    addLabel: 'Record receipt',
    saveLabel: 'Save receipt',
    voucherTitle: 'Receipt Voucher',
    partyHeading: 'Received from',
    flowWord: 'Received',
  },
  payments: {
    collection: 'payments',
    partyKey: 'supplierId',
    partyColl: 'suppliers',
    partyParam: 'supplier',
    partyLabel: 'Supplier',
    invoiceColl: 'purchaseInvoices',
    invoiceBase: '/purchase/invoices',
    statusFn: purchaseInvoiceStatus,
    outType: 'payable',
    singular: 'Payment',
    title: 'Supplier payments',
    subtitle: 'Money paid to suppliers against purchase invoices',
    base: '/accounts/payments',
    ledger: (id) => `/accounts/supplier-ledger?supplier=${id}`,
    addLabel: 'Record payment',
    saveLabel: 'Save payment',
    voucherTitle: 'Payment Voucher',
    partyHeading: 'Paid to',
    flowWord: 'Paid',
  },
}

export const REFERENCE_LABEL = {
  Bank: { label: 'UTR / NEFT reference', placeholder: 'e.g. NEFT UTR HDFCN52618374' },
  UPI: { label: 'UPI transaction ID', placeholder: 'e.g. 426581234567' },
  Cheque: { label: 'Cheque no. and bank', placeholder: 'e.g. 004512, State Bank of India' },
  Cash: { label: 'Cash memo no.', placeholder: 'e.g. Cash Memo 2231' },
}

export const MODE_TONE = { Cash: 'amber', Bank: 'blue', UPI: 'violet', Cheque: 'teal' }

/** Voucher link for a ledger row. */
export const ledgerVoucherLink = (row) => {
  if (row.kind === 'Sales Invoice') return `/sales/invoices/${row.refId}`
  if (row.kind.startsWith('Receipt')) return `/accounts/receipts?view=${row.refId}`
  if (row.kind === 'Sales Return') return `/sales/returns/${row.refId}`
  if (row.kind === 'Purchase Invoice') return `/purchase/invoices/${row.refId}`
  if (row.kind.startsWith('Payment')) return `/accounts/payments?view=${row.refId}`
  if (row.kind === 'Purchase Return') return `/purchase/returns/${row.refId}`
  return null
}
