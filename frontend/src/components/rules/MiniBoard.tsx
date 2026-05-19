import { motion, AnimatePresence } from 'framer-motion'
import type { MiniSquare } from './types'

interface MiniBoardProps {
  squares: MiniSquare[][]
  sqPx?: number
  stepKey?: string
}

export default function MiniBoard({ squares, sqPx = 40, stepKey }: MiniBoardProps) {
  const cols = squares[0]?.length ?? 5

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey ?? 'static'}
        className="mini-board mx-auto"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${sqPx}px)`,
          gridTemplateRows: `repeat(${squares.length}, ${sqPx}px)`,
        }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
      >
        {squares.flat().map((sq, i) => {
          const hlClass =
            sq.highlight === 'selected'
              ? 'mini-sq-highlight'
              : sq.highlight === 'target'
                ? 'mini-sq-highlight'
                : sq.highlight === 'quantum'
                  ? 'mini-sq-quantum'
                  : sq.highlight === 'merge'
                    ? 'mini-sq-merge'
                    : sq.highlight === 'check'
                      ? 'sq-check'
                      : sq.highlight === 'blocked'
                        ? 'mini-sq-blocked'
                        : ''
          return (
            <motion.div
              key={i}
              layout
              className={`mini-sq ${sq.isLight ? 'mini-sq-light' : 'mini-sq-dark'} ${hlClass}`}
              style={{
                width: sqPx,
                height: sqPx,
                fontSize: sqPx * 0.55,
                opacity: sq.opacity ?? 1,
              }}
            >
              {sq.piece && (
                <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
                  {sq.piece}
                </span>
              )}
              {sq.label && (
                <span className="mini-sq-label">{sq.label}</span>
              )}
              {sq.arrowDir && (
                <span
                  className={`mini-sq-arrow ${sq.highlight === 'quantum' ? 'mini-sq-arrow-quantum' : ''}`}
                >
                  {sq.arrowDir}
                </span>
              )}
            </motion.div>
          )
        })}
      </motion.div>
    </AnimatePresence>
  )
}
