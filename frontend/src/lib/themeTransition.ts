import { flushSync } from 'react-dom'
import type { Theme } from './settings'

const THEME_META_COLORS: Record<Theme, string> = {
  dark: '#0a0a0b',
  light: '#f5f0e8',
}

const TRANSITION_MS = 600

export interface ThemeTransitionOrigin {
  x: number
  y: number
}

export interface SettingsChangeMeta {
  /** Coordenadas del clic para la “view path” del cambio de tema */
  themeOrigin?: ThemeTransitionOrigin
}

export interface ThemeTransitionOptions {
  reducedMotion?: boolean
  origin?: ThemeTransitionOrigin
}

/** Aplica clases de tema y meta theme-color sin animación */
export function applyThemeToDom(theme: Theme): void {
  const root = document.documentElement
  root.classList.remove('theme-dark', 'theme-light')
  root.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_META_COLORS[theme])
}

/**
 * Cambia el tema con View Transition API: el nuevo estado se revela con clip-path
 * en ::view-transition-new(root) (desde abajo o desde el punto de clic).
 */
export function runThemeTransition(
  nextTheme: Theme,
  commitState: () => void,
  options: ThemeTransitionOptions = {},
): void {
  if (options.reducedMotion || typeof document.startViewTransition !== 'function') {
    applyThemeToDom(nextTheme)
    commitState()
    return
  }

  const transition = document.startViewTransition(() => {
    flushSync(commitState)
    applyThemeToDom(nextTheme)
  })

  void transition.ready.then(() => {
    const { origin } = options
    const keyframes = origin
      ? {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(150vmax at ${origin.x}px ${origin.y}px)`,
          ],
        }
      : {
          clipPath: ['inset(0 0 100% 0)', 'inset(0)'],
        }

    document.documentElement.animate(keyframes, {
      pseudoElement: '::view-transition-new(root)',
      duration: TRANSITION_MS,
      easing: 'ease-in-out',
      fill: 'forwards',
    })
  })
}
