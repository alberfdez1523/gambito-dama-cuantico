import type { GameConfig, GameMode, PieceColor, QState } from './types'

export type RoomStatus = 'waiting' | 'playing' | 'finished'

export interface ClassicRoomState {
  type: 'classic'
  fen: string
  lastMove?: { from: string; to: string } | null
  /** PGN completo para reconstruir el historial de jugadas en ambos clientes */
  pgn?: string
}

export interface QuantumRoomState {
  type: 'quantum'
  qstate: QState
}

export type RoomGameState = ClassicRoomState | QuantumRoomState

/** Huella ligera para comparar estado cuántico sin JSON completo (evita falsos desajustes). */
export function quantumStateFingerprint(q: QState): string {
  const last = q.history[q.history.length - 1]
  const lastKey = last ? `${last.from}-${last.to}-${last.pieceType}` : ''
  return `${q.turn}|${q.moveNumber}|${q.history.length}|${lastKey}|${q.gameOver?.winner ?? ''}`
}

export interface OnlineRoomRow {
  id: string
  code: string
  mode: GameMode
  status: RoomStatus
  host_color: PieceColor
  white_player_id: string | null
  black_player_id: string | null
  state: RoomGameState
  version: number
  turn: PieceColor
  config: Partial<GameConfig>
  measurement_seed: string | null
  created_at: string
  updated_at: string
}
