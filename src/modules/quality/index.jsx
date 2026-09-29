/**
 * Quality module routes — incoming, job work, in-process and final inspections.
 * Frontend-only demo (mock store).
 */
import { Route, Routes } from 'react-router-dom'
import NotFound from '../../pages/NotFound.jsx'
import QualityDashboard from './QualityDashboard.jsx'
import InspectionList from './InspectionList.jsx'
import InspectionForm from './InspectionForm.jsx'
import InspectionView from './InspectionView.jsx'
import QcPlansPage from './QcPlansPage.jsx'
import './quality.css'

export default function QualityModule() {
  return (
    <Routes>
      <Route index element={<QualityDashboard />} />
      <Route path="inspections" element={<InspectionList />} />
      <Route path="inspections/new" element={<InspectionForm key="new" />} />
      <Route path="inspections/:id" element={<InspectionView />} />
      <Route path="plans" element={<QcPlansPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
