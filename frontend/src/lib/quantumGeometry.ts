// Geometría del tablero: conversión de casillas y vectores de movimiento.

// ─── Utilidades de coordenadas ───

export function sq2rc(sq: string): [number, number] {
  return [sq.charCodeAt(0) - 97, parseInt(sq[1]) - 1]
}

export function rc2sq(file: number, rank: number): string | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null
  return String.fromCharCode(97 + file) + (rank + 1)
}

// ─── Direcciones de movimiento ───

export type Dir = [number, number]
export const ROOK_DIRS: Dir[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
export const BISHOP_DIRS: Dir[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
export const QUEEN_DIRS: Dir[] = [...ROOK_DIRS, ...BISHOP_DIRS]
export const KNIGHT_OFFSETS: Dir[] = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
export const KING_OFFSETS: Dir[] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
