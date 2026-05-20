import type { GameConfig, GameMode, PieceColor, QMeasurementEvent, QState } from './types'

export interface QPendingMeasurement {
  event: QMeasurementEvent
  /** Jugador que debe girar la ruleta (autor del último movimiento con medición). */
  initiator: PieceColor
}

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
  /** Bloquea al rival hasta que el iniciador cierre la ruleta. */
  pendingMeasurement?: QPendingMeasurement | null
}

export type RoomGameState = ClassicRoomState | QuantumRoomState

/** Huella ligera para comparar estado cuántico sin JSON completo (evita falsos desajustes). */
export function quantumStateFingerprint(q: QState): string {
  const last = q.history[q.history.length - 1]
  const lastKey = last ? `${last.from}-${last.to}-${last.pieceType}` : ''
  return `${q.turn}|${q.moveNumber}|${q.history.length}|${lastKey}|${q.gameOver?.winner ?? ''}`
}

function pendingMeasurementFingerprint(pm: QPendingMeasurement | null | undefined): string {
  if (!pm) return '0'
  const e = pm.event
  return `${pm.initiator}:${e.step}:${e.target}:${e.result}:${Math.round(e.roll * 1000)}`
}

export function quantumRoomFingerprint(room: QuantumRoomState): string {
  return `${quantumStateFingerprint(room.qstate)}|${pendingMeasurementFingerprint(room.pendingMeasurement)}`
}

/** Tras un movimiento local con medición, empaqueta el evento para sincronizar la ruleta. */
export function pendingMeasurementFromLastMove(
  qstate: QState,
  playerColor: PieceColor,
): QPendingMeasurement | null {
  const last = qstate.history[qstate.history.length - 1]
  if (!last?.measurement) return null
  const initiator = qstate.turn === 'w' ? 'b' : 'w'
  if (initiator !== playerColor) return null
  return { event: last.measurement, initiator }
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
