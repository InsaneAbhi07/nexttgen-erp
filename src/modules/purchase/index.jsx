/**
 * Purchase module routes — requisitions, orders, GRN, invoices, returns.
 * Frontend-only demo: all documents live in the mock store.
 */
import { Navigate, Route, Routes } from 'react-router-dom'
import NotFound from '../../pages/NotFound.jsx'
import './purchase.css'
import { RequisitionList, RequisitionFormPage, RequisitionView } from './Requisitions.jsx'
import PurchaseOrderList from './PurchaseOrderList.jsx'
import PurchaseOrderFormPage from './PurchaseOrderForm.jsx'
import PurchaseOrderView from './PurchaseOrderView.jsx'
import { GrnList, GrnFormPage, GrnView } from './Grn.jsx'
import { PurchaseInvoiceList, PurchaseInvoiceFormPage, PurchaseInvoiceView } from './PurchaseInvoices.jsx'
import { PurchaseReturnList, PurchaseReturnFormPage, PurchaseReturnView } from './PurchaseReturns.jsx'

export default function PurchaseModule() {
  return (
    <Routes>
      <Route index element={<Navigate to="orders" replace />} />

      <Route path="requisitions" element={<RequisitionList />} />
      <Route path="requisitions/new" element={<RequisitionFormPage />} />
      <Route path="requisitions/:id" element={<RequisitionView />} />
      <Route path="requisitions/:id/edit" element={<RequisitionFormPage />} />

      <Route path="orders" element={<PurchaseOrderList />} />
      <Route path="orders/new" element={<PurchaseOrderFormPage />} />
      <Route path="orders/:id" element={<PurchaseOrderView />} />
      <Route path="orders/:id/edit" element={<PurchaseOrderFormPage />} />

      <Route path="grn" element={<GrnList />} />
      <Route path="grn/new" element={<GrnFormPage />} />
      <Route path="grn/:id" element={<GrnView />} />
      <Route path="grn/:id/edit" element={<GrnFormPage />} />

      <Route path="invoices" element={<PurchaseInvoiceList />} />
      <Route path="invoices/new" element={<PurchaseInvoiceFormPage />} />
      <Route path="invoices/:id" element={<PurchaseInvoiceView />} />
      <Route path="invoices/:id/edit" element={<PurchaseInvoiceFormPage />} />

      <Route path="returns" element={<PurchaseReturnList />} />
      <Route path="returns/new" element={<PurchaseReturnFormPage />} />
      <Route path="returns/:id" element={<PurchaseReturnView />} />
      <Route path="returns/:id/edit" element={<PurchaseReturnFormPage />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
