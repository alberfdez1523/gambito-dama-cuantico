import type { MiniSquare } from './types'

export function makeGrid(rows: number, cols: number): MiniSquare[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      isLight: (r + c) % 2 === 0,
    })),
  )
}

export function placeMiniSquare(
  grid: MiniSquare[][],
  row: number,
  col: number,
  patch: Omit<MiniSquare, 'isLight'>,
) {
  grid[row][col] = {
    ...grid[row][col],
    ...patch,
  }
}
