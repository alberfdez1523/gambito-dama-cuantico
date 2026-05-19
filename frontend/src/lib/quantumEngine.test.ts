import { describe, it, expect } from 'vitest'
import { QuantumChessEngine } from '../lib/quantumEngine'

describe('QuantumChessEngine', () => {
  it('starts with classical pieces on initial board', () => {
    const engine = new QuantumChessEngine()
    const board = engine.getBoard()
    expect(board['e2']?.some((c) => c.type === 'p' && c.color === 'w')).toBe(true)
    expect(board['e7']?.some((c) => c.type === 'p' && c.color === 'b')).toBe(true)
  })

  it('splits a knight into two squares with quantum move', () => {
    const engine = new QuantumChessEngine()
    engine.state.turn = 'w'
    engine.state.pieces['w_n_b'].positions = { b1: 1 }
    delete engine.state.pieces['w_n_b'].positions.g1

    engine.doQuantumMove('w_n_b', 'b1', 'a3', 'c3')

    const piece = engine.getPiece('w_n_b')
    expect(piece?.positions.a3).toBeCloseTo(0.5, 5)
    expect(piece?.positions.c3).toBeCloseTo(0.5, 5)
    expect(piece?.positions.b1).toBeUndefined()
  })

  it('detects quantum pieces after split', () => {
    const engine = new QuantumChessEngine()
    engine.state.turn = 'w'
    engine.state.pieces['w_n_b'].positions = { b1: 1 }

    engine.doQuantumMove('w_n_b', 'b1', 'a3', 'c3')

    expect(engine.isQuantum('w_n_b')).toBe(true)
    expect(Object.keys(engine.getPiece('w_n_b')?.positions ?? {}).length).toBe(2)
  })

  it('executes classical capture move', () => {
    const engine = new QuantumChessEngine()
    engine.state.turn = 'w'
    engine.state.pieces['w_p_e'].positions = { e4: 1 }
    engine.state.pieces['b_p_d'].positions = { d5: 1 }

    engine.doClassicalMove('w_p_e', 'e4', 'd5')

    expect(engine.getPiece('b_p_d')?.alive).toBe(false)
    expect(engine.getPiece('w_p_e')?.positions.d5).toBe(1)
  })
})
