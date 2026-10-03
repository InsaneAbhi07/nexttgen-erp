/**
 * NexttGen ERP — application routes (frontend-only demo).
 * Each module owns its nested routes in src/modules/<module>/index.jsx.
 */
import { lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './store/AuthContext.jsx'
import AppLayout from './components/layout/AppLayout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFound from './pages/NotFound.jsx'

const DashboardModule = lazy(() => import('./modules/dashboard/index.jsx'))
const MastersModule = lazy(() => import('./modules/masters/index.jsx'))
const PurchaseModule = lazy(() => import('./modules/purchase/index.jsx'))
const SalesModule = lazy(() => import('./modules/sales/index.jsx'))
const InventoryModule = lazy(() => import('./modules/inventory/index.jsx'))
const ProductionModule = lazy(() => import('./modules/production/index.jsx'))
const QualityModule = lazy(() => import('./modules/quality/index.jsx'))
const HrModule = lazy(() => import('./modules/hr/index.jsx'))
const AccountsModule = lazy(() => import('./modules/accounts/index.jsx'))
const ReportsModule = lazy(() => import('./modules/reports/index.jsx'))
const UsersModule = lazy(() => import('./modules/users/index.jsx'))
const SettingsModule = lazy(() => import('./modules/settings/index.jsx'))
const NotificationsPage = lazy(() => import('./modules/general/NotificationsPage.jsx'))
const ProfilePage = lazy(() => import('./modules/general/ProfilePage.jsx'))
const DemoFlowPage = lazy(() => import('./modules/general/DemoFlowPage.jsx'))

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard/*" element={<DashboardModule />} />
        <Route path="masters/*" element={<MastersModule />} />
        <Route path="purchase/*" element={<PurchaseModule />} />
        <Route path="sales/*" element={<SalesModule />} />
        <Route path="inventory/*" element={<InventoryModule />} />
        <Route path="production/*" element={<ProductionModule />} />
        <Route path="quality/*" element={<QualityModule />} />
        <Route path="hr/*" element={<HrModule />} />
        <Route path="accounts/*" element={<AccountsModule />} />
        <Route path="reports/*" element={<ReportsModule />} />
        <Route path="users/*" element={<UsersModule />} />
        <Route path="settings/*" element={<SettingsModule />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="demo-flow" element={<DemoFlowPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
