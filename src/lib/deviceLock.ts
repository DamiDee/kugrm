import { normalizePhone } from './utils'

const DEVICE_LOCK_KEY = 'grm-device-lookup-phone'

export function getLockedDevicePhone(): string | null {
  try {
    const raw = localStorage.getItem(DEVICE_LOCK_KEY)
    return raw ? normalizePhone(raw) : null
  } catch {
    return null
  }
}

export function setLockedDevicePhone(phone: string): void {
  try {
    const normalized = normalizePhone(phone)
    if (normalized && !localStorage.getItem(DEVICE_LOCK_KEY)) {
      localStorage.setItem(DEVICE_LOCK_KEY, normalized)
    }
  } catch {
    /* ignore storage errors */
  }
}

export function canBypassDeviceLock(admin: { email?: string } | null | undefined): boolean {
  if (!admin) return false
  return !!admin.email
}

