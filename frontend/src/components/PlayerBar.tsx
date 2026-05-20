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
  label, elo, color, isActive, captures, materialDiff, time, isLow,
}: PlayerBarProps) {
  const sortedCaptures = [...captures].sort(
    (a, b) => CAPTURE_ORDER.indexOf(a) - CAPTURE_ORDER.indexOf(b)
  )
  const capturedColor = color === 'w' ? 'b' : 'w'

  return (
    <div
      className="flex items-center gap-2.5 px-1 py-2"
      style={{ width: 'var(--board-size)' }}
    >
      {/* Color indicator */}
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full text-ui-xs
          ${color === 'w' ? 'player-avatar-white' : 'player-avatar-black'}`}
      >
        {color === 'w' ? '♔' : '♚'}
      </div>

      {/* Name + ELO */}
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className={`text-ui-base font-semibold transition-colors ${isActive ? 'text-white' : 'text-neutral-500'}`}>
          {label}
        </span>
        {elo && <span className="font-mono text-ui-xs text-neutral-600">{elo}</span>}
        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
      </div>

      {/* Captures */}
      <div className="flex flex-1 items-center gap-0.5 overflow-hidden">
        {sortedCaptures.map((p, i) => (
          <span
            key={i}
            className={`chess-piece text-ui-sm leading-none opacity-60 ${capturedColor === 'w' ? 'piece-white' : 'piece-black'}`}
          >
            {PIECE_UNICODE[`${capturedColor}${p.toUpperCase()}`] || ''}
          </span>
        ))}
        {materialDiff > 0 && (
          <span className="ml-0.5 font-mono text-ui-xs text-accent">+{materialDiff}</span>
        )}
      </div>

      {/* Timer */}
      {time != null && (
        <span
          className={`font-mono text-ui-base font-semibold tabular-nums
            ${isLow ? 'text-red-400' : isActive ? 'text-white' : 'text-neutral-600'}`}
        >
          {formatTime(time)}
        </span>
      )}
    </div>
  )
}
