/**
 * Inventory module routes — frontend-only demo (stock derived from mock stock moves).
 */
import { Navigate, Route, Routes } from 'react-router-dom'
import NotFound from '../../pages/NotFound.jsx'
import StockOverview from './StockOverview.jsx'
import StockMovementPage from './StockMovementPage.jsx'
import TransferList from './TransferList.jsx'
import TransferForm from './TransferForm.jsx'
import TransferView from './TransferView.jsx'
import AdjustmentsPage from './AdjustmentsPage.jsx'
import StockLedgerPage from './StockLedgerPage.jsx'
import './inventory.css'

export default function InventoryModule() {
  return (
    <Routes>
      <Route index element={<Navigate to="stock" replace />} />
      <Route path="stock" element={<StockOverview />} />
      <Route path="stock-in" element={<StockMovementPage key="in" kind="in" />} />
      <Route path="stock-out" element={<StockMovementPage key="out" kind="out" />} />
      <Route path="transfers" element={<TransferList />} />
      <Route path="transfers/new" element={<TransferForm key="new" />} />
      <Route path="transfers/:id" element={<TransferView />} />
      <Route path="transfers/:id/edit" element={<TransferForm key="edit" />} />
      <Route path="adjustments" element={<AdjustmentsPage />} />
      <Route path="ledger" element={<StockLedgerPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
