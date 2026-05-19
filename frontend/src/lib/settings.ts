import type { Language } from './types'

export type Theme = 'dark' | 'light'

export interface AppSettings {
  theme: Theme
  language: Language
  sfxVolume: number
  musicVolume: number
}

const STORAGE_KEY = 'gdd-settings'

const DEFAULTS: AppSettings = {
  theme: 'dark',
  language: 'es',
  sfxVolume: 0.8,
  musicVolume: 0.3,
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      language: parsed.language === 'en' ? 'en' : 'es',
      sfxVolume: clamp01(parsed.sfxVolume ?? DEFAULTS.sfxVolume),
      musicVolume: clamp01(parsed.musicVolume ?? DEFAULTS.musicVolume),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...loadSettings(), ...partial }
  next.sfxVolume = clamp01(next.sfxVolume)
  next.musicVolume = clamp01(next.musicVolume)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}
