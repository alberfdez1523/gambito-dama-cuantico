import { m, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'
import { ui } from '../lib/i18n'
import { useModalA11y } from '../hooks/useModalA11y'
import type { Language } from '../lib/types'
import GameIcon from './GameIcon'

interface OnlineSessionEndedModalProps {
  visible: boolean
  onMenu: () => void
  onRetry: () => void
  language: Language
}

export default function OnlineSessionEndedModal({
  visible,
  onMenu,
  onRetry,
  language,
}: OnlineSessionEndedModalProps) {
  const t = ui(language)
  const reduceMotion = useReducedMotion()
  const { containerRef } = useModalA11y(visible, undefined, false)
  const titleId = 'online-session-ended-title'

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <m.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="mx-4 w-full max-w-xs rounded-lg border border-surface-4 bg-surface-1 p-10 text-center"
            initial={reduceMotion ? false : { scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { scale: 0.9, opacity: 0, y: 20 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} className="font-serif text-2xl text-neutral-200">
              {t.onlineOpponentLeftTitle}
            </h2>
            <p className="mt-3 text-sm text-neutral-500">{t.onlineOpponentLeftMessage}</p>
            <p className="mt-2 text-xs text-neutral-600">{t.onlineOpponentLeftHint}</p>
            <div className="rule my-8" />
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-quantum bg-quantum/10 py-3 text-ui-sm font-semibold text-quantum"
            >
              <GameIcon name="retry" />
              {ui(language).tryReconnecting}
            </button>
            <button
              type="button"
              onClick={onMenu}
              className="mt-2 min-h-11 w-full rounded border border-line py-3 text-ui-sm font-semibold text-ink-secondary"
            >
              {t.menu}
            </button>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
