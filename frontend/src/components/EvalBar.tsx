import { motion, useReducedMotion } from 'framer-motion'
import type { Chances, Language, PieceColor } from '../lib/types'
import { ui } from '../lib/i18n'

interface EvalBarProps {
  chances: Chances
  playerColor: PieceColor
  language: Language
  variant?: 'stockfish' | 'quantum-heuristic'
  hidden?: boolean
}

export default function EvalBar({
  chances,
  playerColor,
  language,
  variant = 'stockfish',
  hidden = false,
}: EvalBarProps) {
  const t = ui(language)
  const reduceMotion = useReducedMotion()

  if (hidden) return null

  const playerChance = playerColor === 'w' ? chances.white : chances.black
  const aiChance = playerColor === 'w' ? chances.black : chances.white
  const label = variant === 'quantum-heuristic' ? t.quantumEvalLabel : t.evaluation

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-ui-xs font-medium uppercase tracking-wider text-neutral-500">
        <span>{label}</span>
        <span className="font-mono normal-case text-neutral-400">
          {playerChance > aiChance ? '+' : ''}{playerChance - aiChance}%
        </span>
      </div>

      <div className="flex h-1 w-full overflow-hidden bg-surface-3">
        <motion.div
          className="bg-white"
          initial={{ width: '33%' }}
          animate={{ width: `${chances.white}%` }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
        />
        <motion.div
          className="bg-neutral-500"
          initial={{ width: '34%' }}
          animate={{ width: `${chances.draw}%` }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
        />
        <motion.div
          className="bg-neutral-800"
          initial={{ width: '33%' }}
          animate={{ width: `${chances.black}%` }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      <div className="flex justify-between font-mono text-ui-xs text-neutral-600">
        <span>♔ {chances.white}%</span>
        <span>½ {chances.draw}%</span>
        <span>♚ {chances.black}%</span>
      </div>
    </div>
  )
}
