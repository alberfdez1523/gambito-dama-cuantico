import type { DifficultyMeta, PieceType } from './types'

// ─── Unicode de piezas (con FE0E para presentación de texto) ───
export const PIECE_UNICODE: Record<string, string> = {
  wK: '\u265A\uFE0E', wQ: '\u265B\uFE0E', wR: '\u265C\uFE0E',
  wB: '\u265D\uFE0E', wN: '\u265E\uFE0E', wP: '\u265F\uFE0E',
  bK: '\u265A\uFE0E', bQ: '\u265B\uFE0E', bR: '\u265C\uFE0E',
  bB: '\u265D\uFE0E', bN: '\u265E\uFE0E', bP: '\u265F\uFE0E',
}

// ─── Valor de las piezas (para diferencia de material) ───
export const PIECE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
}

// ─── Nombres de piezas en español ───
export const PIECE_NAMES: Record<string, string> = {
  p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey',
}

// ─── Columnas del tablero ───
export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8']

// ─── Metadatos de dificultad ───
export const DIFFICULTIES: DifficultyMeta[] = [
  { key: 'beginner', label: 'Principiante', elo: '~400', bars: 1 },
  { key: 'easy', label: 'Fácil', elo: '~800', bars: 2 },
  { key: 'medium', label: 'Medio', elo: '~1200', bars: 3 },
  { key: 'hard', label: 'Difícil', elo: '~1800', bars: 4 },
  { key: 'master', label: 'Maestro', elo: '~2500', bars: 5 },
]

// ─── Opciones de tiempo para el reloj ───
export const TIMER_OPTIONS = [3, 5, 10, 15, 30]

// ─── Orden de las piezas para mostrar capturas ───
export const CAPTURE_ORDER: PieceType[] = ['q', 'r', 'b', 'n', 'p']

// ─── Piezas para promoción ───
export const PROMOTION_PIECES: PieceType[] = ['q', 'r', 'b', 'n']
