import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

function useOverlayBehaviour(open, onClose) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
}

/** Modal — centered dialog. size: sm | md | lg | xl */
export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer, closeOnOverlay = true, className = '', bodyClassName = '' }) {
  useOverlayBehaviour(open, onClose)
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="overlay" onMouseDown={(e) => closeOnOverlay && e.target === e.currentTarget && onClose?.()}>
      <div className={`modal size-${size} ${className}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        {title && (
          <div className="modal-header no-print">
            <div>
              <h2 className="modal-title">{title}</h2>
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className={`modal-body ${bodyClassName}`}>{children}</div>
        {footer && <div className="modal-footer no-print">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** Drawer — slides in from the right. size: md | lg */
export function Drawer({ open, onClose, title, subtitle, size = 'md', children, footer }) {
  useOverlayBehaviour(open, onClose)
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="overlay drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <aside className={`drawer size-${size}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </aside>
    </div>,
    document.body,
  )
}

export default Modal
