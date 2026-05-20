import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PIECE_UNICODE } from '../lib/constants'
import { translateMoveDescription, ui } from '../lib/i18n'
import type { Language, MoveInfo } from '../lib/types'

interface MoveHistoryProps {
  history: MoveInfo[]
  language: Language
  pgn?: string
  showCopy?: boolean
}

export default function MoveHistory({ history, language, pgn, showCopy = false }: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState<'moves' | 'pgn' | null>(null)
  const t = ui(language)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history.length])

  const copyText = async (text: string, kind: 'moves' | 'pgn') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const movesText = history
    .map((m, i) => {
      const num = Math.floor(i / 2) + 1
      return m.color === 'w' ? `${num}. ${m.san}` : m.san
    })
    .join(' ')

  if (history.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center text-ui-sm text-neutral-600">
        {t.noMovesYet}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {showCopy && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => copyText(movesText, 'moves')}
            className="min-h-[36px] flex-1 rounded border border-surface-4 px-2 py-1 text-ui-xs font-medium text-neutral-500 transition-colors hover:bg-surface-2 hover:text-white"
          >
            {copied === 'moves' ? t.copied : t.copyMoves}
          </button>
          {pgn && (
            <button
              type="button"
              onClick={() => copyText(pgn, 'pgn')}
              className="min-h-[36px] flex-1 rounded border border-surface-4 px-2 py-1 text-ui-xs font-medium text-neutral-500 transition-colors hover:bg-surface-2 hover:text-white"
            >
              {copied === 'pgn' ? t.copied : t.copyPgn}
            </button>
          )}
        </div>
      )}

      <div ref={scrollRef} className="max-h-44 overflow-y-auto">
        <AnimatePresence initial={false}>
          {history.map((move, i) => {
            const icon = PIECE_UNICODE[`${move.color}${move.piece.toUpperCase()}`] || ''
            const isWhite = move.color === 'w'
            const moveNum = Math.floor(i / 2) + 1
            const isLast = i === history.length - 1

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex items-center gap-2 px-1 py-1 text-ui-sm
                  ${isLast ? 'text-accent' : 'text-neutral-500'}
                `}
              >
                {isWhite && (
                  <span className="w-5 text-right font-mono text-ui-xs text-neutral-600">
                    {moveNum}.
                  </span>
                )}
                {!isWhite && <span className="w-5" />}
                <span className={`chess-piece text-sm leading-none ${isWhite ? 'piece-white' : 'piece-black'}`}>
                  {icon}
                </span>
                <span className="truncate">{translateMoveDescription(move.description, language)}</span>
                <span className="ml-auto font-mono text-ui-xs text-neutral-600">{move.san}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
