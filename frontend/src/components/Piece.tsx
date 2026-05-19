import { motion } from 'framer-motion'
import type { PieceColor, PieceType } from '../lib/types'

interface PieceProps {
  type: PieceType
  color: PieceColor
  animate?: boolean
}

/** Mismos glifos rellenos para ambos colores; el tono lo da CSS (las blancas huecas de Unicode suelen verse vacías). */
const GLYPHS: Record<PieceType, string> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
}

export default function Piece({ type, color, animate = true }: PieceProps) {
  const symbol = GLYPHS[type]
  const className = `chess-piece ${color === 'w' ? 'piece-white' : 'piece-black'}`

  if (!animate) {
    return (
      <span className={className} aria-hidden="true">
        {symbol}
      </span>
    )
  }

  return (
    <motion.span
      className={className}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18, duration: 0.2 }}
      aria-hidden="true"
    >
      {symbol}
    </motion.span>
  )
}
