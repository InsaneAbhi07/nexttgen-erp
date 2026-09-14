/** Settings routes — frontend-only demo. */
import { Navigate, Route, Routes } from 'react-router-dom'
import NotFound from '../../pages/NotFound.jsx'
import CompanyProfilePage from './CompanyProfilePage.jsx'
import TaxSettingsPage from './TaxSettingsPage.jsx'
import InvoiceSettingsPage from './InvoiceSettingsPage.jsx'
import PaymentTermsPage from './PaymentTermsPage.jsx'

export default function SettingsModule() {
  return (
    <Routes>
      <Route index element={<Navigate to="/settings/company" replace />} />
      <Route path="company" element={<CompanyProfilePage />} />
      <Route path="tax" element={<TaxSettingsPage />} />
      <Route path="invoice" element={<InvoiceSettingsPage />} />
      <Route path="payment-terms" element={<PaymentTermsPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
