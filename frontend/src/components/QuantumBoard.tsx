import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import Piece from './Piece'
import { getColorName, getPieceName, ui } from '../lib/i18n'
import { useBoardPieceDrag, type DragGhostPiece } from '../hooks/useBoardPieceDrag'
import { useBoardNavigation } from '../hooks/useBoardNavigation'
import type { Language, PieceColor, QBoardCell, QEntanglement, QMoveMode } from '../lib/types'

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
  turnColor: PieceColor
  onSquareClick: (sq: string) => void
  onDrop: (from: string, to: string) => void
  language: Language
  statusText?: string
  checkSquare?: string | null
  entanglements?: QEntanglement[]
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
  turnColor,
  onSquareClick,
  onDrop,
  language,
  statusText,
  checkSquare = null,
  entanglements = [],
}: QuantumBoardProps) {
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

  const { focusedSquare, setFocusedSquare, squares, squareIndex, handleKeyDown } = useBoardNavigation({
    flipped: boardFlipped,
    idPrefix: 'qsq',
    onActivate: onSquareClick,
  })

  const entanglementLines = useMemo(() => {
    type EntanglementLine = {
      id: string
      kind: 'tunnel' | 'castle'
      from: { x: number; y: number }
      to: { x: number; y: number }
    }
    const point = (square: string) => {
      const position = squareIndex.get(square)
      if (!position) return null
      return {
        x: (position.col + 0.5) * 12.5,
        y: (position.row + 0.5) * 12.5,
      }
    }
    const lines: EntanglementLine[] = []
    entanglements.forEach((entry) => {
      if (entry.type === 'tunnel') {
        const from = point(entry.data.tunnelerOriginal)
        const to = point(entry.data.blockerSquare)
        if (from && to) lines.push({ id: `tunnel-${entry.id}`, kind: 'tunnel', from, to })
        return
      }
      const castleLines = [
        { id: `castle-king-${entry.id}`, from: point(entry.data.original.king), to: point(entry.data.castled.king) },
        { id: `castle-rook-${entry.id}`, from: point(entry.data.original.rook), to: point(entry.data.castled.rook) },
      ]
      castleLines.forEach((line) => {
        if (line.from && line.to) lines.push({ id: line.id, kind: 'castle', from: line.from, to: line.to })
      })
    })
    return lines
  }, [entanglements, squareIndex])

  useEffect(() => {
    if (!liveRef.current) return
    if (selectedPiece) {
      const selected = (board[selectedPiece.square] ?? []).find((cell) => cell.pieceId === selectedPiece.id)
      const branchCount = Object.values(board).flat().filter((cell) => cell.pieceId === selectedPiece.id).length
      liveRef.current.textContent = selected
        ? `${getColorName(selected.color, language)} ${getPieceName(selected.type, language)}, ${selectedPiece.square}, ${t.selected}, ${branchCount} ${ui(language).branches}`
        : `${selectedPiece.square}, ${t.selected}`
      return
    }
    if (statusText) liveRef.current.textContent = statusText
  }, [board, language, lastMove, selectedPiece, statusText, t])

  const buildAriaLabel = useCallback((square: string) => {
    const cells = board[square] || []
    const parts: string[] = [square]
    if (cells.length === 0) {
      parts.push(ui(language).empty)
    } else {
      parts.push(
        cells
          .map((c) => `${getColorName(c.color, language)} ${getPieceName(c.type, language)} ${Math.round(c.probability * 100)}%`)
          .join('; '),
      )
    }
    if (selectedPiece && cells.some((cell) => cell.pieceId === selectedPiece.id)) parts.push(t.selected)
    if (legalTargets.has(square)) parts.push(t.legalMove)
    if (mergeTargets.has(square)) parts.push(ui(language).mergeTarget)
    if (lastMove?.from === square) parts.push(t.lastMoveFrom)
    if (lastMove?.to === square) parts.push(t.lastMoveTo)
    if (square === checkSquare) parts.push(t.check)
    return parts.join(', ')
  }, [board, language, selectedPiece, legalTargets, mergeTargets, lastMove, checkSquare, t])

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
      data-qmode={moveMode}
      style={{ width: 'var(--board-size)', height: 'var(--board-size)' }}
    >
      <div ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      {entanglementLines.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
          {entanglementLines.map((line) => (
            <line
              key={line.id}
              x1={line.from.x}
              y1={line.from.y}
              x2={line.to.x}
              y2={line.to.y}
              vectorEffect="non-scaling-stroke"
              stroke={line.kind === 'tunnel' ? 'rgb(var(--merge-rgb))' : 'rgb(var(--quantum-rgb))'}
              strokeWidth="1.25"
              strokeDasharray={line.kind === 'tunnel' ? '2.5 3.5' : '5 3'}
              strokeLinecap="round"
              opacity="0.72"
            />
          ))}
        </svg>
      )}

      <div
        role="grid"
        aria-label={t.boardAriaLabel}
        aria-multiselectable="true"
        aria-rowcount={8}
        aria-colcount={8}
        className="grid h-full w-full grid-cols-8 grid-rows-8"
      >
        {squares.map(({ square, row, col, isLight }) => {
          const cells = board[square] || []
          // Highlight every visible branch of the selected quantum piece, not only
          // the square used to begin the action.
          const isSelected = !!selectedPiece && cells.some((cell) => cell.pieceId === selectedPiece.id)
          const isLegal = legalTargets.has(square)
          const isMergeTarget = moveMode === 'merge' && mergeTargets.has(square)
          const isFirstQt = firstQuantumTarget === square
          const isLastFrom = lastMove?.from === square
          const isLastTo = lastMove?.to === square
          const isCheck = square === checkSquare
          const hasCapturableEnemy = isLegal && cells.some((c) => c.color !== playerColor)
          const myCell = cells.find((c) => c.color === playerColor)
          const canDrag = !isThinking && !!myCell && playerColor === turnColor && moveMode === 'classical'
          const dragPiece = canDrag && myCell ? { type: myCell.type, color: myCell.color } : null

          const showFile = row === 7
          const showRank = col === 0
          const coordColor = isLight ? 'text-[#B58863]' : 'text-[#F0D9B5]'

          return (
            <button
              key={square}
              id={`qsq-${square}`}
              data-square={square}
              data-board-row={row}
              data-board-col={col}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
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
                ${isLegal && moveMode === 'quantum' ? 'sq-quantum-target' : ''}
                ${isMergeTarget ? 'sq-merge-target' : ''}
                ${hasCapturableEnemy ? 'sq-quantum-capture' : ''}
                ${isCheck ? 'sq-check' : ''}
              `}
              onPointerDown={dragPiece ? (e) => handlePiecePointerDown(square, dragPiece, e) : undefined}
              onClick={() => handleSquareClick(square)}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {cells.map((cell, idx) => {
                  const isQuantum = cell.probability < 1
                  const opacity = cell.probability
                  const zIdx = Math.round(cell.probability * 10)

                  return (
                    <m.div
                      key={`${square}-${cell.pieceId}`}
                      className={`pointer-events-none absolute inset-0 flex items-center justify-center ${isQuantum ? 'quantum-piece-glow' : ''}`}
                      style={{
                        opacity: Math.max(0.2, opacity),
                        zIndex: zIdx,
                        transform: cells.length > 1 ? `translate(${idx * 3 - 2}px, ${idx * -3 + 2}px)` : undefined,
                      }}
                      initial={false}
                      animate={{ scale: 1, opacity: Math.max(0.2, opacity) }}
                      exit={undefined}
                      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 20 }}
                    >
                      {canDrag && cell.pieceId === myCell?.pieceId ? (
                        <m.div
                          className="chess-piece-draggable flex h-full w-full items-center justify-center"
                        >
                          <Piece type={cell.type} color={cell.color} animate={false} />
                        </m.div>
                      ) : (
                        <Piece type={cell.type} color={cell.color} animate={false} />
                      )}
                      {isQuantum && (
                        <span className="quantum-prob-badge">
                          {Math.round(cell.probability * 100)}%
                        </span>
                      )}
                    </m.div>
                  )
                })}
              </AnimatePresence>

              {isLegal && !hasCapturableEnemy && cells.length === 0 && moveMode === 'classical' && (
                <m.div className="legal-dot pointer-events-none" initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }} />
              )}
              {isLegal && hasCapturableEnemy && moveMode === 'classical' && (
                <m.div className="legal-ring pointer-events-none absolute inset-0 m-auto" initial={reduceMotion ? false : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} />
              )}
              {isLegal && moveMode === 'quantum' && !isFirstQt && (
                <m.div className="quantum-dot pointer-events-none" initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }} />
              )}
              {isFirstQt && (
                <span className="quantum-target-index" aria-hidden>
                  1
                </span>
              )}
              {firstQuantumTarget && isLegal && moveMode === 'quantum' && !isFirstQt && (
                <span className="quantum-target-index" aria-hidden>
                  2
                </span>
              )}
              {isMergeTarget && (
                <m.div className="merge-dot pointer-events-none" initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }} />
              )}
              {isLegal && cells.length === 0 && moveMode !== 'classical' && moveMode !== 'merge' && !isFirstQt && (
                <m.div className="quantum-dot pointer-events-none" initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }} />
              )}

              {showFile && (
                <span className={`board-coord coord-file pointer-events-none ${coordColor}`}>
                  {square[0]}
                </span>
              )}
              {showRank && (
                <span className={`board-coord coord-rank pointer-events-none ${coordColor}`}>
                  {square[1]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <m.div ref={ghostRef} className="board-drag-ghost" aria-hidden="true">
        {ghostPiece && <Piece type={ghostPiece.type} color={ghostPiece.color} animate={false} />}
      </m.div>

      <AnimatePresence>
        {isThinking && (
          <m.div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <m.div
              className="rounded bg-surface-0/80 px-4 py-2 text-ui-sm font-medium text-indigo-400 backdrop-blur-sm"
              animate={reduceMotion ? undefined : { opacity: [0.6, 1, 0.6] }}
              transition={reduceMotion ? undefined : { repeat: Infinity, duration: 1.5 }}
            >
              {t.quantumThinking}
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
