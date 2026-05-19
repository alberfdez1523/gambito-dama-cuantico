import type { GameConfig, GameMode, PieceColor, QState } from './types'

export type RoomStatus = 'waiting' | 'playing' | 'finished'

export interface ClassicRoomState {
  type: 'classic'
  fen: string
  lastMove?: { from: string; to: string } | null
}

export interface QuantumRoomState {
  type: 'quantum'
  qstate: QState
}

export type RoomGameState = ClassicRoomState | QuantumRoomState

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
