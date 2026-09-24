import { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import type { Language } from '../lib/types'
import { ui } from '../lib/i18n'
import { useModalA11y } from '../hooks/useModalA11y'
import GameIcon from './GameIcon'

interface ActionButtonsProps {
  onUndo: () => void
  onFlip: () => void
  onResign: () => void
  canUndo: boolean
  gameOver: boolean
  language: Language
  showUndo?: boolean
  compact?: boolean
}

export default function ActionButtons({
  onUndo,
  onFlip,
  onResign,
  canUndo,
  gameOver,
  language,
  showUndo = true,
  compact = false,
}: ActionButtonsProps) {
  const t = ui(language)
  const [confirmResign, setConfirmResign] = useState(false)
  const { containerRef, onBackdropClick } = useModalA11y(confirmResign, () => setConfirmResign(false), true)
  const titleId = 'resign-confirm-title'

  const handleResignClick = () => {
    if (gameOver) return
    setConfirmResign(true)
  }

  const handleConfirmResign = () => {
    setConfirmResign(false)
    onResign()
  }

  return (
    <>
      <div className={compact ? 'flex w-full items-center justify-around gap-1' : 'flex gap-4'}>
        {showUndo && (
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || gameOver}
            className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 text-ui-sm font-medium text-neutral-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-not-allowed disabled:text-neutral-700 ${compact ? 'min-w-[44px] rounded px-2' : ''}`}
            aria-label={t.undo}
          >
            <GameIcon name="undo" /> <span className={compact ? 'sr-only' : undefined}>{t.undo}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onFlip}
          className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 text-ui-sm font-medium text-neutral-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${compact ? 'min-w-[44px] rounded px-2' : ''}`}
          aria-label={t.flip}
        >
          <GameIcon name="flip" /> <span className={compact ? 'sr-only' : undefined}>{t.flip}</span>
        </button>
        <button
          type="button"
          onClick={handleResignClick}
          disabled={gameOver}
          className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 text-ui-sm font-medium text-red-400/60 transition-colors hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 disabled:cursor-not-allowed disabled:text-neutral-700 ${compact ? 'min-w-[44px] rounded px-2' : ''}`}
          aria-label={t.resign}
        >
          <GameIcon name="flag" /> <span className={compact ? 'sr-only' : undefined}>{t.resign}</span>
        </button>
      </div>

      <AnimatePresence>
        {confirmResign && (
          <m.div
            className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
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
              className="w-full max-w-xs rounded-lg border border-surface-4 bg-surface-1 p-6 text-center"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id={titleId} className="font-serif text-xl text-white">
                {t.resignConfirmTitle}
              </h3>
              <p className="mt-2 text-ui-base text-neutral-500">{t.resignConfirmMessage}</p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleConfirmResign}
                  className="min-h-[44px] rounded border border-red-500/30 bg-red-500/10 py-2.5 text-ui-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20"
                >
                  {t.resignConfirm}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResign(false)}
                  className="min-h-[44px] rounded bg-surface-2 py-2.5 text-ui-sm font-medium text-neutral-500 transition-colors hover:text-white"
                >
                  {t.cancel}
                </button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
