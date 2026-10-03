/** HR & payroll module routes — attendance, leave and salary. Frontend-only demo (mock store). */
import { Route, Routes } from 'react-router-dom'
import NotFound from '../../pages/NotFound.jsx'
import HrDashboard from './HrDashboard.jsx'
import MarkAttendance from './MarkAttendance.jsx'
import AttendanceRegister from './AttendanceRegister.jsx'
import LeavesPage from './LeavesPage.jsx'
import PayrollList from './PayrollList.jsx'
import PayrollRunView from './PayrollRunView.jsx'
import { HolidaysPage, LeaveTypesPage } from './SetupPages.jsx'
import './hr.css'

export default function HrModule() {
  return (
    <Routes>
      <Route index element={<HrDashboard />} />
      <Route path="attendance" element={<MarkAttendance />} />
      <Route path="register" element={<AttendanceRegister />} />
      <Route path="leaves" element={<LeavesPage />} />
      <Route path="leave-types" element={<LeaveTypesPage />} />
      <Route path="holidays" element={<HolidaysPage />} />
      <Route path="payroll" element={<PayrollList />} />
      <Route path="payroll/:id" element={<PayrollRunView />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
