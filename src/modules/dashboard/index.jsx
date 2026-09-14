/** Dashboard module routes (frontend-only demo). */
import { Route, Routes } from 'react-router-dom'
import DashboardPage from './DashboardPage.jsx'
import NotFound from '../../pages/NotFound.jsx'

export default function DashboardModule() {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
