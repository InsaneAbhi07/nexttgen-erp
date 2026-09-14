/**
 * Sales module routes — quotations, sales orders, delivery challans, invoices, returns.
 * Frontend-only demo; all data comes from the local mock store.
 */
import { Navigate, Route, Routes } from 'react-router-dom'
import NotFound from '../../pages/NotFound.jsx'
import { QuotationForm, QuotationList, QuotationView } from './Quotations.jsx'
import { SalesOrderForm, SalesOrderList, SalesOrderView } from './SalesOrders.jsx'
import { ChallanForm, ChallanList, ChallanView } from './Challans.jsx'
import { InvoiceForm, InvoiceList, InvoiceView } from './Invoices.jsx'
import { ReturnForm, ReturnList, ReturnView } from './Returns.jsx'

export default function SalesModule() {
  return (
    <Routes>
      <Route index element={<Navigate to="orders" replace />} />

      <Route path="quotations" element={<QuotationList />} />
      <Route path="quotations/new" element={<QuotationForm />} />
      <Route path="quotations/:id" element={<QuotationView />} />
      <Route path="quotations/:id/edit" element={<QuotationForm />} />

      <Route path="orders" element={<SalesOrderList />} />
      <Route path="orders/new" element={<SalesOrderForm />} />
      <Route path="orders/:id" element={<SalesOrderView />} />
      <Route path="orders/:id/edit" element={<SalesOrderForm />} />

      <Route path="challans" element={<ChallanList />} />
      <Route path="challans/new" element={<ChallanForm />} />
      <Route path="challans/:id" element={<ChallanView />} />
      <Route path="challans/:id/edit" element={<ChallanForm />} />

      <Route path="invoices" element={<InvoiceList />} />
      <Route path="invoices/new" element={<InvoiceForm />} />
      <Route path="invoices/:id" element={<InvoiceView />} />
      <Route path="invoices/:id/edit" element={<InvoiceForm />} />

      <Route path="returns" element={<ReturnList />} />
      <Route path="returns/new" element={<ReturnForm />} />
      <Route path="returns/:id" element={<ReturnView />} />
      <Route path="returns/:id/edit" element={<ReturnForm />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
