import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { PROMOTION_PIECES } from '../lib/constants'
import { getPieceName, ui } from '../lib/i18n'
import Piece from './Piece'
import type { Language, PieceColor, PieceType } from '../lib/types'

interface PromotionModalProps {
  visible: boolean
  color: PieceColor
  onSelect: (piece: string) => void
  language: Language
}

export default function PromotionModal({ visible, color, onSelect, language }: PromotionModalProps) {
  const t = ui(language)
  const reduceMotion = useReducedMotion()
  const titleId = 'promotion-modal-title'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <motion.div
            className="rounded-lg border border-surface-4 bg-surface-1 p-6"
            initial={reduceMotion ? false : { scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { scale: 0.9, opacity: 0, y: 16 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <h3 id={titleId} className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
              {t.promotion}
            </h3>

            <div className="flex gap-2">
              {PROMOTION_PIECES.map((p: PieceType) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onSelect(p)}
                  className="flex min-h-[44px] min-w-[44px] flex-col items-center gap-1 rounded border border-surface-4 bg-surface-2 px-4 py-3 transition-colors hover:border-accent/40 hover:bg-surface-3"
                  aria-label={getPieceName(p, language)}
                >
                  <Piece type={p} color={color} animate={false} />
                  <span className="text-[9px] font-medium text-neutral-500">
                    {getPieceName(p, language)}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
