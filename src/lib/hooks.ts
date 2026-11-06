import { useEffect, useState } from 'react'

const seen = new Set<string>()
/** Brief skeleton on the first visit to a page in a session, so loading states are real UI rather than a blank flash. */
export function useFirstLoad(key: string, ms = 380) {
  const [loading, setLoading] = useState(!seen.has(key))
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => { seen.add(key); setLoading(false) }, ms)
    return () => clearTimeout(t)
  }, [key, ms, loading])
  return loading
}

/** Tracks a CSS media query, e.g. useMediaQuery('(min-width: 1280px)'). */
export function useMediaQuery(query: string) {
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false)
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}
