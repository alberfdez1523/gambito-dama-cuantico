import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { isLegalMoveFromFen } from './onlineRoom'

describe('online room move validation', () => {
  it('accepts one legal move from the server FEN', () => {
    const base = new Chess()
    const next = new Chess(base.fen())
    next.move({ from: 'e2', to: 'e4' })

    expect(isLegalMoveFromFen(base.fen(), next.fen(), { from: 'e2', to: 'e4' })).toBe(true)
  })

  it('rejects a state that does not match the reported last move', () => {
    const base = new Chess()
    const next = new Chess(base.fen())
    next.move({ from: 'd2', to: 'd4' })

    expect(isLegalMoveFromFen(base.fen(), next.fen(), { from: 'e2', to: 'e4' })).toBe(false)
  })

  it('accepts legal promotion targets', () => {
    const baseFen = '8/P7/8/8/8/8/8/4k2K w - - 0 1'
    const next = new Chess(baseFen)
    next.move({ from: 'a7', to: 'a8', promotion: 'q' })

    expect(isLegalMoveFromFen(baseFen, next.fen(), { from: 'a7', to: 'a8' })).toBe(true)
  })
})

describe('secure room identifiers', () => {
  it('generates six-character codes from the unambiguous alphabet', async () => {
    const { generateRoomCode } = await import('./onlineRoom')
    const codes = new Set(Array.from({ length: 200 }, () => generateRoomCode()))
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    expect(codes.size).toBeGreaterThan(190)
  })

  it('generates 128-bit hex measurement seeds', async () => {
    const { randomSeed } = await import('./onlineRoom')
    expect(randomSeed()).toMatch(/^[0-9a-f]{32}$/)
    expect(randomSeed()).not.toBe(randomSeed())
  })
})
