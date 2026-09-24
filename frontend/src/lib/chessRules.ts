import { Chess, type Move, type Square } from 'chess.js'

/**
 * chess.js 1.x lanza excepciones ante jugadas o FEN ilegales. Estos adaptadores
 * conservan el contrato "null si no es válido" que usa la interfaz.
 */
export function tryMove(
  game: Chess,
  move: { from: string; to: string; promotion?: string },
): Move | null {
  try {
    return game.move({ from: move.from as Square, to: move.to as Square, promotion: move.promotion })
  } catch {
    return null
  }
}

export function tryLoad(game: Chess, fen: string): boolean {
  try {
    game.load(fen)
    return true
  } catch {
    return false
  }
}

export function tryLoadPgn(game: Chess, pgn: string): boolean {
  try {
    game.loadPgn(pgn)
    return true
  } catch {
    return false
  }
}

export function asSquare(square: string): Square {
  return square as Square
}
