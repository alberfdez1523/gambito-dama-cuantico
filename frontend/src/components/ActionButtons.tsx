import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Language } from '../lib/types'
import { ui } from '../lib/i18n'
import { useModalA11y } from '../hooks/useModalA11y'

interface ActionButtonsProps {
  onUndo: () => void
  onFlip: () => void
  onResign: () => void
  canUndo: boolean
  gameOver: boolean
  language: Language
  showUndo?: boolean
}

export default function ActionButtons({
  onUndo,
  onFlip,
  onResign,
  canUndo,
  gameOver,
  language,
  showUndo = true,
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
      <div className="flex gap-4">
        {showUndo && (
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || gameOver}
            className="min-h-[44px] text-ui-sm font-medium text-neutral-500 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-neutral-700"
          >
            ↩ {t.undo}
          </button>
        )}
        <button
          type="button"
          onClick={onFlip}
          className="min-h-[44px] text-ui-sm font-medium text-neutral-500 transition-colors hover:text-white"
        >
          ⇅ {t.flip}
        </button>
        <button
          type="button"
          onClick={handleResignClick}
          disabled={gameOver}
          className="min-h-[44px] text-ui-sm font-medium text-red-400/60 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:text-neutral-700"
        >
          ⚑ {t.resign}
        </button>
      </div>

      <AnimatePresence>
        {confirmResign && (
          <motion.div
            className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
