import { useState, useCallback, useRef, useEffect } from 'react'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import Piece from './Piece'
import { getColorName, getPieceName, ui } from '../lib/i18n'
import { useBoardPieceDrag, type DragGhostPiece } from '../hooks/useBoardPieceDrag'
import { useBoardNavigation } from '../hooks/useBoardNavigation'
import type { Language, PieceColor, PieceType } from '../lib/types'

interface BoardProps {
  fen: string
  selectedSquare: string | null
  legalSquares: Set<string>
  lastMove: { from: string; to: string } | null
  boardFlipped: boolean
  isThinking: boolean
  playerColor: PieceColor
  checkSquare: string | null
  getPiece: (sq: string) => { type: PieceType; color: PieceColor } | null
  onSquareClick: (sq: string) => void
  onDrop: (from: string, to: string) => void
  language: Language
  statusText?: string
}

export default function Board({
  fen,
  selectedSquare,
  legalSquares,
  lastMove,
  boardFlipped,
  isThinking,
  playerColor,
  checkSquare,
  getPiece,
  onSquareClick,
  onDrop,
  language,
  statusText,
}: BoardProps) {
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

  const { focusedSquare, setFocusedSquare, squares, handleKeyDown } = useBoardNavigation({
    flipped: boardFlipped,
    idPrefix: 'sq',
    onActivate: onSquareClick,
  })

  useEffect(() => {
    if (!liveRef.current) return
    if (selectedSquare) {
      const selected = getPiece(selectedSquare)
      liveRef.current.textContent = selected
        ? `${getColorName(selected.color, language)} ${getPieceName(selected.type, language)}, ${selectedSquare}, ${t.selected}`
        : `${selectedSquare}, ${t.selected}`
      return
    }
    if (statusText) liveRef.current.textContent = statusText
  }, [checkSquare, getPiece, language, lastMove, selectedSquare, statusText, t])

  const buildAriaLabel = useCallback((square: string) => {
    const piece = getPiece(square)
    const parts: string[] = [square]
    if (piece) {
      parts.push(`${getColorName(piece.color, language)} ${getPieceName(piece.type, language)}`)
    } else {
      parts.push(ui(language).empty)
    }
    if (square === selectedSquare) parts.push(t.selected)
    if (legalSquares.has(square)) parts.push(t.legalMove)
    if (square === checkSquare) parts.push(t.check)
    if (lastMove?.from === square) parts.push(t.lastMoveFrom)
    if (lastMove?.to === square) parts.push(t.lastMoveTo)
    return t.squareLabel(square, parts.slice(1).join(', '), '')
  }, [getPiece, language, selectedSquare, legalSquares, checkSquare, lastMove, t])

  const handleSquareClick = useCallback((square: string) => {
    if (consumeClickSuppression()) return
    onSquareClick(square)
  }, [consumeClickSuppression, onSquareClick])

  const turnColor = fen.includes(' w ') ? 'w' : 'b'
  const handlePiecePointerDown = useCallback(
    (sq: string, piece: DragGhostPiece, e: React.PointerEvent) => {
      setGhostPiece(piece)
      beginPieceDrag(sq, e)
    },
    [beginPieceDrag],
  )

  return (
    <m.div
      ref={boardRef}
      className="board-root relative select-none overflow-hidden rounded-sm shadow-board ring-1 ring-white/[0.06]"
      style={{ width: 'var(--board-size)', height: 'var(--board-size)' }}
    >
      <div
        ref={liveRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      <div
        role="grid"
        aria-label={t.boardAriaLabel}
        aria-rowcount={8}
        aria-colcount={8}
        className="grid h-full w-full grid-cols-8 grid-rows-8"
      >
        {squares.map(({ square, row, col, isLight }) => {
          const piece = getPiece(square)
          const isSelected = square === selectedSquare
          const isLegal = legalSquares.has(square)
          const isLastFrom = lastMove?.from === square
          const isLastTo = lastMove?.to === square
          const isCheck = square === checkSquare
          const canDrag =
            !isThinking &&
            piece !== null &&
            piece.color === playerColor &&
            piece.color === turnColor
          const dragPiece = canDrag && piece ? { type: piece.type, color: piece.color } : null

          const showFile = row === 7
          const showRank = col === 0
          const coordColor = isLight ? 'text-[#B58863]' : 'text-[#F0D9B5]'

          return (
            <button
              key={square}
              id={`sq-${square}`}
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
              className={`relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/80
                ${isLight ? 'sq-light' : 'sq-dark'}
                ${isSelected ? 'sq-selected' : ''}
                ${isLastFrom ? 'sq-last-from' : ''}
                ${isLastTo ? 'sq-last-to' : ''}
                ${isCheck ? 'sq-check' : ''}
              `}
              onPointerDown={dragPiece ? (e) => handlePiecePointerDown(square, dragPiece, e) : undefined}
              onClick={() => handleSquareClick(square)}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {piece && (
                  <m.div
                    key={`${square}-${piece.color}${piece.type}`}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    initial={false}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={undefined}
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 20 }}
                  >
                    <m.div
                      className={canDrag ? 'chess-piece-draggable flex h-full w-full items-center justify-center' : 'flex h-full w-full items-center justify-center'}
                    >
                      <Piece type={piece.type} color={piece.color} animate={false} />
                    </m.div>
                  </m.div>
                )}
              </AnimatePresence>

              {isLegal && !piece && (
                <m.div
                  className="legal-dot pointer-events-none"
                  initial={reduceMotion ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 25 }}
                />
              )}
              {isLegal && piece && (
                <m.div
                  className="legal-ring pointer-events-none absolute inset-0 m-auto"
                  initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 25 }}
                />
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

      <div ref={ghostRef} className="board-drag-ghost" aria-hidden="true">
        {ghostPiece && <Piece type={ghostPiece.type} color={ghostPiece.color} animate={false} />}
      </div>

      <AnimatePresence>
        {isThinking && (
          <m.div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <m.div
              className="rounded-full bg-surface-0/80 px-4 py-2 text-ui-sm font-medium text-accent backdrop-blur-sm"
              animate={reduceMotion ? undefined : { opacity: [0.6, 1, 0.6] }}
              transition={reduceMotion ? undefined : { repeat: Infinity, duration: 1.5 }}
            >
              {t.thinking}
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  )
}
