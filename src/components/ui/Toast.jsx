import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

const ToastContext = createContext(null)
const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info, warning: TriangleAlert }

/**
 * Toast notifications.
 *   const toast = useToast()
 *   toast.success('Customer saved', 'Sharma Hardware was added to masters.')
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (type, title, description, duration = 3800) => {
      const id = `${Date.now()}-${Math.random()}`
      setToasts((t) => [...t.slice(-3), { id, type, title, description }])
      setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  const api = useMemo(
    () => ({
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description, 5000),
      info: (title, description) => push('info', title, description),
      warning: (title, description) => push('warning', title, description, 4800),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="toast-stack no-print" aria-live="polite">
          {toasts.map((t) => {
            const Icon = ICONS[t.type]
            return (
              <div key={t.id} className={`toast toast-${t.type}`} role="status">
                <Icon size={18} className="toast-icon" />
                <div className="toast-body">
                  <div className="toast-title">{t.title}</div>
                  {t.description && <div className="toast-desc">{t.description}</div>}
                </div>
                <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                  <X size={15} />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
