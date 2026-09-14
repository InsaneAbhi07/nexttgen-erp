/**
 * ErpStore — the mock "backend" of the NexttGen ERP demo.
 * ------------------------------------------------------------------
 * FRONTEND-ONLY. No API, no database. All collections live in React state
 * and are persisted to localStorage so the demo survives page refreshes.
 *
 * Usage:
 *   const { state, save, remove, patch, get } = useErp()
 *   const po = save('purchaseOrders', { date, supplierId, lines, ... })  // returns saved record (with id & number)
 *
 * save() automatically:
 *   - assigns id, document number (PO/26-27/0143) and timestamps
 *   - regenerates stock moves for stock-affecting documents
 *   - syncs workflow statuses (PO received, SO invoiced, production completed...)
 *   - writes an activity log entry and optional notification
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { buildSeedData, DATA_VERSION } from '../data/seed.js'
import { COLLECTIONS, NUMBERED_COLLECTIONS } from './collections.js'
import { nextDocNumber, uid } from './numbering.js'
import { replaceMoves, syncStatuses, STOCK_COLLECTIONS } from './stockEngine.js'
import { byId, itemStock } from './selectors.js'
import { today } from '../utils/format.js'

const STORAGE_KEY = 'nexttgen-erp-demo-data'
export const SESSION_KEY = 'nexttgen-erp-session'

const ErpContext = createContext(null)

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.version === DATA_VERSION) return parsed
    }
  } catch {
    /* corrupted storage → reseed */
  }
  return buildSeedData()
}

export function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const refOf = (r) => r?.number || r?.code || r?.name || ''

export function ErpProvider({ children }) {
  const [state, setState] = useState(loadInitial)
  const ref = useRef(state)

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch (err) {
        console.warn('[NexttGen demo] Could not persist demo data to localStorage', err)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [state])

  const commit = useCallback((updater) => {
    const next = updater(ref.current)
    ref.current = next
    setState(next)
    return next
  }, [])

  const currentUserName = () => {
    const session = readSession()
    return ref.current.users.find((u) => u.id === session?.userId)?.name || 'System'
  }

  const makeActivity = (action, collection, record) => {
    const meta = COLLECTIONS[collection]
    return {
      id: uid('act'),
      user: currentUserName(),
      action,
      entity: meta?.label || collection,
      ref: refOf(record),
      module: meta?.module || '',
      at: new Date().toISOString(),
      link: action === 'deleted' ? null : meta?.route?.(record) || null,
    }
  }

  /** Low-stock notifications for items whose balance crossed the minimum. */
  const lowStockAlerts = (prev, next, collection, record) => {
    if (!STOCK_COLLECTIONS.includes(collection)) return []
    const itemIds = new Set(next.stockMoves.filter((m) => m.sourceId === record.id).map((m) => m.itemId))
    const items = byId(next.items)
    const alerts = []
    itemIds.forEach((id) => {
      const item = items.get(id)
      if (!item || !Number(item.minStock)) return
      const before = itemStock(prev, id)
      const after = itemStock(next, id)
      if (after <= Number(item.minStock) && before > Number(item.minStock)) {
        alerts.push({
          id: uid('ntf'),
          type: 'stock',
          title: `Low stock: ${item.name}`,
          message: `${after} ${item.unit} left against a minimum of ${item.minStock} ${item.unit}.`,
          at: new Date().toISOString(),
          read: false,
          link: '/inventory/stock',
        })
      }
    })
    return alerts
  }

  /**
   * Create or update a record.
   * @param {string} collection
   * @param {object} input
   * @param {object} opts { silent?: boolean, notify?: {type,title,message,link}, action?: string }
   */
  const save = useCallback((collection, input, opts = {}) => {
    const cur = ref.current
    const list = cur[collection] || []
    const existing = input.id ? list.find((r) => r.id === input.id) : null
    const nowIso = new Date().toISOString()
    const record = { ...input }
    if (!existing) {
      record.id = record.id || uid(COLLECTIONS[collection]?.idPrefix || 'rec')
      record.createdAt = record.createdAt || nowIso
      record.createdBy = record.createdBy || currentUserName()
      if (NUMBERED_COLLECTIONS.includes(collection) && !record.number) {
        record.number = nextDocNumber(cur, collection, record.date || today())
      }
      if (collection === 'items' && !record.openingDate) record.openingDate = today()
    } else {
      record.updatedAt = nowIso
    }

    commit((s) => {
      let next = {
        ...s,
        [collection]: existing ? s[collection].map((r) => (r.id === record.id ? record : r)) : [record, ...(s[collection] || [])],
      }
      next.stockMoves = replaceMoves(s.stockMoves, collection, record)
      next = syncStatuses(next)
      const notes = lowStockAlerts(s, next, collection, record)
      if (opts.notify) notes.push({ id: uid('ntf'), at: nowIso, read: false, ...opts.notify })
      if (notes.length) next.notifications = [...notes, ...s.notifications]
      if (!opts.silent) next.activities = [makeActivity(opts.action || (existing ? 'updated' : 'created'), collection, record), ...s.activities].slice(0, 300)
      return next
    })
    return ref.current[collection].find((r) => r.id === record.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patch = useCallback((collection, id, changes, opts) => {
    const existing = (ref.current[collection] || []).find((r) => r.id === id)
    if (!existing) return null
    return save(collection, { ...existing, ...changes }, opts)
  }, [save])

  const remove = useCallback((collection, id, opts = {}) => {
    const existing = (ref.current[collection] || []).find((r) => r.id === id)
    if (!existing) return
    commit((s) => {
      let next = { ...s, [collection]: s[collection].filter((r) => r.id !== id) }
      next.stockMoves = replaceMoves(s.stockMoves, collection, existing, true)
      next = syncStatuses(next)
      if (!opts.silent) next.activities = [makeActivity('deleted', collection, existing), ...s.activities].slice(0, 300)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Settings: section is 'company' | 'tax' | 'invoice' | 'paymentTerms' | 'accounts' | 'preferences' | 'activeCompanyId' */
  const updateSettings = useCallback((section, values) => {
    commit((s) => {
      const current = s.settings[section]
      const merged = Array.isArray(values) || typeof values !== 'object' || values === null ? values : { ...current, ...values }
      return { ...s, settings: { ...s.settings, [section]: merged } }
    })
  }, [commit])

  const addNotification = useCallback((n) => {
    commit((s) => ({ ...s, notifications: [{ id: uid('ntf'), at: new Date().toISOString(), read: false, ...n }, ...s.notifications] }))
  }, [commit])

  const markNotificationRead = useCallback((id, read = true) => {
    commit((s) => ({ ...s, notifications: s.notifications.map((n) => (n.id === id ? { ...n, read } : n)) }))
  }, [commit])

  const markAllNotificationsRead = useCallback(() => {
    commit((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }))
  }, [commit])

  const removeNotification = useCallback((id) => {
    commit((s) => ({ ...s, notifications: s.notifications.filter((n) => n.id !== id) }))
  }, [commit])

  const logActivity = useCallback((action, entity, refText, module, link = null) => {
    commit((s) => ({
      ...s,
      activities: [{ id: uid('act'), user: currentUserName(), action, entity, ref: refText, module, at: new Date().toISOString(), link }, ...s.activities].slice(0, 300),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit])

  const resetDemo = useCallback(() => {
    commit(() => buildSeedData())
  }, [commit])

  /** Peek the next document number without saving. */
  const previewNumber = useCallback((collection, date) => nextDocNumber(ref.current, collection, date || today()), [])

  /** get('customers', id) → record | undefined */
  const get = useCallback((collection, id) => (id ? byId(ref.current[collection] || []).get(id) : undefined), [])

  const value = useMemo(
    () => ({
      state,
      save,
      patch,
      remove,
      get: (collection, id) => (id ? byId(state[collection] || []).get(id) : undefined),
      getLatest: get,
      updateSettings,
      addNotification,
      markNotificationRead,
      markAllNotificationsRead,
      removeNotification,
      logActivity,
      resetDemo,
      previewNumber,
    }),
    [state, save, patch, remove, get, updateSettings, addNotification, markNotificationRead, markAllNotificationsRead, removeNotification, logActivity, resetDemo, previewNumber],
  )

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>
}

export function useErp() {
  const ctx = useContext(ErpContext)
  if (!ctx) throw new Error('useErp must be used inside <ErpProvider>')
  return ctx
}
