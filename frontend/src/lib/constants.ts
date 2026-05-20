import type { DifficultyMeta, PieceType } from './types'

/** Mismos glifos rellenos que el tablero (`Piece.tsx`); el color lo da CSS. */
export const PIECE_GLYPH: Record<PieceType, string> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
}

export function pieceGlyph(_color: string, type: PieceType): string {
  return PIECE_GLYPH[type]
}

/** @deprecated Usar `pieceGlyph` + glifos rellenos del tablero */
export const PIECE_UNICODE: Record<string, string> = {
  wK: PIECE_GLYPH.k,
  wQ: PIECE_GLYPH.q,
  wR: PIECE_GLYPH.r,
  wB: PIECE_GLYPH.b,
  wN: PIECE_GLYPH.n,
  wP: PIECE_GLYPH.p,
  bK: PIECE_GLYPH.k,
  bQ: PIECE_GLYPH.q,
  bR: PIECE_GLYPH.r,
  bB: PIECE_GLYPH.b,
  bN: PIECE_GLYPH.n,
  bP: PIECE_GLYPH.p,
}

// ─── Valor de las piezas (para diferencia de material) ───
export const PIECE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
}

// ─── Columnas del tablero ───
export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8']

// ─── Metadatos de dificultad ───
export const DIFFICULTIES: DifficultyMeta[] = [
  { key: 'beginner', label: 'Principiante', elo: '~800', bars: 1 },
  { key: 'easy', label: 'Fácil', elo: '~1200', bars: 2 },
  { key: 'medium', label: 'Medio', elo: '~1600', bars: 3 },
  { key: 'hard', label: 'Difícil', elo: '~2000', bars: 4 },
  { key: 'master', label: 'Maestro', elo: '~2600', bars: 5 },
]

// ─── Opciones de tiempo para el reloj ───
export const TIMER_OPTIONS = [3, 5, 10, 15, 30]

// ─── Orden de las piezas para mostrar capturas ───
export const CAPTURE_ORDER: PieceType[] = ['q', 'r', 'b', 'n', 'p']

// ─── Piezas para promoción ───
export const PROMOTION_PIECES: PieceType[] = ['q', 'r', 'b', 'n']
