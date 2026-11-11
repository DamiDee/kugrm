/**
 * HTTP client for the backend (docs/API.md). The address comes from VITE_API_URL
 * in .env; with no address the app runs on its built-in demo data.
 */

export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '')
export const LIVE = !!API_BASE

export class ApiError extends Error {
  status: number
  code: string
  fields?: Record<string, string>
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

const KEYS = { access: 'grm-admin-access', refresh: 'grm-admin-refresh' } as const
type TokenKey = 'access' | 'refresh' | 'team'

/** Team JWT is kept only in application memory per security requirements. */
let teamTokenMemory: string | null = null
try { localStorage.removeItem('grm-team-access') } catch { /* ignore */ }

export const tokens = {
  get(k: TokenKey) {
    if (k === 'team') return teamTokenMemory
    try { return sessionStorage.getItem(KEYS[k]) ?? localStorage.getItem(KEYS[k]) } catch { return null }
  },
  set(k: TokenKey, v?: string | null, remember = true) {
    if (k === 'team') {
      teamTokenMemory = v ?? null
      return
    }
    try {
      sessionStorage.removeItem(KEYS[k])
      localStorage.removeItem(KEYS[k])
      if (v) (remember ? localStorage : sessionStorage).setItem(KEYS[k], v)
    } catch { /* blocked storage: the session lasts until reload */ }
  },
}

type Query = Record<string, string | number | boolean | undefined>
export interface RequestOpts {
  method?: string
  body?: unknown
  form?: FormData
  query?: Query
  /** which token to send; none for public endpoints */
  as?: 'admin' | 'team'
  cache?: RequestCache
}

/** Called when the admin session can't be renewed. */
let onSignedOut: () => void = () => {}
export const setOnSignedOut = (fn: () => void) => { onSignedOut = fn }

/** Called when the team session is unauthorized or revoked. */
let onTeamSignedOut: () => void = () => {}
export const setOnTeamSignedOut = (fn: () => void) => { onTeamSignedOut = fn }

function url(path: string, query?: Query) {
  const q = new URLSearchParams()
  Object.entries(query ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)) })
  const s = q.toString()
  return `${API_BASE}${path}${s ? `?${s}` : ''}`
}

async function send(path: string, opts: RequestOpts): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = opts.as === 'admin' ? tokens.get('access') : opts.as === 'team' ? tokens.get('team') : null
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  try {
    return await fetch(url(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      cache: opts.cache,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Can’t reach the server. Check the connection and try again.')
  }
}

let refreshing: Promise<boolean> | null = null
function refreshAdmin() {
  const refreshToken = tokens.get('refresh')
  if (!refreshToken) return Promise.resolve(false)
  let remember = true
  try { remember = !!localStorage.getItem(KEYS.refresh) } catch { /* ignore */ }
  refreshing ??= send('/auth/refresh', { method: 'POST', body: { refreshToken }, cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) return false
      const d = await r.json()
      tokens.set('access', d.accessToken, remember)
      if (d.refreshToken) tokens.set('refresh', d.refreshToken, remember)
      return true
    })
    .catch(() => false)
    .finally(() => { refreshing = null })
  return refreshing
}

async function fail(r: Response): Promise<never> {
  const d = await r.json().catch(() => null)
  throw new ApiError(r.status, d?.error?.code ?? 'ERROR', d?.error?.message ?? 'Something went wrong. Please try again.', d?.error?.fields)
}

async function authed(path: string, opts: RequestOpts) {
  let r = await send(path, opts)
  if (r.status === 401 && opts.as === 'admin' && path !== '/auth/login') {
    if (await refreshAdmin()) r = await send(path, opts)
    else onSignedOut()
  } else if ((r.status === 401 || (r.status === 403 && path === '/team/me')) && opts.as === 'team') {
    tokens.set('team', null)
    onTeamSignedOut()
  }
  if (!r.ok) await fail(r)
  return r
}

export async function api<T = any>(path: string, opts: RequestOpts = {}): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const r = await authed(path, opts)
  if (r.status === 204) return undefined as T
  return (await r.json().catch(() => undefined)) as T
}

/** A file from the server, with the name it suggests. */
export async function apiFile(path: string, opts: RequestOpts = {}) {
  const r = await authed(path, opts)
  const name = r.headers.get('content-disposition')?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1]
  return { blob: await r.blob(), name: name ? decodeURIComponent(name) : undefined }
}
