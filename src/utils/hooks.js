import { useEffect, useState } from 'react'

/** Sets the browser tab title. */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | NexttGen ERP` : 'NexttGen ERP — Manufacturing & Trading Management System'
  }, [title])
}

/** Simulated loading delay so demo screens feel like they fetch data. */
export function useFakeLoading(ms = 300) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms)
    return () => clearTimeout(t)
  }, [ms])
  return loading
}

/** Simulated async action (e.g. saving) — resolves after a short delay. */
export const fakeDelay = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms))
