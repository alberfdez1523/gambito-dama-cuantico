import { motion } from 'framer-motion'
import { PIECE_GLYPH } from '../lib/constants'
import type { PieceColor, PieceType } from '../lib/types'

interface PieceProps {
  type: PieceType
  color: PieceColor
  animate?: boolean
}

export default function Piece({ type, color, animate = true }: PieceProps) {
  const symbol = PIECE_GLYPH[type]
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
