import { motion } from 'framer-motion'
import { PIECE_UNICODE } from '../lib/constants'
import type { PieceColor, PieceType } from '../lib/types'

interface PieceProps {
  type: PieceType
  color: PieceColor
  draggable?: boolean
  onDragStart?: () => void
  animate?: boolean
}

export default function Piece({ type, color, draggable, onDragStart, animate = true }: PieceProps) {
  const key = `${color}${type.toUpperCase()}`
  const symbol = PIECE_UNICODE[key] || ''

  return (
    <motion.span
      className={`chess-piece ${color === 'w' ? 'piece-white' : 'piece-black'}`}
      draggable={draggable}
      onDragStart={(e) => {
        if (onDragStart) onDragStart()
        const dt = (e as unknown as React.DragEvent).dataTransfer
        if (dt) {
          dt.effectAllowed = 'move'
          // Imagen de arrastre transparente
          const img = new Image()
          img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
          dt.setDragImage(img, 0, 0)
        }
      }}
      initial={animate ? { scale: 0.6, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18, duration: 0.2 }}
    >
      {symbol}
    </motion.span>
  )
}
