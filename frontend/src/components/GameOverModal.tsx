import { motion, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'
import { translateGameOverInfo, ui } from '../lib/i18n'
import { useModalA11y } from '../hooks/useModalA11y'
import type { GameOverInfo, Language } from '../lib/types'

interface GameOverModalProps {
  info: GameOverInfo | null
  onNewGame: () => void
  onDismiss: () => void
  language: Language
}

const RESULT_COLOR: Record<string, string> = {
  win: 'text-accent',
  lose: 'text-red-400',
  draw: 'text-neutral-400',
}

export default function GameOverModal({ info, onNewGame, onDismiss, language }: GameOverModalProps) {
  const translatedInfo = info ? translateGameOverInfo(info, language) : null
  const t = ui(language)
  const reduceMotion = useReducedMotion()
  const active = !!translatedInfo
  const { containerRef, onBackdropClick } = useModalA11y(active, onDismiss, true)
  const titleId = 'game-over-title'

  return (
    <AnimatePresence>
      {translatedInfo && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onBackdropClick}
          role="presentation"
        >
          <motion.div
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
            <h2 id={titleId} className={`font-serif text-4xl ${RESULT_COLOR[translatedInfo.result]}`}>
              {translatedInfo.title}
            </h2>
            <p className="mt-3 text-sm text-neutral-500">{translatedInfo.message}</p>

            <div className="rule my-8" />

            <button
              type="button"
              onClick={onNewGame}
              className="min-h-[44px] w-full rounded border-2 border-accent bg-transparent py-3 text-xs font-semibold uppercase tracking-wider text-accent transition-colors hover:bg-accent hover:text-surface-0"
            >
              {t.newGame}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-3 min-h-[44px] w-full rounded bg-surface-2 py-2.5 text-xs font-medium text-neutral-500 transition-colors hover:text-white"
            >
              {t.viewBoard}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
