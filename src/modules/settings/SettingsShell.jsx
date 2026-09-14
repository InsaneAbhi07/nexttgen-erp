/** Shared header + sub navigation for settings pages (frontend-only demo). */
import { useLocation, useNavigate } from 'react-router-dom'
import { Building2, FileText, Percent, CalendarClock } from 'lucide-react'
import { PageHeader, Tabs } from '../../components/ui/index.js'
import { usePageTitle } from '../../utils/hooks.js'
import './settings.css'

const TABS = [
  { key: '/settings/company', label: 'Company profile', icon: Building2 },
  { key: '/settings/tax', label: 'Tax settings', icon: Percent },
  { key: '/settings/invoice', label: 'Invoice settings', icon: FileText },
  { key: '/settings/payment-terms', label: 'Payment terms', icon: CalendarClock },
]

export default function SettingsShell({ title, subtitle, actions, children }) {
  usePageTitle(title)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} breadcrumbs={[{ label: 'Settings', to: '/settings/company' }, { label: title }]} actions={actions} />
      <Tabs tabs={TABS} value={pathname} onChange={(k) => navigate(k)} style={{ marginBottom: 18 }} />
      {children}
    </>
  )
}

/** Local draft state with dirty tracking. */
export function isDirty(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b)
}
