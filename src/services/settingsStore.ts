import type { AppSettings } from '@/types'

const SETTINGS_KEY = 'qicheng_settings_v1'
export const SETTINGS_CHANGED_EVENT = 'qicheng:settings-changed'

const env = import.meta.env
const envTimeout = Number(env.VITE_REQUEST_TIMEOUT)
const envBaseUrl = env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'

export const DEFAULT_SETTINGS: AppSettings = {
  apiMode: env.VITE_API_MODE === 'live' ? 'live' : 'mock',
  apiBaseUrl: envBaseUrl,
  uploadUrl: env.VITE_UPLOAD_URL || `${envBaseUrl.replace(/\/$/, '')}/uploads`,
  requestTimeout: Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : 30000,
  simulateFailure: false,
  simulateDelay: 900,
  showDemoBadge: true,
}

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {
    // Storage may be unavailable; settings remain limited to this session.
  }
  try {
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT))
  } catch {
    // Non-browser environments do not need cross-module notifications.
  }
  return next
}

export function resetSettings(): AppSettings {
  try {
    localStorage.removeItem(SETTINGS_KEY)
  } catch {
    // Ignore storage failures in demo mode.
  }
  return { ...DEFAULT_SETTINGS }
}
