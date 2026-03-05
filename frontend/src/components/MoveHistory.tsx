import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PIECE_UNICODE } from '../lib/constants'
import type { MoveInfo } from '../lib/types'

interface MoveHistoryProps {
  history: MoveInfo[]
}

export default function MoveHistory({ history }: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll al último movimiento
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history.length])

  if (history.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg bg-surface-2 text-xs text-neutral-500">
        Sin movimientos aún
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="max-h-44 overflow-y-auto rounded-lg bg-surface-2 p-2 scrollbar-thin"
    >
      <AnimatePresence initial={false}>
        {history.map((move, i) => {
          const icon = PIECE_UNICODE[`${move.color}${move.piece.toUpperCase()}`] || ''
          const isWhite = move.color === 'w'
          const moveNum = Math.floor(i / 2) + 1

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-2 rounded px-2 py-1 text-xs
                ${i === history.length - 1 ? 'bg-accent/10 text-accent-light' : 'text-neutral-400'}
                ${i % 2 === 0 ? '' : 'bg-surface-3/40'}
              `}
            >
              {isWhite && (
                <span className="w-5 text-right font-mono text-[10px] text-neutral-600">
                  {moveNum}.
                </span>
              )}
              {!isWhite && <span className="w-5" />}
              <span className={`text-base leading-none ${isWhite ? 'piece-white' : 'piece-black'}`}>
                {icon}
              </span>
              <span className="truncate">{move.description}</span>
              <span className="ml-auto font-mono text-[10px] text-neutral-600">{move.san}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
