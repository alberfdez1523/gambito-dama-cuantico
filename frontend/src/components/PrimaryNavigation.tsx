import type { Language } from '../lib/types'
import GameIcon, { type GameIconName } from './GameIcon'
import { FEATURES } from '../lib/featureFlags'
import { ui } from '../lib/i18n'

export type PrimaryDestination = 'home' | 'learn' | 'play' | 'profile'

interface PrimaryNavigationProps {
  language: Language
  active: PrimaryDestination
  onNavigate: (destination: PrimaryDestination) => void
}

export default function PrimaryNavigation({ language, active, onNavigate }: PrimaryNavigationProps) {
  const items: Array<{ id: PrimaryDestination; icon: GameIconName; es: string; en: string }> = [
    { id: 'home', icon: 'home', es: 'Inicio', en: 'Home' },
    ...(FEATURES.academy ? [{ id: 'learn' as const, icon: 'book' as const, es: 'Aprender', en: 'Learn' }] : []),
    { id: 'play', icon: 'play', es: 'Jugar', en: 'Play' },
    { id: 'profile', icon: 'user', es: 'Perfil', en: 'Profile' },
  ]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-0/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md md:hidden"
      aria-label={ui(language).primaryNavigation}
    >
      <div className={`mx-auto grid max-w-md ${FEATURES.academy ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={active === item.id ? 'page' : undefined}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-1 text-[0.65rem] font-semibold transition-colors ${active === item.id ? 'text-quantum' : 'text-ink-muted hover:text-ink'}`}
          >
            <GameIcon name={item.icon} className="h-4.5 w-4.5" />
            <span>{item[language]}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
