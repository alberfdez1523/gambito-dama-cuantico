import { motion } from 'framer-motion'
import type { Chances, PieceColor } from '../lib/types'

interface EvalBarProps {
  chances: Chances
  playerColor: PieceColor
}

export default function EvalBar({ chances, playerColor }: EvalBarProps) {
  // Mostrar perspectiva del jugador a la derecha
  const playerChance = playerColor === 'w' ? chances.white : chances.black
  const aiChance = playerColor === 'w' ? chances.black : chances.white

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>Evaluación</span>
        <span className="font-mono text-neutral-500">
          {playerChance > aiChance ? '+' : ''}{playerChance - aiChance}%
        </span>
      </div>

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-3">
        {/* Blancas */}
        <motion.div
          className="bg-white"
          initial={{ width: '33%' }}
          animate={{ width: `${chances.white}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        {/* Tablas */}
        <motion.div
          className="bg-neutral-500"
          initial={{ width: '34%' }}
          animate={{ width: `${chances.draw}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        {/* Negras */}
        <motion.div
          className="bg-neutral-800"
          initial={{ width: '33%' }}
          animate={{ width: `${chances.black}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-neutral-500">
        <span>♔ {chances.white}%</span>
        <span>½ {chances.draw}%</span>
        <span>♚ {chances.black}%</span>
      </div>
    </div>
  )
}
