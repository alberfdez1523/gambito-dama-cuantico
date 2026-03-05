// ─── Tipos principales del juego ───

export type PieceColor = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'master'
export type PlayerColorChoice = 'w' | 'b' | 'random'

export interface GameConfig {
  playerColor: PieceColor
  difficulty: Difficulty
  useTimer: boolean
  timerMinutes: number
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
