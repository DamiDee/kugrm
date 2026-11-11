import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalise a phone number. Nigerian numbers (+234 803…, 234803…, 0803 …) become
 * 11-digit local form, 08031234567. Any other country keeps its country code in
 * international form, +447911123456, whether typed with +, 00 or just the digits.
 */
export function normalizePhone(raw: string): string {
  const s = (raw || '').trim()
  let d = s.replace(/\D/g, '')
  const intl = s.startsWith('+') || s.startsWith('00')
  if (s.startsWith('00')) d = d.slice(2)
  if (d.startsWith('234')) return '0' + d.slice(3).replace(/^0/, '')
  if (intl) return d ? `+${d}` : ''
  if (d.length === 10 && /^[789]/.test(d)) return '0' + d
  // a long number that doesn't start with 0 already carries its country code
  if (d.length >= 11 && /^[1-9]/.test(d)) return `+${d}`
  return d
}

/** A Nigerian mobile (0803…) or an international number with its country code (+44…). */
export function isValidPhone(raw: string): boolean {
  const p = normalizePhone(raw)
  return /^0[789][01]\d{8}$/.test(p) || /^\+[1-9]\d{7,14}$/.test(p)
}

/** Calling codes with one or two digits; the rest have three. */
const SHORT_CODES = /^(1|7|2[07]|3[0-469]|4[013-9]|5[1-8]|6[0-6]|8[1246]|9[0-58])/

/** 08031234567 -> 0803 123 4567; +447911123456 -> +44 791 112 3456 */
export function formatPhone(raw: string): string {
  const d = normalizePhone(raw)
  if (d.startsWith('+')) {
    const digits = d.slice(1)
    const cc = digits.match(SHORT_CODES)?.[0] ?? digits.slice(0, 3)
    const rest = digits.slice(cc.length)
    return `+${cc}${rest ? ' ' + rest.replace(/(\d{3})(?=\d{4})/g, '$1 ') : ''}`
  }
  if (d.length <= 4) return d
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 11)}`
}

/** Formats as the user types: Nigerian numbers in local form (max 11 digits), others with their country code. */
export function formatPhoneInput(raw: string): string {
  const t = raw.trimStart()
  let d = t.replace(/\D/g, '')
  const plus = t.startsWith('+') || t.startsWith('00')
  if (t.startsWith('00')) d = d.slice(2)
  if (d.startsWith('234')) d = '0' + d.slice(3).replace(/^0/, '')
  else if (plus) return `+${d.slice(0, 15)}`
  else if (d && !d.startsWith('0')) return d.slice(0, 15)
  d = d.slice(0, 11)
  if (d.length <= 4) return d
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
}

export function telHref(phone: string) {
  const p = normalizePhone(phone)
  return p.startsWith('+') ? `tel:${p}` : `tel:+234${p.slice(1)}`
}

export function initials(first: string, last?: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

export function fullName(m: { firstName: string; lastName: string }) {
  return `${m.firstName} ${m.lastName}`
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return d.toLocaleDateString('en-GB', opts)
}

export function formatShortDate(iso: string) {
  return formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "15:30" -> "3:30 PM" */
export function formatTime(t?: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`
}

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return formatShortDate(iso.slice(0, 10))
}

export function pct(n: number, d: number, digits = 1) {
  if (!d) return 0
  return Number(((n / d) * 100).toFixed(digits))
}

export function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function downloadFile(name: string, content: string | Blob, type = 'text/csv;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function toCSV(rows: Record<string, string | number | boolean | undefined>[]) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
}

/* ---------- sessions ---------- */

type SessionLike = { name: string; code: string; date: string; series?: string; day?: number; session?: 'morning' | 'evening'; startTime?: string }

export const SESSION_LABEL = { morning: 'Morning', evening: 'Evening' } as const

/** "Wed 18 Nov · Morning" */
export function sessionShort(e: SessionLike) {
  const d = formatDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' })
  return e.session ? `${d} · ${SESSION_LABEL[e.session]}` : d
}

/** "Day 1 · Morning session" or "" for a single-session event */
export function sessionLine(e: SessionLike) {
  return [e.day ? `Day ${e.day}` : '', e.session ? `${SESSION_LABEL[e.session]} session` : ''].filter(Boolean).join(' · ')
}

/** "TGA 2026 · Day 1 Morning", or the event code */
export function eventLabel(e: SessionLike) {
  if (!e.series) return e.code
  return `${e.series} · ${[e.day ? `Day ${e.day}` : '', e.session ? SESSION_LABEL[e.session] : ''].filter(Boolean).join(' ')}`
}

/** sort key that puts a series' sessions in service order */
export const sessionOrder = (e: SessionLike) => `${e.date}${e.session === 'evening' ? 'b' : 'a'}`
