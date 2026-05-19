import { useState } from 'react'
import { motion } from 'framer-motion'
import type { PieceGuideEntry } from './types'
import MiniBoard from './MiniBoard'
import { useMiniSqPx } from './useMiniSqPx'

interface PieceExplorerProps {
  pieces: PieceGuideEntry[]
  es: boolean
}

export default function PieceExplorer({ pieces, es }: PieceExplorerProps) {
  const [activeId, setActiveId] = useState(pieces[0]?.id ?? 'king')
  const active = pieces.find((p) => p.id === activeId) ?? pieces[0]
  const sqPx = useMiniSqPx()

  if (!active) return null

  return (
    <section className="rules-panel" aria-labelledby="piece-explorer-title">
      <h2 id="piece-explorer-title" className="rules-section-title">
        {es ? 'Guía interactiva de piezas' : 'Interactive piece guide'}
      </h2>
      <p className="mb-4 text-ui-sm text-neutral-400">
        {es
          ? 'Toca cada pieza para ver cómo se mueve en el tablero.'
          : 'Tap each piece to see how it moves on the board.'}
      </p>

      <div className="flex flex-wrap gap-2">
        {pieces.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveId(p.id)}
            className={`rules-chip ${activeId === p.id ? 'rules-chip-active' : ''}`}
            aria-pressed={activeId === p.id}
          >
            <span className="text-lg">{p.piece}</span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>

      <motion.div
        key={active.id}
        className="mt-6 flex flex-col items-center gap-4 rounded-lg border border-surface-4 bg-surface-2/50 p-5 sm:flex-row sm:items-start sm:gap-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <MiniBoard squares={active.board} sqPx={sqPx} stepKey={active.id} />
        <div className="max-w-md text-center sm:text-left">
          <h3 className="text-ui-lg font-bold text-white">
            {active.piece} {active.name}
          </h3>
          <p className="mt-1 text-ui-sm font-medium text-accent">{active.short}</p>
          <p className="mt-3 text-ui-sm leading-relaxed text-neutral-400">{active.detail}</p>
          <p className="mt-3 text-ui-xs text-neutral-600">
            <span className="inline-block h-2 w-2 rounded-sm bg-accent/60 align-middle" />{' '}
            {es ? 'Casillas a las que puede ir' : 'Squares it can reach'}
          </p>
        </div>
      </motion.div>
    </section>
  )
}
