import { AnimatePresence, m } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'
import type { Language } from '../lib/types'
import { ui } from '../lib/i18n'
import { useModalA11y } from '../hooks/useModalA11y'
import GameIcon from './GameIcon'

interface GameMobileStatsSheetProps {
  open: boolean
  onClose: () => void
  language: Language
  title?: string
  children: React.ReactNode
}

export default function GameMobileStatsSheet({
  open,
  onClose,
  language,
  title,
  children,
}: GameMobileStatsSheetProps) {
  const t = ui(language)
  const reduceMotion = useReducedMotion()
  const { containerRef, onBackdropClick } = useModalA11y(open, onClose, true)
  const titleId = 'mobile-stats-sheet-title'

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-[55] flex items-end justify-center bg-black/60 lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onBackdropClick}
          role="presentation"
        >
          <m.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[70dvh] w-full flex-col rounded-t-xl border border-surface-4 bg-surface-1 shadow-2xl"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            initial={reduceMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reduceMotion ? undefined : { y: '100%' }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-surface-4 px-4 py-3">
              <h2 id={titleId} className="text-ui-sm font-semibold text-white">
                {title ?? (language === 'es' ? 'Inspector de partida' : 'Game inspector')}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] rounded px-3 text-ui-sm font-medium text-neutral-500 hover:text-white"
                aria-label={t.cancel}
              >
                <GameIcon name="close" className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-3">
              {children}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
