/** Accounts module routes (frontend-only demo). */
import { Navigate, Route, Routes } from 'react-router-dom'
import NotFound from '../../pages/NotFound.jsx'
import VoucherList from './VoucherList.jsx'
import VoucherForm from './VoucherForm.jsx'
import LedgerPage from './LedgerPage.jsx'
import OutstandingPage from './OutstandingPage.jsx'
import CashBankPage from './CashBankPage.jsx'
import './accounts.css'

export default function AccountsModule() {
  return (
    <Routes>
      <Route index element={<Navigate to="receipts" replace />} />
      <Route path="receipts" element={<VoucherList key="receipts" kind="receipts" />} />
      <Route path="receipts/new" element={<VoucherForm key="receipts-new" kind="receipts" />} />
      <Route path="payments" element={<VoucherList key="payments" kind="payments" />} />
      <Route path="payments/new" element={<VoucherForm key="payments-new" kind="payments" />} />
      <Route path="customer-ledger" element={<LedgerPage key="customer" kind="customer" />} />
      <Route path="supplier-ledger" element={<LedgerPage key="supplier" kind="supplier" />} />
      <Route path="outstanding" element={<OutstandingPage />} />
      <Route path="cash-bank" element={<CashBankPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
