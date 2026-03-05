import { motion } from 'framer-motion'
import { PIECE_UNICODE, PIECE_VALUES, CAPTURE_ORDER } from '../lib/constants'
import { formatTime } from '../hooks/useTimer'
import type { PieceColor, PieceType } from '../lib/types'

interface PlayerBarProps {
  label: string
  elo: string
  color: PieceColor
  isActive: boolean
  captures: PieceType[]
  materialDiff: number
  time?: number | null
  isLow?: boolean
}

export default function PlayerBar({
  label,
  elo,
  color,
  isActive,
  captures,
  materialDiff,
  time,
  isLow,
}: PlayerBarProps) {
  // Ordenar las piezas capturadas para mostrar
  const sortedCaptures = [...captures].sort((a, b) => {
    return CAPTURE_ORDER.indexOf(a) - CAPTURE_ORDER.indexOf(b)
  })

  const capturedColor = color === 'w' ? 'b' : 'w'

  return (
    <motion.div
      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-300
        ${isActive ? 'bg-surface-2 ring-1 ring-accent/30' : 'bg-surface-1'}
      `}
      style={{ width: 'var(--board-size)' }}
      animate={isActive ? { boxShadow: '0 0 12px -4px rgba(249,115,22,0.2)' } : { boxShadow: 'none' }}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm
          ${color === 'w' ? 'bg-white text-black' : 'bg-neutral-800 text-white ring-1 ring-neutral-600'}
        `}
      >
        {label === 'Tú' ? '◆' : '⚙'}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{label}</span>
          <span className="text-[10px] font-mono text-neutral-500">{elo}</span>
          {isActive && (
            <motion.div
              className="h-1.5 w-1.5 rounded-full bg-accent"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            />
          )}
        </div>

        {/* Piezas capturadas */}
        <div className="flex items-center gap-0.5 overflow-hidden">
          {sortedCaptures.map((p, i) => (
            <span
              key={i}
              className={`text-xs leading-none ${capturedColor === 'w' ? 'piece-white' : 'piece-black'} opacity-70`}
            >
              {PIECE_UNICODE[`${capturedColor}${p.toUpperCase()}`] || ''}
            </span>
          ))}
          {materialDiff > 0 && (
            <span className="ml-1 text-[10px] font-mono text-accent">+{materialDiff}</span>
          )}
        </div>
      </div>

      {/* Reloj */}
      {time != null && (
        <div
          className={`rounded-md px-2.5 py-1 font-mono text-sm font-semibold
            ${isActive ? 'bg-surface-3 text-white' : 'bg-surface-2 text-neutral-500'}
            ${isLow ? 'text-red-400' : ''}
          `}
        >
          {formatTime(time)}
        </div>
      )}
    </motion.div>
  )
}
