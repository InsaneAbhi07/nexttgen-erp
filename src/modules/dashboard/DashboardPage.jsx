/**
 * Dashboard — Owner / Admin / Manager experiences over the same live mock data.
 * Frontend-only demo: nothing is fetched, all figures are computed in the browser.
 */
import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../store/AuthContext.jsx'
import { useErp } from '../../store/ErpStore.jsx'
import { PageHeader, PageSkeleton, Segmented } from '../../components/ui/index.js'
import { today } from '../../utils/format.js'
import { useFakeLoading, usePageTitle } from '../../utils/hooks.js'
import { PERIODS, greeting } from './dashData.js'
import OwnerView from './OwnerView.jsx'
import AdminView from './AdminView.jsx'
import ManagerView from './ManagerView.jsx'
import './dashboard.css'

const VIEWS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
]

const defaultView = (role) => (role === 'Admin' ? 'admin' : role === 'Manager' ? 'manager' : 'owner')

const VIEW_COPY = {
  owner: 'Sales, cash position, stock and production for the whole business.',
  admin: 'Masters, users and system usage across the workspace.',
  manager: 'Approvals, dispatches, production and stock that need attention.',
}

export default function DashboardPage() {
  usePageTitle('Dashboard')
  const { user } = useAuth()
  const { state } = useErp()
  const [params, setParams] = useSearchParams()
  const [period, setPeriod] = useState('today')
  const loading = useFakeLoading(350)

  const requested = params.get('view')
  const view = VIEWS.some((v) => v.value === requested) ? requested : defaultView(user?.role)
  const setView = (v) => {
    const next = new URLSearchParams(params)
    next.set('view', v)
    setParams(next, { replace: true })
  }

  const company = (state.settings.companies || []).find((c) => c.id === state.settings.activeCompanyId)
  const dateText = new Date(`${today()}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(' ')[0] || 'there'}`}
        subtitle={`${dateText}, ${company?.location || 'Aligarh Plant'}. ${VIEW_COPY[view]}`}
        actions={
          <div className="row row-wrap dash-header-controls" style={{ gap: 8 }}>
            <Segmented options={VIEWS} value={view} onChange={setView} />
            <Segmented options={PERIODS} value={period} onChange={setPeriod} />
          </div>
        }
      />
      {loading ? (
        <PageSkeleton />
      ) : view === 'admin' ? (
        <AdminView period={period} />
      ) : view === 'manager' ? (
        <ManagerView period={period} />
      ) : (
        <OwnerView period={period} />
      )}
    </>
  )
}
