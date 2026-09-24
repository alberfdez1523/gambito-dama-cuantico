import { pieceGlyph, CAPTURE_ORDER } from '../lib/constants'
import { formatTime } from '../hooks/useTimer'
import type { PieceColor, PieceType } from '../lib/types'

interface PlayerBarProps {
  label: string
  elo?: string
  color: PieceColor
  isActive: boolean
  captures: PieceType[]
  materialDiff: number
  time?: number | null
  isLow?: boolean
  turnLabel?: string
  accent?: 'gold' | 'quantum'
  coherence?: { used: number; limit: number; label: string }
}

export default function PlayerBar({
  label, elo = '', color, isActive, captures, materialDiff, time, isLow, turnLabel, accent = 'gold', coherence,
}: PlayerBarProps) {
  const sortedCaptures = [...captures].sort(
    (a, b) => CAPTURE_ORDER.indexOf(a) - CAPTURE_ORDER.indexOf(b)
  )
  const capturedColor = color === 'w' ? 'b' : 'w'

  const activeTone =
    accent === 'quantum'
      ? 'border-indigo-400/45 bg-indigo-500/10 shadow-[0_0_0_1px_rgba(129,140,248,0.12)]'
      : 'border-accent/45 bg-accent/10 shadow-[0_0_0_1px_rgba(200,169,81,0.12)]'
  const activeDot = accent === 'quantum' ? 'bg-indigo-400' : 'bg-accent'
  const activeText = accent === 'quantum' ? 'text-indigo-300' : 'text-accent'

  return (
    <div
      className={`game-playerbar-compact flex items-center gap-2.5 rounded border px-2 py-2 transition-colors max-lg:gap-1.5 max-lg:py-1.5 ${
        isActive ? activeTone : 'border-transparent'
      }`}
      style={{ width: 'var(--board-size)' }}
    >
      {/* Color indicator */}
      <div
        className={`flex h-7 w-7 max-lg:h-6 max-lg:w-6 items-center justify-center rounded-full text-ui-xs
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
        {isActive && <span className={`h-1.5 w-1.5 rounded-full ${activeDot}`} />}
        {isActive && turnLabel && (
          <span className={`rounded-sm border border-current/25 px-1.5 py-0.5 text-ui-xs font-bold uppercase ${activeText}`}>
            {turnLabel}
          </span>
        )}
      </div>

      {/* Captures */}
      <div className="flex flex-1 items-center gap-0.5 overflow-hidden">
        {sortedCaptures.map((p, i) => (
          <span
            key={i}
            className={`chess-piece-inline opacity-60 ${capturedColor === 'w' ? 'piece-white' : 'piece-black'}`}
          >
            {pieceGlyph(capturedColor, p)}
          </span>
        ))}
        {materialDiff > 0 && (
          <span className="ml-0.5 font-mono text-ui-xs text-accent">+{materialDiff}</span>
        )}
      </div>

      {coherence && (
        <div
          className="flex shrink-0 items-center gap-1.5"
          aria-label={`${coherence.label}: ${coherence.used} / ${coherence.limit}`}
          title={`${coherence.label}: ${coherence.used}/${coherence.limit}`}
        >
          <span className="hidden font-mono text-[0.62rem] text-neutral-500 sm:inline">
            {coherence.used}/{coherence.limit}
          </span>
          <span className="flex gap-0.5" aria-hidden="true">
            {Array.from({ length: coherence.limit }, (_, index) => (
              <span
                key={index}
                className={`h-3 w-1.5 border ${index < coherence.used ? 'border-cyan-300 bg-cyan-300' : 'border-surface-4 bg-transparent'}`}
              />
            ))}
          </span>
        </div>
      )}

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
