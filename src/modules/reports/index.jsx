// Reports module routes — NexttGen ERP (frontend-only demo).
import { Route, Routes } from 'react-router-dom'
import ReportsCenter from './ReportsCenter.jsx'
import ReportViewer from './ReportViewer.jsx'
import NotFound from '../../pages/NotFound.jsx'

export default function ReportsModule() {
  return (
    <Routes>
      <Route index element={<ReportsCenter />} />
      <Route path=":reportId" element={<ReportViewer />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
