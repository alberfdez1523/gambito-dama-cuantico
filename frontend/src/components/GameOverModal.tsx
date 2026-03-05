import { motion, AnimatePresence } from 'framer-motion'
import type { GameOverInfo } from '../lib/types'

interface GameOverModalProps {
  info: GameOverInfo | null
  onNewGame: () => void
  onDismiss: () => void
}

const RESULT_ICON: Record<string, string> = {
  win: '🏆',
  lose: '💀',
  draw: '🤝',
}

const RESULT_COLOR: Record<string, string> = {
  win: 'text-accent',
  lose: 'text-red-400',
  draw: 'text-neutral-400',
}

export default function GameOverModal({ info, onNewGame, onDismiss }: GameOverModalProps) {
  return (
    <AnimatePresence>
      {info && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="mx-4 w-full max-w-xs rounded-2xl bg-surface-1 p-8 text-center shadow-2xl ring-1 ring-white/10"
            initial={{ scale: 0.7, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.7, opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
          >
            {/* Ícono */}
            <motion.div
              className="mb-4 text-6xl"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.15 }}
            >
              {RESULT_ICON[info.result] || '♟'}
            </motion.div>

            {/* Título */}
            <h2 className={`mb-2 text-2xl font-extrabold ${RESULT_COLOR[info.result]}`}>
              {info.title}
            </h2>

            {/* Mensaje */}
            <p className="mb-6 text-sm text-neutral-400">{info.message}</p>

            {/* Botones */}
            <div className="flex flex-col gap-2">
              <motion.button
                onClick={onNewGame}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="btn-shine w-full rounded-xl bg-accent py-3 text-sm font-bold text-white
                  shadow-glow transition-colors hover:bg-accent-hover"
              >
                Nueva partida
              </motion.button>
              <motion.button
                onClick={onDismiss}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="w-full rounded-xl bg-surface-2 py-2.5 text-sm font-medium text-neutral-400
                  transition-colors hover:bg-surface-3 hover:text-white"
              >
                Ver tablero
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
