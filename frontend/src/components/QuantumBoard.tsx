import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Piece from './Piece'
import { FILES, RANKS } from '../lib/constants'
import { getColorName, getPieceName, ui } from '../lib/i18n'
import { useBoardPieceDrag, type DragGhostPiece } from '../hooks/useBoardPieceDrag'
import type { Language, PieceColor, QBoardCell, QMoveMode } from '../lib/types'

interface QuantumBoardProps {
  board: Record<string, QBoardCell[]>
  selectedPiece: { id: string; square: string } | null
  legalTargets: Set<string>
  mergeTargets: Set<string>
  moveMode: QMoveMode
  firstQuantumTarget: string | null
  lastMove: { from: string; to: string } | null
  boardFlipped: boolean
  isThinking: boolean
  playerColor: PieceColor
  onSquareClick: (sq: string) => void
  onDrop: (from: string, to: string) => void
  language: Language
  statusText?: string
}

export default function QuantumBoard({
  board,
  selectedPiece,
  legalTargets,
  mergeTargets,
  moveMode,
  firstQuantumTarget,
  lastMove,
  boardFlipped,
  isThinking,
  playerColor,
  onSquareClick,
  onDrop,
  language,
  statusText,
}: QuantumBoardProps) {
  const [focusedSquare, setFocusedSquare] = useState('e4')
  const [ghostPiece, setGhostPiece] = useState<DragGhostPiece | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef<HTMLDivElement>(null)
  const t = ui(language)
  const reduceMotion = useReducedMotion()

  const { beginPieceDrag, consumeClickSuppression } = useBoardPieceDrag(
    boardRef,
    ghostRef,
    onDrop,
    () => setGhostPiece(null),
  )

  const squares = useMemo(() => {
    const result: { square: string; row: number; col: number; isLight: boolean }[] = []
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const fileIdx = boardFlipped ? 7 - c : c
        const rankIdx = boardFlipped ? r : 7 - r
        const square = `${FILES[fileIdx]}${RANKS[rankIdx]}`
        const isLight = (fileIdx + rankIdx) % 2 !== 0
        result.push({ square, row: r, col: c, isLight })
      }
    }
    return result
  }, [boardFlipped])

  const squareIndex = useMemo(() => {
    const map = new Map<string, { row: number; col: number }>()
    squares.forEach(({ square, row, col }) => map.set(square, { row, col }))
    return map
  }, [squares])

  useEffect(() => {
    if (statusText && liveRef.current) {
      liveRef.current.textContent = statusText
    }
  }, [statusText, lastMove])

  const buildAriaLabel = useCallback((square: string) => {
    const cells = board[square] || []
    const parts: string[] = [square]
    if (cells.length === 0) {
      parts.push(language === 'es' ? 'vacía' : 'empty')
    } else {
      parts.push(
        cells
          .map((c) => `${getColorName(c.color, language)} ${getPieceName(c.type, language)} ${Math.round(c.probability * 100)}%`)
          .join('; '),
      )
    }
    if (selectedPiece?.square === square) parts.push(t.selected)
    if (legalTargets.has(square)) parts.push(t.legalMove)
    if (mergeTargets.has(square)) parts.push(language === 'es' ? 'fusión posible' : 'merge target')
    if (lastMove?.from === square) parts.push(t.lastMoveFrom)
    if (lastMove?.to === square) parts.push(t.lastMoveTo)
    return parts.join(', ')
  }, [board, language, selectedPiece, legalTargets, mergeTargets, lastMove, t])

  const moveFocus = useCallback((square: string) => {
    setFocusedSquare(square)
    document.getElementById(`qsq-${square}`)?.focus()
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, square: string) => {
    const pos = squareIndex.get(square)
    if (!pos) return

    const delta: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }

    if (delta[e.key]) {
      e.preventDefault()
      const [dr, dc] = delta[e.key]
      const target = squares.find((s) => s.row === pos.row + dr && s.col === pos.col + dc)
      if (target) moveFocus(target.square)
      return
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSquareClick(square)
    }
  }, [squareIndex, squares, moveFocus, onSquareClick])

  const handleSquareClick = useCallback((square: string) => {
    if (consumeClickSuppression()) return
    onSquareClick(square)
  }, [consumeClickSuppression, onSquareClick])

  const handlePiecePointerDown = useCallback(
    (sq: string, piece: DragGhostPiece, e: React.PointerEvent) => {
      setGhostPiece(piece)
      beginPieceDrag(sq, e)
    },
    [beginPieceDrag],
  )

  return (
    <div
      ref={boardRef}
      className="board-root relative select-none overflow-hidden rounded-sm shadow-board ring-1 ring-white/[0.06]"
      style={{ width: 'var(--board-size)', height: 'var(--board-size)' }}
    >
      <div ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <div
        role="grid"
        aria-label={t.boardAriaLabel}
        aria-rowcount={8}
        aria-colcount={8}
        className="grid h-full w-full grid-cols-8 grid-rows-8"
      >
        {squares.map(({ square, row, col, isLight }) => {
          const cells = board[square] || []
          const isSelected = selectedPiece?.square === square
          const isLegal = legalTargets.has(square)
          const isMergeTarget = moveMode === 'merge' && mergeTargets.has(square)
          const isFirstQt = firstQuantumTarget === square
          const isLastFrom = lastMove?.from === square
          const isLastTo = lastMove?.to === square
          const hasCapturableEnemy = isLegal && cells.some((c) => c.color !== playerColor)
          const myCell = cells.find((c) => c.color === playerColor)
          const canDrag = !isThinking && !!myCell && moveMode === 'classical'

          const showFile = row === 7
          const showRank = col === 0
          const coordColor = isLight ? 'text-[#B58863]' : 'text-[#F0D9B5]'

          return (
            <button
              key={square}
              id={`qsq-${square}`}
              data-square={square}
              type="button"
              role="gridcell"
              aria-rowindex={row + 1}
              aria-colindex={col + 1}
              aria-label={buildAriaLabel(square)}
              tabIndex={square === focusedSquare ? 0 : -1}
              onFocus={() => setFocusedSquare(square)}
              onKeyDown={(e) => handleKeyDown(e, square)}
              className={`relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/80
                ${isLight ? 'sq-light' : 'sq-dark'}
                ${isSelected ? 'sq-quantum-selected' : ''}
                ${isLastFrom ? 'sq-last-from' : ''}
                ${isLastTo ? 'sq-last-to' : ''}
                ${isFirstQt ? 'sq-quantum-first' : ''}
              `}
              onClick={() => handleSquareClick(square)}
            >
              <AnimatePresence mode="popLayout">
                {cells.map((cell, idx) => {
                  const isQuantum = cell.probability < 1
                  const opacity = cell.probability
                  const zIdx = Math.round(cell.probability * 10)

                  return (
                    <motion.div
                      key={`${square}-${cell.pieceId}`}
                      className={`absolute inset-0 flex items-center justify-center ${isQuantum ? 'quantum-piece-glow' : ''} ${canDrag && cell.pieceId === myCell?.pieceId ? 'pointer-events-auto touch-none' : 'pointer-events-none'}`}
                      style={{
                        opacity: Math.max(0.2, opacity),
                        zIndex: zIdx,
                        transform: cells.length > 1 ? `translate(${idx * 3 - 2}px, ${idx * -3 + 2}px)` : undefined,
                      }}
                      initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: Math.max(0.2, opacity) }}
                      exit={reduceMotion ? undefined : { scale: 0.5, opacity: 0 }}
                      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 20 }}
                    >
                      {canDrag && cell.pieceId === myCell?.pieceId ? (
                        <motion.div
                          className="chess-piece-draggable flex h-full w-full items-center justify-center"
                          onPointerDown={(e) =>
                            handlePiecePointerDown(square, { type: cell.type, color: cell.color }, e)
                          }
                        >
                          <Piece type={cell.type} color={cell.color} animate={!reduceMotion} />
                        </motion.div>
                      ) : (
                        <Piece type={cell.type} color={cell.color} animate={!reduceMotion} />
                      )}
                      {isQuantum && (
                        <span className="quantum-prob-badge">
                          {Math.round(cell.probability * 100)}%
                        </span>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {isLegal && !hasCapturableEnemy && cells.length === 0 && moveMode === 'classical' && (
                <motion.div className="legal-dot pointer-events-none" initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }} />
              )}
              {isLegal && hasCapturableEnemy && moveMode === 'classical' && (
                <motion.div className="legal-ring pointer-events-none absolute inset-0 m-auto" initial={reduceMotion ? false : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} />
              )}
              {isLegal && moveMode === 'quantum' && !isFirstQt && (
                <motion.div className="quantum-dot pointer-events-none" initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }} />
              )}
              {isMergeTarget && (
                <motion.div className="merge-dot pointer-events-none" initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }} />
              )}
              {isLegal && cells.length === 0 && moveMode !== 'classical' && moveMode !== 'merge' && !isFirstQt && (
                <motion.div className="quantum-dot pointer-events-none" initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }} />
              )}

              {showFile && (
                <span className={`board-coord coord-file pointer-events-none ${coordColor}`}>
                  {boardFlipped ? FILES[7 - col] : FILES[col]}
                </span>
              )}
              {showRank && (
                <span className={`board-coord coord-rank pointer-events-none ${coordColor}`}>
                  {boardFlipped ? RANKS[row] : RANKS[7 - row]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <motion.div ref={ghostRef} className="board-drag-ghost" aria-hidden="true">
        {ghostPiece && <Piece type={ghostPiece.type} color={ghostPiece.color} animate={false} />}
      </motion.div>

      <AnimatePresence>
        {isThinking && (
          <motion.div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="rounded bg-surface-0/80 px-4 py-2 text-ui-sm font-medium text-indigo-400 backdrop-blur-sm"
              animate={reduceMotion ? undefined : { opacity: [0.6, 1, 0.6] }}
              transition={reduceMotion ? undefined : { repeat: Infinity, duration: 1.5 }}
            >
              {t.quantumThinking}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
