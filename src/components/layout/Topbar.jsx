import { useNavigate } from 'react-router-dom'
import { Bell, Building2, Check, ChevronDown, HelpCircle, Keyboard, LifeBuoy, LogOut, Menu, PanelLeft, RotateCcw, Route, Settings, UserRound } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { Dropdown } from '../ui/Dropdown.jsx'
import { useToast } from '../ui/Toast.jsx'
import { useConfirm } from '../ui/ConfirmDialog.jsx'
import { Avatar } from '../ui/Misc.jsx'
import GlobalSearch from './GlobalSearch.jsx'
import NotificationMenu from './NotificationMenu.jsx'

export default function Topbar({ onToggleCollapse, onOpenMobile }) {
  const { state, updateSettings, resetDemo } = useErp()
  const { user, logout, can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const companies = state.settings.companies || []
  const activeCompany = companies.find((c) => c.id === state.settings.activeCompanyId) || companies[0]

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Reset demo data?',
      message: 'All records you created or changed in this browser will be replaced with fresh sample data.',
      confirmLabel: 'Reset data',
      tone: 'danger',
    })
    if (ok) {
      resetDemo()
      toast.success('Demo data reset', 'Fresh sample data has been loaded.')
      navigate('/dashboard')
    }
  }

  const handleLogout = () => {
    logout()
    toast.info('Signed out', 'Sign in again to continue the demo.')
    navigate('/login', { replace: true })
  }

  return (
    <header className="topbar no-print">
      <button type="button" className="icon-btn mobile-only" onClick={onOpenMobile} aria-label="Open menu">
        <Menu size={19} />
      </button>
      <button type="button" className="icon-btn desktop-only" onClick={onToggleCollapse} aria-label="Collapse or expand sidebar">
        <PanelLeft size={18} />
      </button>

      <GlobalSearch />

      <div className="topbar-right">
        <Dropdown
          width={236}
          items={[
            { heading: 'Help' },
            { label: 'Demo walkthrough', icon: Route, to: '/demo-flow' },
            { label: 'Keyboard shortcuts', icon: Keyboard, onClick: () => toast.info('Keyboard shortcuts', 'Ctrl + K opens global search. Esc closes dialogs.') },
            { label: 'Contact support', icon: LifeBuoy, onClick: () => toast.info('Support', 'In the live product this opens a support ticket. Here it is a demo action.') },
          ]}
          trigger={({ toggle }) => (
            <button type="button" className="icon-btn" onClick={toggle} aria-label="Help">
              <HelpCircle size={18} />
            </button>
          )}
        />
        <NotificationMenu />
        <div className="topbar-divider" />

        <Dropdown
          width={270}
          items={[
            { heading: 'Switch company' },
            ...companies.map((c) => ({
              label: `${c.name} (${c.location})`,
              icon: c.id === activeCompany?.id ? Check : Building2,
              onClick: () => {
                updateSettings('activeCompanyId', c.id)
                toast.success('Company switched', `You are now working in ${c.name}, ${c.location}.`)
              },
            })),
          ]}
          trigger={({ toggle }) => (
            <button type="button" className="company-switch" onClick={toggle} aria-label="Switch company">
              <Building2 size={15} />
              <span className="company-name truncate">{activeCompany?.location}</span>
              <ChevronDown size={14} />
            </button>
          )}
        />

        <Dropdown
          width={230}
          items={[
            { heading: user?.email },
            { label: 'My profile', icon: UserRound, to: '/profile' },
            { label: 'Notification preferences', icon: Bell, to: '/profile?tab=notifications' },
            can('Settings') && { label: 'Company settings', icon: Settings, to: '/settings/company' },
            { divider: true },
            { label: 'Reset demo data', icon: RotateCcw, onClick: handleReset },
            { label: 'Log out', icon: LogOut, danger: true, onClick: handleLogout },
          ]}
          trigger={({ toggle }) => (
            <button type="button" className="user-chip" onClick={toggle} aria-label="Account menu">
              <Avatar name={user?.name} />
              <span className="who">
                <div className="who-name">{user?.name}</div>
                <div className="who-role">{user?.role}</div>
              </span>
              <ChevronDown size={14} className="desktop-only" style={{ color: 'var(--ink-3)' }} />
            </button>
          )}
        />
      </div>
    </header>
  )
}
