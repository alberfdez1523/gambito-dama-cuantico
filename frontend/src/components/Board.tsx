import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Piece from './Piece'
import { FILES, RANKS } from '../lib/constants'
import type { PieceColor, PieceType } from '../lib/types'

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
}: BoardProps) {
  const [dragSource, setDragSource] = useState<string | null>(null)

  // Generar las 64 casillas en orden correcto
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardFlipped, fen])

  const handleDragStart = useCallback((sq: string) => {
    setDragSource(sq)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragSource(null)
  }, [])

  return (
    <div
      className="relative select-none overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/5"
      style={{ width: 'var(--board-size)', height: 'var(--board-size)' }}
      onDragEnd={handleDragEnd}
    >
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">
        {squares.map(({ square, row, col, isLight }) => {
          const piece = getPiece(square)
          const isSelected = square === selectedSquare
          const isLegal = legalSquares.has(square)
          const isLastFrom = lastMove?.from === square
          const isLastTo = lastMove?.to === square
          const isCheck = square === checkSquare
          const isDragSource = square === dragSource

          const canDrag =
            !isThinking &&
            piece !== null &&
            piece.color === playerColor &&
            piece.color === (fen.includes(' w ') ? 'w' : 'b')

          // Coordenadas
          const showFile = row === 7 // fila inferior
          const showRank = col === 0 // columna izquierda
          const coordColor = isLight ? 'text-[#B58863]' : 'text-[#F0D9B5]'

          return (
            <div
              key={square}
              className={`relative flex items-center justify-center
                ${isLight ? 'sq-light' : 'sq-dark'}
                ${isSelected ? 'sq-selected' : ''}
                ${isLastFrom ? 'sq-last-from' : ''}
                ${isLastTo ? 'sq-last-to' : ''}
                ${isCheck ? 'sq-check' : ''}
              `}
              onClick={() => onSquareClick(square)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (dragSource) {
                  onDrop(dragSource, square)
                  setDragSource(null)
                }
              }}
            >
              {/* Pieza */}
              <AnimatePresence mode="popLayout">
                {piece && !isDragSource && (
                  <motion.div
                    key={`${square}-${piece.color}${piece.type}`}
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 20 }}
                  >
                    <Piece
                      type={piece.type}
                      color={piece.color}
                      draggable={canDrag}
                      onDragStart={() => handleDragStart(square)}
                      animate={false}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Indicador de movimiento legal */}
              {isLegal && !piece && (
                <motion.div
                  className="legal-dot"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                />
              )}
              {isLegal && piece && (
                <motion.div
                  className="legal-ring absolute inset-0 m-auto"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                />
              )}

              {/* Coordenadas */}
              {showFile && (
                <span className={`board-coord coord-file ${coordColor}`}>
                  {boardFlipped ? FILES[7 - col] : FILES[col]}
                </span>
              )}
              {showRank && (
                <span className={`board-coord coord-rank ${coordColor}`}>
                  {boardFlipped ? RANKS[row] : RANKS[7 - row]}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Overlay de "pensando" */}
      <AnimatePresence>
        {isThinking && (
          <motion.div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="rounded-full bg-surface-0/80 px-4 py-2 text-xs font-medium text-accent backdrop-blur-sm"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              Pensando…
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
