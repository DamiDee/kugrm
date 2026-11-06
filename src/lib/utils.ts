import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Normalise any Nigerian number (+234 803…, 234803…, 0803 …) to 11-digit local form. */
export function normalizePhone(raw: string): string {
  let d = (raw || '').replace(/\D/g, '')
  if (d.startsWith('234')) d = '0' + d.slice(3)
  if (d.length === 10 && /^[789]/.test(d)) d = '0' + d
  return d
}

export function isValidNigerianPhone(raw: string): boolean {
  return /^0[789][01]\d{8}$/.test(normalizePhone(raw))
}

/** 08031234567 -> 0803 123 4567 */
export function formatPhone(raw: string): string {
  const d = normalizePhone(raw)
  if (d.length <= 4) return d
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 11)}`
}

/** Formats as the user types, keeping only digits (max 11). */
export function formatPhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('234')) d = '0' + d.slice(3)
  d = d.slice(0, 11)
  if (d.length <= 4) return d
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
}

export function telHref(phone: string) {
  return `tel:+234${normalizePhone(phone).slice(1)}`
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
