// ─── Tipos principales del juego ───

export type PieceColor = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'master'
export type PlayerColorChoice = 'w' | 'b' | 'random'
export type GameMode = 'classic' | 'quantum'
export type OpponentMode = 'ai' | 'local' | 'online'
export type Language = 'es' | 'en'

export interface OnlineMeta {
  roomId: string
  code: string
  myColor: PieceColor
  isHost: boolean
  userId: string
}

export interface GameConfig {
  playerColor: PieceColor
  difficulty: Difficulty
  opponentMode: OpponentMode
  useTimer: boolean
  timerMinutes: number
  gameMode: GameMode
  /** Presente cuando opponentMode === 'online' */
  online?: OnlineMeta
}

export interface DifficultyMeta {
  key: Difficulty
  label: string
  elo: string
  bars: number
}

export interface MoveInfo {
  color: PieceColor
  from: string
  to: string
  piece: string
  captured?: string
  promotion?: string
  san: string
  flags: string
  description: string
}

export interface CapturedPieces {
  player: PieceType[]
  ai: PieceType[]
}

export interface Chances {
  white: number
  draw: number
  black: number
}

export interface GameOverInfo {
  title: string
  message: string
  result: 'win' | 'lose' | 'draw'
}

export interface APIMoveResponse {
  bestmove: string
  evaluation: number
  mate: number | null
  ponder: string | null
}

// ─── Tipos del modo cuántico ───

/** Pieza cuántica: puede existir en múltiples casillas simultáneamente */
export interface QPiece {
  id: string
  type: PieceType
  color: PieceColor
  /** Mapa casilla → probabilidad. La suma de probabilidades = 1.0 */
  positions: Record<string, number>
  alive: boolean
}

/** Celda visible del tablero cuántico */
export interface QBoardCell {
  pieceId: string
  type: PieceType
  color: PieceColor
  probability: number
}

export type QMoveType = 'classical' | 'quantum' | 'merge' | 'quantumCastle'
export type QMoveMode = 'classical' | 'quantum' | 'merge'

export interface QMeasurementEvent {
  target: 'attacker' | 'defender'
  result: 'alive' | 'dead'
  probability: number
  roll: number
  attackerWasQuantum: boolean
  defenderWasQuantum: boolean
  step: number
  totalSteps: number
  priorStepResult?: {
    target: 'attacker' | 'defender'
    result: 'alive' | 'dead'
  }
}

export interface QMoveRecord {
  pieceId: string
  pieceType: PieceType
  color: PieceColor
  moveType: QMoveType
  from: string
  to: string
  secondTo?: string
  captured?: { id: string; type: PieceType }
  measurement?: QMeasurementEvent
  description: string
}

export interface QGameOver {
  winner: PieceColor
  reason: string
}

export interface QEntanglement {
  id: number
  type: 'castle' | 'tunnel'
  data: QCastleEntData | QTunnelEntData
}

export interface QCastleEntData {
  kingId: string
  rookId: string
  castled: { king: string; rook: string }
  original: { king: string; rook: string }
}

export interface QTunnelEntData {
  tunnelerId: string
  tunnelerOriginal: string
  blockerId: string
  blockerSquare: string
}

export interface QState {
  pieces: Record<string, QPiece>
  turn: PieceColor
  castling: { w: { k: boolean; q: boolean }; b: { k: boolean; q: boolean } }
  history: QMoveRecord[]
  moveNumber: number
  entanglements: QEntanglement[]
  nextEntId: number
  gameOver: QGameOver | null
}
