import { motion, AnimatePresence } from 'framer-motion'
import { PIECE_UNICODE, PROMOTION_PIECES } from '../lib/constants'
import type { PieceColor, PieceType } from '../lib/types'

interface PromotionModalProps {
  visible: boolean
  color: PieceColor
  onSelect: (piece: string) => void
}

const PROMO_LABELS: Record<string, string> = {
  q: 'Dama', r: 'Torre', b: 'Alfil', n: 'Caballo',
}

export default function PromotionModal({ visible, color, onSelect }: PromotionModalProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="rounded-2xl bg-surface-1 p-6 shadow-2xl ring-1 ring-white/10"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <h3 className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Promoción
            </h3>

            <div className="flex gap-3">
              {PROMOTION_PIECES.map((p: PieceType) => (
                <motion.button
                  key={p}
                  onClick={() => onSelect(p)}
                  whileHover={{ scale: 1.1, y: -4 }}
                  whileTap={{ scale: 0.9 }}
                  className="flex flex-col items-center gap-1 rounded-xl bg-surface-2 px-4 py-3
                    transition-colors hover:bg-surface-3 hover:ring-1 hover:ring-accent/40"
                >
                  <span
                    className={`text-4xl leading-none ${color === 'w' ? 'piece-white' : 'piece-black'}`}
                    style={{ fontFamily: "'Noto Sans Symbols 2', sans-serif" }}
                  >
                    {PIECE_UNICODE[`${color}${p.toUpperCase()}`]}
                  </span>
                  <span className="text-[10px] font-medium text-neutral-500">
                    {PROMO_LABELS[p]}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
