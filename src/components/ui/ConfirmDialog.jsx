import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { Modal } from './Modal.jsx'
import Button from './Button.jsx'

const ConfirmContext = createContext(null)

/**
 * Promise-based confirmation dialog.
 *   const confirm = useConfirm()
 *   if (await confirm({ title: 'Delete customer?', message: '...', confirmLabel: 'Delete', tone: 'danger' })) { ... }
 */
export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback((options) => {
    setOpts({ confirmLabel: 'Confirm', cancelLabel: 'Cancel', tone: 'primary', ...options })
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (result) => {
    resolver.current?.(result)
    resolver.current = null
    setOpts(null)
  }

  const danger = opts?.tone === 'danger'
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(opts)}
        onClose={() => close(false)}
        size="sm"
        footer={
          <>
            <Button onClick={() => close(false)}>{opts?.cancelLabel}</Button>
            <Button variant={danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
              {opts?.confirmLabel}
            </Button>
          </>
        }
      >
        <div className={`confirm-icon ${danger ? 'tone-red' : 'tone-blue'}`}>{danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}</div>
        <h2 className="modal-title">{opts?.title}</h2>
        {opts?.message && <p className="muted" style={{ marginTop: 6, lineHeight: 1.55 }}>{opts.message}</p>}
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
