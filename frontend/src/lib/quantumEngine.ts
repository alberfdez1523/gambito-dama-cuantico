// ═══════════════════════════════════════════════════════════════════════
//  Motor de Ajedrez Cuántico
//  Basado en las reglas del Quantum Chess (QuantumFracture / Quantum Realm)
// ═══════════════════════════════════════════════════════════════════════

import type {
  PieceColor, PieceType, QPiece, QBoardCell, QMoveRecord,
  QCastleEntData, QTunnelEntData,
  QState, QGameOver, QMeasurementEvent, QuantumAction, QuantumRng,
  ActionResult, GameResultCause,
} from './types'
import type { CoherenceLimit, RulesetId } from './types'
import {
  actionCoherenceColor,
  getActionCoherenceCost,
  getCoherenceStatus,
  normalizeCoherenceLimit,
  type CoherenceStatus,
  type QuantumRulesConfig,
} from './coherence'

const PROBABILITY_EPSILON = 1e-9
const UINT64_MASK = 0xffffffffffffffffn
const GAME_RESULT_CAUSES = new Set<GameResultCause>([
  'king-captured', 'checkmate', 'draw', 'no-legal-actions', 'timeout', 'resignation', 'agreement',
])

export class QuantumActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuantumActionError'
  }
}

function cloneState(state: QState): QState {
  return structuredClone(state)
}

function isBoardSquare(value: string): boolean {
  return /^[a-h][1-8]$/.test(value)
}

function normalizeLoadedState(next: QState): QState {
  const normalized = cloneState(next)
  if (normalized.rngCounter === undefined) normalized.rngCounter = 0
  if (normalized.gameOver && !normalized.gameOver.cause) {
    normalized.gameOver.cause = normalized.gameOver.winner === null
      ? 'no-legal-actions'
      : 'king-captured'
  }
  for (const record of normalized.history) {
    if (!record.measurements && record.measurement) record.measurements = [record.measurement]
  }
  return normalized
}

/** Valida invariantes persistentes, también para estados recibidos por red. */
export function validateQuantumState(state: QState): void {
  if (!state || typeof state !== 'object') throw new QuantumActionError('Estado cuántico inválido')
  if (state.turn !== 'w' && state.turn !== 'b') throw new QuantumActionError('Turno inválido')
  if (!state.pieces || typeof state.pieces !== 'object') throw new QuantumActionError('Mapa de piezas inválido')
  if (!Array.isArray(state.history)) throw new QuantumActionError('Historial inválido')
  if (!Array.isArray(state.entanglements)) throw new QuantumActionError('Entrelazamientos inválidos')
  if (
    !state.castling ||
    typeof state.castling.w?.k !== 'boolean' ||
    typeof state.castling.w?.q !== 'boolean' ||
    typeof state.castling.b?.k !== 'boolean' ||
    typeof state.castling.b?.q !== 'boolean'
  ) {
    throw new QuantumActionError('Derechos de enroque inválidos')
  }
  if (!Number.isInteger(state.moveNumber) || state.moveNumber < 1) {
    throw new QuantumActionError('Número de movimiento inválido')
  }
  if (!Number.isInteger(state.nextEntId) || state.nextEntId < 1) {
    throw new QuantumActionError('Identificador de entrelazamiento inválido')
  }
  if (!Number.isInteger(state.rngCounter) || state.rngCounter < 0) {
    throw new QuantumActionError('Contador RNG inválido')
  }

  const alliedOccupancy = new Map<string, string>()
  for (const [id, piece] of Object.entries(state.pieces)) {
    if (!piece || piece.id !== id) throw new QuantumActionError(`Pieza inválida: ${id}`)
    if (piece.color !== 'w' && piece.color !== 'b') throw new QuantumActionError(`Color inválido: ${id}`)
    if (!['p', 'n', 'b', 'r', 'q', 'k'].includes(piece.type)) {
      throw new QuantumActionError(`Tipo de pieza inválido: ${id}`)
    }

    const positions = Object.entries(piece.positions)
    if (!piece.alive) {
      if (positions.length > 0) throw new QuantumActionError(`Una pieza capturada conserva posiciones: ${id}`)
      continue
    }
    if (positions.length === 0) throw new QuantumActionError(`Una pieza viva no tiene posición: ${id}`)

    let total = 0
    for (const [square, probability] of positions) {
      if (!isBoardSquare(square)) throw new QuantumActionError(`Casilla inválida: ${square}`)
      if (!Number.isFinite(probability) || probability <= 0 || probability > 1) {
        throw new QuantumActionError(`Probabilidad inválida en ${square}`)
      }
      total += probability

      const occupancyKey = `${piece.color}:${square}`
      const occupyingPiece = alliedOccupancy.get(occupancyKey)
      if (occupyingPiece && occupyingPiece !== id) {
        throw new QuantumActionError(`Dos piezas aliadas distintas coexisten en ${square}`)
      }
      alliedOccupancy.set(occupancyKey, id)
    }
    if (Math.abs(total - 1) > PROBABILITY_EPSILON) {
      throw new QuantumActionError(`La probabilidad de ${id} no suma 1`)
    }
  }

  const entanglementIds = new Set<number>()
  for (const entanglement of state.entanglements) {
    if (!Number.isInteger(entanglement.id) || entanglement.id < 1 || entanglementIds.has(entanglement.id)) {
      throw new QuantumActionError('Identificador de entrelazamiento duplicado o inválido')
    }
    entanglementIds.add(entanglement.id)

    if (entanglement.type === 'castle') {
      const data = entanglement.data
      if (!state.pieces[data.kingId] || !state.pieces[data.rookId]) {
        throw new QuantumActionError('Enroque entrelazado referencia piezas inexistentes')
      }
      const squares = [
        data.castled.king, data.castled.rook, data.original.king, data.original.rook,
      ]
      if (squares.some((square) => !isBoardSquare(square))) {
        throw new QuantumActionError('Enroque entrelazado contiene casillas inválidas')
      }
      continue
    }

    if (entanglement.type === 'tunnel') {
      const data = entanglement.data
      if (!state.pieces[data.tunnelerId] || !state.pieces[data.blockerId]) {
        throw new QuantumActionError('Túnel entrelazado referencia piezas inexistentes')
      }
      if (!isBoardSquare(data.tunnelerOriginal) || !isBoardSquare(data.blockerSquare)) {
        throw new QuantumActionError('Túnel entrelazado contiene casillas inválidas')
      }
      const originOccupiedByAnother = Object.values(state.pieces).some((piece) =>
        piece.alive && piece.id !== data.tunnelerId && piece.positions[data.tunnelerOriginal] !== undefined,
      )
      if (originOccupiedByAnother) {
        throw new QuantumActionError('El origen reservado de un túnel está ocupado')
      }
      continue
    }

    throw new QuantumActionError('Tipo de entrelazamiento inválido')
  }
  if ([...entanglementIds].some((id) => id >= state.nextEntId)) {
    throw new QuantumActionError('El siguiente identificador de entrelazamiento no es monotónico')
  }

  if (state.gameOver !== null) {
    if (
      (state.gameOver.winner !== null && state.gameOver.winner !== 'w' && state.gameOver.winner !== 'b') ||
      !GAME_RESULT_CAUSES.has(state.gameOver.cause) ||
      typeof state.gameOver.reason !== 'string'
    ) {
      throw new QuantumActionError('Resultado terminal inválido')
    }
    if (state.gameOver.cause === 'no-legal-actions' && state.gameOver.winner !== null) {
      throw new QuantumActionError('Las tablas no pueden tener ganador')
    }
    if (state.gameOver.cause === 'king-captured' && state.gameOver.winner === null) {
      throw new QuantumActionError('La captura del rey requiere ganador')
    }
  }

  const whiteKingAlive = state.pieces.w_k?.alive === true
  const blackKingAlive = state.pieces.b_k?.alive === true
  if (!state.gameOver && (!whiteKingAlive || !blackKingAlive)) {
    throw new QuantumActionError('Un rey capturado requiere resultado terminal')
  }
  if (state.gameOver?.cause === 'king-captured') {
    const losingKingAlive = state.gameOver.winner === 'w' ? blackKingAlive : whiteKingAlive
    if (losingKingAlive) throw new QuantumActionError('El resultado no coincide con el rey capturado')
  }
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new QuantumActionError('El estado contiene un número no finito')
    return Object.is(value, -0) ? '0' : JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }
  throw new QuantumActionError('El estado contiene un valor no serializable')
}

export function canonicalizeQuantumState(state: QState): string {
  const canonicalState = {
    ...state,
    history: state.history.map(({ description: _description, ...record }) => record),
    entanglements: [...state.entanglements].sort((left, right) => left.id - right.id),
    gameOver: state.gameOver
      ? { winner: state.gameOver.winner, cause: state.gameOver.cause }
      : null,
  }
  return canonicalJson(canonicalState)
}

/** Huella estable para sincronización; no pretende ser criptográfica. */
export function hashQuantumState(state: QState): string {
  const bytes = new TextEncoder().encode(canonicalizeQuantumState(state))
  let hash = 0xcbf29ce484222325n
  for (const byte of bytes) {
    hash ^= BigInt(byte)
    hash = (hash * 0x100000001b3n) & UINT64_MASK
  }
  return hash.toString(16).padStart(16, '0')
}

/** PRNG Mulberry32 reproducible; `counter` permite reanudar una secuencia. */
export function createSeededQuantumRng(seed: string | number, counter = 0): QuantumRng {
  if (!Number.isInteger(counter) || counter < 0) throw new QuantumActionError('Contador RNG inválido')
  const source = String(seed)
  let state = 0x811c9dc5
  for (let index = 0; index < source.length; index++) {
    state ^= source.charCodeAt(index)
    state = Math.imul(state, 0x01000193)
  }

  const next: QuantumRng = () => {
    state = (state + 0x6d2b79f5) | 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  for (let index = 0; index < counter; index++) next()
  next.checkpoint = () => state
  next.restore = (checkpoint) => {
    if (typeof checkpoint !== 'number' || !Number.isInteger(checkpoint)) {
      throw new QuantumActionError('Checkpoint RNG inválido')
    }
    state = checkpoint
  }
  return next
}

// ─── Utilidades de coordenadas ───

function sq2rc(sq: string): [number, number] {
  return [sq.charCodeAt(0) - 97, parseInt(sq[1]) - 1]
}

function rc2sq(file: number, rank: number): string | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null
  return String.fromCharCode(97 + file) + (rank + 1)
}

// ─── Direcciones de movimiento ───

type Dir = [number, number]
const ROOK_DIRS: Dir[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const BISHOP_DIRS: Dir[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
const QUEEN_DIRS: Dir[] = [...ROOK_DIRS, ...BISHOP_DIRS]
const KNIGHT_OFFSETS: Dir[] = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
const KING_OFFSETS: Dir[] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]

// ─── Etiquetas de piezas (español) ───

const LABELS: Record<string, string> = {
  p: 'Peón', n: 'Caballo', b: 'Alfil', r: 'Torre', q: 'Dama', k: 'Rey',
}

const MERGE_PARTICIPLE: Record<string, string> = {
  p: 'fusionado', n: 'fusionado', b: 'fusionado', r: 'fusionada', q: 'fusionada', k: 'fusionado',
}

// ─── Resultado de generación de movimientos ───

export interface MoveTarget {
  square: string
  isCapture: boolean
  tunnelThrough: string[] // casillas de piezas cuánticas atravesadas
}

interface ClassicalCastleInfo {
  side: 'k' | 'q'
  rookId: string
  rookFrom: string
  rookTo: string
}

// ═══════════════════════════════════════════════════════════════════════
//  Clase principal del motor cuántico
// ═══════════════════════════════════════════════════════════════════════

export class QuantumChessEngine {
  state: QState
  private rng: QuantumRng
  private readonly rulesConfig: QuantumRulesConfig

  constructor(
    rng: QuantumRng = Math.random,
    options: { rulesetId?: RulesetId; maxCoherence?: CoherenceLimit } = {},
  ) {
    this.state = createInitialState()
    this.rng = rng
    this.rulesConfig = {
      rulesetId: options.rulesetId === 'quantum-coherence' ? 'quantum-coherence' : 'quantum-standard',
      maxCoherence: normalizeCoherenceLimit(options.maxCoherence),
    }
  }

  getRulesConfig(): QuantumRulesConfig {
    return { ...this.rulesConfig }
  }

  getCoherence(color: PieceColor): CoherenceStatus {
    return getCoherenceStatus(this.state, color, this.rulesConfig.maxCoherence)
  }

  isActionWithinCoherence(action: QuantumAction): boolean {
    if (this.rulesConfig.rulesetId !== 'quantum-coherence') return true
    const color = actionCoherenceColor(this, action)
    return getActionCoherenceCost(this, action) <= this.getCoherence(color).available
  }

  /** Sustituye la fuente de azar sin alterar el estado; online la deriva de semilla + contador. */
  setRng(rng: QuantumRng): void {
    this.rng = rng
  }

  // ─── Vista del tablero ───

  getBoard(): Record<string, QBoardCell[]> {
    const board: Record<string, QBoardCell[]> = {}
    for (const p of Object.values(this.state.pieces)) {
      if (!p.alive) continue
      for (const [sq, prob] of Object.entries(p.positions)) {
        if (!board[sq]) board[sq] = []
        board[sq].push({ pieceId: p.id, type: p.type, color: p.color, probability: prob })
      }
    }
    return board
  }

  getPiece(id: string): QPiece | null {
    return this.state.pieces[id] ?? null
  }

  isQuantum(id: string): boolean {
    const p = this.state.pieces[id]
    return !!p && Object.keys(p.positions).length > 1
  }

  /** Pieza al 100% en una sola casilla */
  isClassicalPiece(piece: QPiece): boolean {
    const sqs = Object.keys(piece.positions)
    return sqs.length === 1 && (piece.positions[sqs[0]] ?? 0) >= 1
  }

  /** Casilla del rey si está vivo y 100% clásico */
  getClassicalKingSquare(color: PieceColor): string | null {
    const king = this.state.pieces[`${color}_k`]
    if (!king?.alive || !this.isClassicalPiece(king)) return null
    return Object.keys(king.positions)[0]
  }

  /** Casilla atacada solo por piezas enemigas clásicas (100%) */
  isSquareAttackedByClassical(square: string, defenderColor: PieceColor, board?: Record<string, QBoardCell[]>): boolean {
    const b = board ?? this.getBoard()
    const attackerColor: PieceColor = defenderColor === 'w' ? 'b' : 'w'
    for (const p of Object.values(this.state.pieces)) {
      if (!p.alive || p.color !== attackerColor || !this.isClassicalPiece(p)) continue
      const fromSq = Object.keys(p.positions)[0]
      if (this._classicalPieceAttacksSquare(p, fromSq, square, b)) return true
    }
    return false
  }

  /**
   * Compatibilidad con consumidores antiguos. En esta variante no existe
   * jaque: el rey puede entrar en una casilla atacada y sólo pierde al ser
   * capturado.
   */
  isClassicalKingInCheck(_color: PieceColor): boolean {
    return false
  }

  /** Rey del bando al turno en jaque clásico (para UI) */
  getCheckSquareForTurn(): string | null {
    return null
  }

  // ─── Generación de movimientos legales ───

  getLegalMoves(pieceId: string, fromSquare: string): MoveTarget[] {
    if (this.state.gameOver) return []
    const piece = this.state.pieces[pieceId]
    if (!piece || !piece.alive || !(fromSquare in piece.positions)) return []
    if (piece.color !== this.state.turn) return []

    const board = this.getBoard()
    const myColor = piece.color

    let moves: MoveTarget[]
    switch (piece.type) {
      case 'p': moves = this._pawnMoves(piece, fromSquare, board); break
      case 'n': moves = this._jumpMoves(fromSquare, KNIGHT_OFFSETS, myColor, board); break
      case 'b': moves = this._sliderMoves(fromSquare, BISHOP_DIRS, myColor, board, pieceId); break
      case 'r': moves = this._sliderMoves(fromSquare, ROOK_DIRS, myColor, board, pieceId); break
      case 'q': moves = this._sliderMoves(fromSquare, QUEEN_DIRS, myColor, board, pieceId); break
      case 'k': moves = this._kingMoves(piece, fromSquare, board); break
      default: return []
    }
    return moves.filter((move) => !this.state.entanglements.some((entanglement) =>
      entanglement.type === 'tunnel' &&
      entanglement.data.tunnelerOriginal === move.square &&
      entanglement.data.tunnelerId !== pieceId,
    ))
  }

  /** Destinos no capturantes válidos para split; el enroque tiene acción propia. */
  getQuantumSplitTargets(pieceId: string, fromSquare: string): string[] {
    const piece = this.state.pieces[pieceId]
    if (!piece || piece.type === 'p') return []
    if (
      this.rulesConfig.rulesetId === 'quantum-coherence'
      && this.getCoherence(piece.color).available < 1
    ) return []
    return this.getLegalMoves(pieceId, fromSquare)
      .filter((move) => {
        if (move.isCapture) return false
        if (piece.type !== 'k') return true
        return Math.abs(fromSquare.charCodeAt(0) - move.square.charCodeAt(0)) !== 2
      })
      .map((move) => move.square)
  }

  /** Casillas de fusión: reachable desde TODAS las posiciones del quantum piece */
  getMergeTargets(pieceId: string, fromSquare?: string): string[] {
    const piece = this.state.pieces[pieceId]
    if (this.state.gameOver || !piece || !piece.alive || piece.color !== this.state.turn) return []
    const squares = Object.keys(piece.positions)
    if (squares.length < 2) return []

    const origin = fromSquare && piece.positions[fromSquare] !== undefined ? fromSquare : squares[0]
    const board = this.getBoard()
    const orderedSquares = [origin, ...squares.filter((square) => square !== origin)]
    let commonTargets: Set<string> | null = null

    for (const square of orderedSquares) {
      const targets = new Set(
        this.getLegalMoves(pieceId, square)
          .filter((move) => !move.isCapture)
          .map((move) => move.square),
      )
      commonTargets = commonTargets === null
        ? targets
        : new Set(Array.from(commonTargets as Set<string>).filter((target) => targets.has(target)))
      if (commonTargets.size === 0) return []
    }

    // También filtramos: el destino debe estar vacío de piezas enemigas y de otras piezas propias
    return [...(commonTargets ?? [])].filter((target) =>
      (board[target] || []).every((cell) => cell.pieceId === pieceId),
    )
  }

  /** Opciones de enroque cuántico disponibles */
  canQuantumCastle(color: PieceColor): ('k' | 'q')[] {
    const sides: ('k' | 'q')[] = []
    if (this.state.gameOver || color !== this.state.turn) return sides
    if (
      this.rulesConfig.rulesetId === 'quantum-coherence'
      && this.getCoherence(color).available < 2
    ) return sides
    const c = this.state.castling[color]
    const rank = color === 'w' ? '1' : '8'
    const kingId = `${color}_k`
    const king = this.state.pieces[kingId]

    if (!king || !king.alive || Object.keys(king.positions).length !== 1) return []
    if (king.positions[`e${rank}`] !== 1) return []

    const board = this.getBoard()

    if (c.k) {
      const rookId = `${color}_r_h`
      const rook = this.state.pieces[rookId]
      if (rook?.alive && Object.keys(rook.positions).length === 1 && rook.positions[`h${rank}`] === 1) {
        const f = board[`f${rank}`] || []
        const g = board[`g${rank}`] || []
        const pathClear = f.length === 0 && g.length === 0
        if (pathClear) sides.push('k')
      }
    }

    if (c.q) {
      const rookId = `${color}_r_a`
      const rook = this.state.pieces[rookId]
      if (rook?.alive && Object.keys(rook.positions).length === 1 && rook.positions[`a${rank}`] === 1) {
        const b = board[`b${rank}`] || []
        const c2 = board[`c${rank}`] || []
        const d = board[`d${rank}`] || []
        const pathClear = b.length === 0 && c2.length === 0 && d.length === 0
        if (pathClear) sides.push('q')
      }
    }

    return sides
  }

  // ─── Ejecución de movimientos ───

  /** Punto único de mutación validada para toda acción cuántica. */
  applyAction(action: QuantumAction, rng: QuantumRng = this.rng): ActionResult {
    const previousState = this.exportState()
    const previousRng = this.rng
    const rngCounterStart = previousState.rngCounter
    const hasRngCheckpoint = typeof rng.checkpoint === 'function' && typeof rng.restore === 'function'
    const rngCheckpoint = hasRngCheckpoint ? rng.checkpoint?.() : undefined

    try {
      validateQuantumState(previousState)
      this.rng = rng
      this._assertActionLegal(action)

      let record: QMoveRecord
      switch (action.kind) {
        case 'classical':
          record = this._doClassicalMove(action.pieceId, action.from, action.to, action.promotion)
          break
        case 'quantum':
          record = this._doQuantumMove(action.pieceId, action.from, action.toA, action.toB)
          break
        case 'merge':
          record = this._doMergeFrom(action.pieceId, action.from, action.to)
          break
        case 'quantumCastle':
          record = this._doQuantumCastle(action.color, action.side)
          break
        default: {
          const exhaustive: never = action
          throw new QuantumActionError(`Acción cuántica desconocida: ${String(exhaustive)}`)
        }
      }

      this._refreshTerminalState()
      if (this.rulesConfig.rulesetId === 'quantum-coherence') {
        for (const color of ['w', 'b'] as PieceColor[]) {
          if (this.getCoherence(color).used > this.rulesConfig.maxCoherence) {
            throw new QuantumActionError('La acción supera la capacidad de coherencia')
          }
        }
      }
      validateQuantumState(this.state)
      const nextState = this.exportState()
      const events = record.measurements ?? (record.measurement ? [record.measurement] : [])

      return {
        state: nextState,
        record: structuredClone(record),
        measurementTrace: {
          events: structuredClone(events),
          rngCounterStart,
          rngCounterEnd: nextState.rngCounter,
        },
        gameResult: nextState.gameOver ? structuredClone(nextState.gameOver) : null,
        stateHash: hashQuantumState(nextState),
      }
    } catch (error) {
      this.state = previousState
      if (hasRngCheckpoint) rng.restore?.(rngCheckpoint)
      if (error instanceof QuantumActionError) throw error
      throw new QuantumActionError(error instanceof Error ? error.message : 'Acción cuántica inválida')
    } finally {
      this.rng = previousRng
    }
  }

  /** API histórica: delega en `applyAction` y conserva el retorno anterior. */
  doClassicalMove(pieceId: string, from: string, to: string, promotion?: PieceType): QMoveRecord {
    return this.applyAction({ kind: 'classical', pieceId, from, to, promotion }).record
  }

  /** API histórica: delega en `applyAction` y conserva el retorno anterior. */
  doQuantumMove(pieceId: string, from: string, toA: string, toB: string): QMoveRecord {
    return this.applyAction({ kind: 'quantum', pieceId, from, toA, toB }).record
  }

  /** API histórica: fusiona todas las ramas de la pieza en un destino común. */
  doMerge(pieceId: string, to: string): QMoveRecord {
    const piece = this.state.pieces[pieceId]
    const from = Object.keys(piece?.positions ?? {})[0]
    if (!from) throw new QuantumActionError('No hay estados para fusionar')
    return this.doMergeFrom(pieceId, from, to)
  }

  /** API histórica: delega en `applyAction` y conserva el retorno anterior. */
  doMergeFrom(pieceId: string, from: string, to: string): QMoveRecord {
    return this.applyAction({ kind: 'merge', pieceId, from, to }).record
  }

  /** API histórica: delega en `applyAction` y conserva el retorno anterior. */
  doQuantumCastle(color: PieceColor, side: 'k' | 'q'): QMoveRecord {
    return this.applyAction({ kind: 'quantumCastle', color, side }).record
  }

  private _doClassicalMove(pieceId: string, from: string, to: string, promotion?: PieceType): QMoveRecord {
    if (this.state.gameOver) throw new Error('La partida ha terminado')
    const piece = this.state.pieces[pieceId]
    const legalMoves = this.getLegalMoves(pieceId, from)
    const moveInfo = legalMoves.find(m => m.square === to)
    if (!moveInfo) throw new Error('Movimiento ilegal')

    const board = this.getBoard()
    const castleSide = to === 'g1' || to === 'g8' ? 'k' : to === 'c1' || to === 'c8' ? 'q' : null
    const castleInfo = piece.type === 'k' && castleSide
      ? this._getClassicalCastleInfo(piece.color, from, castleSide, board)
      : null
    const isClassicalCastle = piece.type === 'k' && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2 && !!castleInfo
    const prob = piece.positions[from]
    const targetCells = board[to] || []
    const enemies = targetCells.filter(c => c.color !== piece.color)
    const attemptedPawnCapture = piece.type === 'p' && from[0] !== to[0]

    let captured: { id: string; type: PieceType } | undefined
    let measurement: QMeasurementEvent | undefined
    let attackerMeasurement: QMeasurementEvent | undefined
    const measurements: QMeasurementEvent[] = []
    let staysOnOrigin = false

    // ¿La pieza que mueve es cuántica?
    const attackerIsQuantum = prob < 1

    if (enemies.length > 0) {
      const defender = enemies[0]
      const defenderIsQuantum = defender.probability < 1

      if (attackerIsQuantum) {
        // Medir atacante primero
        const roll = this._nextRandom()
        const alive = roll < prob
        if (!alive) {
          // Atacante no existe → pierde turno, colapsa en otra casilla
          measurement = {
            target: 'attacker',
            result: 'dead',
            probability: prob,
            roll,
            attackerWasQuantum: true,
            defenderWasQuantum: defenderIsQuantum,
            step: 1,
            totalSteps: 1,
          }
          measurements.push(measurement)
          this._collapsePieceAway(pieceId, from)
          this._resolveEntanglementsFor(pieceId)
          const desc = `⚡ ${LABELS[piece.type]} mide en ${to} → NO existe`
          const record: QMoveRecord = {
            pieceId, pieceType: piece.type, color: piece.color,
            moveType: 'classical', from, to, measurement, measurements, description: desc,
          }
          this.state.history.push(record)
          this._endTurn()
          return record
        }
        // Atacante existe → colapsa a 100% en from, luego captura
        attackerMeasurement = {
          target: 'attacker',
          result: 'alive',
          probability: prob,
          roll,
          attackerWasQuantum: true,
            defenderWasQuantum: defenderIsQuantum,
          step: 1,
          totalSteps: defenderIsQuantum ? 2 : 1,
        }
        measurements.push(attackerMeasurement)
        measurement = attackerMeasurement
        this._collapsePieceTo(pieceId, from)
        this._resolveEntanglementsFor(pieceId)
      }

      if (defenderIsQuantum && (!attackerIsQuantum || measurement?.result === 'alive')) {
        // Medir defensor
        const defRoll = this._nextRandom()
        const defAlive = defRoll < defender.probability
        if (!defAlive) {
          // Defensor no existe → movimiento normal (casilla vacía), defensor colapsa en otra casilla
          measurement = {
            target: 'defender',
            result: 'dead',
            probability: defender.probability,
            roll: defRoll,
            attackerWasQuantum: attackerIsQuantum,
            defenderWasQuantum: true,
            step: attackerIsQuantum ? 2 : 1,
            totalSteps: attackerIsQuantum ? 2 : 1,
            priorStepResult: attackerMeasurement
              ? { target: attackerMeasurement.target, result: attackerMeasurement.result }
              : undefined,
          }
          measurements.push(measurement)
          this._collapsePieceAway(defender.pieceId, to)
          this._resolveEntanglementsFor(defender.pieceId)
          staysOnOrigin = attemptedPawnCapture
        } else {
          // Defensor existe → captura
          measurement = {
            target: 'defender',
            result: 'alive',
            probability: defender.probability,
            roll: defRoll,
            attackerWasQuantum: attackerIsQuantum,
            defenderWasQuantum: true,
            step: attackerIsQuantum ? 2 : 1,
            totalSteps: attackerIsQuantum ? 2 : 1,
            priorStepResult: attackerMeasurement
              ? { target: attackerMeasurement.target, result: attackerMeasurement.result }
              : undefined,
          }
          measurements.push(measurement)
          captured = { id: defender.pieceId, type: defender.type }
          this._killPiece(defender.pieceId)
          this._resolveEntanglementsFor(defender.pieceId, to)
        }
      } else if (!defenderIsQuantum) {
        // Captura estándar de pieza clásica
        captured = { id: defender.pieceId, type: defender.type }
        this._killPiece(defender.pieceId)
      }
    }

    // Mover la pieza
    const prevPositions = { ...piece.positions }
    if (!staysOnOrigin) {
      delete piece.positions[from]
      piece.positions[to] = attackerIsQuantum && measurement?.result === 'alive' ? 1 : (prevPositions[from] ?? 1)
    }

    if (isClassicalCastle && castleInfo) {
      const rook = this.state.pieces[castleInfo.rookId]
      if (!rook) throw new Error('Torre no disponible para enroque clásico')
      delete rook.positions[castleInfo.rookFrom]
      rook.positions[castleInfo.rookTo] = 1
    }

    // Si todas las probabilidades restantes están en un solo lugar → la pieza ya es 100%
    const sqs = Object.keys(piece.positions)
    if (sqs.length === 1) piece.positions[sqs[0]] = 1

    // Crear entrelazamientos de túnel
    if (!staysOnOrigin && moveInfo && moveInfo.tunnelThrough.length > 0) {
      for (const tunnelSq of moveInfo.tunnelThrough) {
        const blockerCells = board[tunnelSq]?.filter(c => c.probability < 1) ?? []
        for (const blocker of blockerCells) {
          this.state.entanglements.push({
            id: this.state.nextEntId++,
            type: 'tunnel',
            data: {
              tunnelerId: pieceId,
              tunnelerOriginal: from,
              blockerId: blocker.pieceId,
              blockerSquare: tunnelSq,
            } as QTunnelEntData,
          })
        }
      }
    }

    // Promoción de peón
    if (!staysOnOrigin && promotion && piece.type === 'p') {
      const destRank = to[1]
      if ((piece.color === 'w' && destRank === '8') || (piece.color === 'b' && destRank === '1')) {
        piece.type = promotion
      }
    }

    // Derechos de enroque
    this._updateCastlingRights(pieceId, from, to)

    // Descripción
    let desc = ''
    if (isClassicalCastle && castleInfo) {
      desc = castleInfo.side === 'k' ? 'Enroque corto' : 'Enroque largo'
    } else if (captured) {
      desc = `${LABELS[piece.type]} captura en ${to}`
    } else if (staysOnOrigin) {
      desc = `${LABELS[piece.type]} intenta capturar en ${to}, pero permanece en ${from}`
    } else {
      desc = `${LABELS[piece.type]} a ${to}`
    }
    if (measurement) {
      const icon = measurement.result === 'alive' ? '✓' : '✗'
      const stepLabel = measurement.totalSteps > 1 ? ` ${measurement.step}/${measurement.totalSteps}` : ''
      desc = `⚡ ${desc} (${measurement.target === 'attacker' ? 'atac.' : 'def.'}${stepLabel}: ${icon})`
    }

    const record: QMoveRecord = {
      pieceId, pieceType: piece.type, color: piece.color,
      moveType: 'classical', from, to: staysOnOrigin ? from : to, captured, measurement,
      measurements: measurements.length > 0 ? measurements : undefined, description: desc,
    }
    this.state.history.push(record)
    this._checkGameOver()
    if (!this.state.gameOver) this._endTurn()
    return record
  }

  private _cachedMoves: MoveTarget[] | null = null

  private _doQuantumMove(pieceId: string, from: string, toA: string, toB: string): QMoveRecord {
    if (this.state.gameOver) throw new Error('La partida ha terminado')
    const piece = this.state.pieces[pieceId]
    if (piece.type === 'p') throw new Error('Los peones no pueden hacer movimientos cuánticos')

    const prob = piece.positions[from]
    const halfProb = prob / 2

    // Quitar de la casilla actual
    delete piece.positions[from]
    // Añadir a las dos casillas destino
    piece.positions[toA] = (piece.positions[toA] ?? 0) + halfProb
    piece.positions[toB] = (piece.positions[toB] ?? 0) + halfProb
    this._updateCastlingRights(pieceId, from, toA)

    const desc = `${LABELS[piece.type]} → ${toA} | ${toB} (${Math.round(halfProb * 100)}%/${Math.round(halfProb * 100)}%)`

    const record: QMoveRecord = {
      pieceId, pieceType: piece.type, color: piece.color,
      moveType: 'quantum', from, to: toA, secondTo: toB, description: desc,
    }
    this.state.history.push(record)
    this._endTurn()
    return record
  }

  private _doMergeFrom(pieceId: string, from: string, to: string): QMoveRecord {
    if (this.state.gameOver) throw new Error('La partida ha terminado')
    const piece = this.state.pieces[pieceId]
    if (!piece || !piece.alive || piece.positions[from] === undefined) {
      throw new Error('Estado cuántico inválido para fusión')
    }

    const legalTargets = new Set(this.getMergeTargets(pieceId, from))
    if (!legalTargets.has(to)) throw new Error('Fusión inválida')

    piece.positions = { [to]: 1 }

    // Limpiar entrelazamientos asociados
    this.state.entanglements = this.state.entanglements.filter(e => {
      if (e.type === 'tunnel') {
        const d = e.data as QTunnelEntData
        return d.tunnelerId !== pieceId && d.blockerId !== pieceId
      }
      if (e.type === 'castle') {
        const d = e.data as QCastleEntData
        return d.kingId !== pieceId && d.rookId !== pieceId
      }
      return true
    })

    const desc = `${LABELS[piece.type]} ${MERGE_PARTICIPLE[piece.type]} en ${to} (${Math.round((piece.positions[to] ?? 0) * 100)}%)`
    const record: QMoveRecord = {
      pieceId, pieceType: piece.type, color: piece.color,
      moveType: 'merge', from, to, description: desc,
    }
    this.state.history.push(record)
    this._endTurn()
    return record
  }

  private _doQuantumCastle(color: PieceColor, side: 'k' | 'q'): QMoveRecord {
    if (this.state.gameOver) throw new Error('La partida ha terminado')
    const rank = color === 'w' ? '1' : '8'
    const kingId = `${color}_k`
    const rookId = side === 'k' ? `${color}_r_h` : `${color}_r_a`
    const king = this.state.pieces[kingId]
    const rook = this.state.pieces[rookId]

    let castledKing: string, castledRook: string
    if (side === 'k') {
      castledKing = `g${rank}`
      castledRook = `f${rank}`
    } else {
      castledKing = `c${rank}`
      castledRook = `d${rank}`
    }

    const origKing = `e${rank}`
    const origRook = side === 'k' ? `h${rank}` : `a${rank}`

    // Poner ambas piezas en superposición 50/50
    king.positions = { [origKing]: 0.5, [castledKing]: 0.5 }
    rook.positions = { [origRook]: 0.5, [castledRook]: 0.5 }

    // Crear entrelazamiento
    this.state.entanglements.push({
      id: this.state.nextEntId++,
      type: 'castle',
      data: {
        kingId,
        rookId,
        castled: { king: castledKing, rook: castledRook },
        original: { king: origKing, rook: origRook },
      } as QCastleEntData,
    })

    // Invalidar derechos de enroque
    this.state.castling[color] = { k: false, q: false }

    const sideName = side === 'k' ? 'corto' : 'largo'
    const desc = `Enroque cuántico ${sideName} (50%/50%)`
    const record: QMoveRecord = {
      pieceId: kingId, pieceType: 'k', color,
      moveType: 'quantumCastle', from: origKing, to: castledKing, description: desc,
    }
    this.state.history.push(record)
    this._endTurn()
    return record
  }

  // ─── Generación de tableros clásicos (para Stockfish) ───

  generateClassicalBoards(): { fen: string; probability: number; pieceMap: Record<string, string> }[] {
    const pieces = Object.values(this.state.pieces).filter(p => p.alive)
    const classical: QPiece[] = []
    const quantum: QPiece[] = []

    for (const p of pieces) {
      const sqs = Object.keys(p.positions)
      if (sqs.length === 1 && p.positions[sqs[0]] >= 1) {
        classical.push(p)
      } else {
        quantum.push(p)
      }
    }

    if (quantum.length === 0) {
      // Todo clásico: un solo tablero
      const placement: Record<string, QPiece> = {}
      for (const p of classical) placement[Object.keys(p.positions)[0]] = p
      return [{ fen: this._buildFen(placement), probability: 1, pieceMap: this._buildPieceMap(placement) }]
    }

    // Generar combinaciones (Cartesian product)
    const optionsList: Array<Array<{ piece: QPiece; square: string; prob: number }>> = []
    for (const p of quantum) {
      const opts = Object.entries(p.positions).map(([sq, prob]) => ({ piece: p, square: sq, prob }))
      optionsList.push(opts)
    }

    const boards: { fen: string; probability: number; pieceMap: Record<string, string> }[] = []
    const MAX_BOARDS = 128

    const generate = (idx: number, chosen: Array<{ piece: QPiece; square: string; prob: number }>, accProb: number) => {
      if (boards.length >= MAX_BOARDS) return
      if (idx === optionsList.length) {
        // Verificar que no haya dos piezas en la misma casilla
        const placement: Record<string, QPiece> = {}

        for (const p of classical) {
          const sq = Object.keys(p.positions)[0]
          if (placement[sq]) return // conflicto
          placement[sq] = p
        }
        for (const item of chosen) {
          if (placement[item.square]) return // conflicto
          placement[item.square] = item.piece
        }

        boards.push({
          fen: this._buildFen(placement),
          probability: accProb,
          pieceMap: this._buildPieceMap(placement),
        })
        return
      }
      for (const opt of optionsList[idx]) {
        generate(idx + 1, [...chosen, opt], accProb * opt.prob)
      }
    }

    generate(0, [], 1)

    // Normalizar probabilidades
    const total = boards.reduce((s, b) => s + b.probability, 0)
    if (total > 0) {
      for (const b of boards) b.probability /= total
    }

    return boards
  }

  // ─── Serialización para el backend ───

  toPayload(): object {
    const pieces = Object.values(this.state.pieces)
      .filter(p => p.alive)
      .map(p => ({
        id: p.id,
        type: p.type,
        color: p.color,
        squares: Object.entries(p.positions).map(([sq, prob]) => ({ square: sq, probability: prob })),
      }))

    return {
      pieces,
      turn: this.state.turn,
      castling: this.state.castling,
    }
  }

  // ─── Detección de fin de partida ───

  checkGameOverPublic(): QGameOver | null {
    this._refreshTerminalState()
    return this.state.gameOver
  }

  /** Snapshot para sincronización multijugador */
  exportState(): QState {
    return cloneState(this.state)
  }

  /** Restaura estado remoto (multijugador) */
  loadState(next: QState): void {
    const normalized = normalizeLoadedState(next)
    validateQuantumState(normalized)
    if (this.rulesConfig.rulesetId === 'quantum-coherence') {
      for (const color of ['w', 'b'] as PieceColor[]) {
        if (getCoherenceStatus(normalized, color, this.rulesConfig.maxCoherence).used > this.rulesConfig.maxCoherence) {
          throw new QuantumActionError('El estado supera la capacidad de coherencia')
        }
      }
    }
    this.state = normalized
  }

  private _assertActionLegal(action: QuantumAction): void {
    if (this.state.gameOver) throw new QuantumActionError('La partida ha terminado')
    if (!action || typeof action !== 'object') throw new QuantumActionError('Acción cuántica inválida')

    if (action.kind === 'quantumCastle') {
      if ((action.color !== 'w' && action.color !== 'b') || (action.side !== 'k' && action.side !== 'q')) {
        throw new QuantumActionError('Enroque cuántico inválido')
      }
      if (!this.canQuantumCastle(action.color).includes(action.side)) {
        throw new QuantumActionError('Enroque cuántico no disponible')
      }
      this._assertCoherenceAvailable(action)
      return
    }

    if (!isBoardSquare(action.from)) throw new QuantumActionError('Casilla de origen inválida')
    const piece = this.state.pieces[action.pieceId]
    if (!piece || !piece.alive) throw new QuantumActionError('Pieza no disponible')
    if (piece.color !== this.state.turn) throw new QuantumActionError('La pieza no pertenece al turno actual')
    if (piece.positions[action.from] === undefined) throw new QuantumActionError('La pieza no ocupa el origen')

    if (action.kind === 'classical') {
      if (!isBoardSquare(action.to)) throw new QuantumActionError('Casilla de destino inválida')
      if (!this.getLegalMoves(action.pieceId, action.from).some((move) => move.square === action.to)) {
        throw new QuantumActionError('Movimiento ilegal')
      }
      const isPromotion = piece.type === 'p' && (
        (piece.color === 'w' && action.to[1] === '8') ||
        (piece.color === 'b' && action.to[1] === '1')
      )
      const validPromotions: PieceType[] = ['q', 'r', 'b', 'n']
      if (isPromotion && (!action.promotion || !validPromotions.includes(action.promotion))) {
        throw new QuantumActionError('La promoción requiere dama, torre, alfil o caballo')
      }
      if (!isPromotion && action.promotion !== undefined) {
        throw new QuantumActionError('Promoción fuera de la última fila')
      }
      this._assertCoherenceAvailable(action)
      return
    }

    if (action.kind === 'quantum') {
      if (piece.type === 'p') throw new QuantumActionError('Los peones no pueden hacer movimientos cuánticos')
      if (!isBoardSquare(action.toA) || !isBoardSquare(action.toB) || action.toA === action.toB) {
        throw new QuantumActionError('Un split necesita dos destinos distintos y válidos')
      }
      const legalNonCaptures = new Set(this.getQuantumSplitTargets(action.pieceId, action.from))
      if (!legalNonCaptures.has(action.toA) || !legalNonCaptures.has(action.toB)) {
        throw new QuantumActionError('Destino de split ilegal')
      }
      this._assertCoherenceAvailable(action)
      return
    }

    if (action.kind === 'merge') {
      if (!isBoardSquare(action.to) || !this.getMergeTargets(action.pieceId, action.from).includes(action.to)) {
        throw new QuantumActionError('Fusión inválida')
      }
      this._assertCoherenceAvailable(action)
      return
    }

    throw new QuantumActionError('Acción cuántica desconocida')
  }

  private _assertCoherenceAvailable(action: QuantumAction): void {
    if (!this.isActionWithinCoherence(action)) {
      const color = actionCoherenceColor(this, action)
      const status = this.getCoherence(color)
      throw new QuantumActionError(
        `Coherencia insuficiente: ${status.used}/${status.limit} unidades ocupadas`,
      )
    }
  }

  private _nextRandom(): number {
    const value = this.rng()
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new QuantumActionError('La fuente RNG debe devolver un valor en [0, 1)')
    }
    this.state.rngCounter++
    return value
  }

  private _hasAnyLegalAction(): boolean {
    if (this.state.gameOver) return false
    for (const piece of Object.values(this.state.pieces)) {
      if (!piece.alive || piece.color !== this.state.turn) continue
      for (const from of Object.keys(piece.positions)) {
        const hasClassical = this.getLegalMoves(piece.id, from).some((move) => this.isActionWithinCoherence({
          kind: 'classical',
          pieceId: piece.id,
          from,
          to: move.square,
          promotion: piece.type === 'p' && (move.square[1] === '1' || move.square[1] === '8') ? 'q' : undefined,
        }))
        if (hasClassical) return true
        if (this.getQuantumSplitTargets(piece.id, from).length >= 2) return true
        if (this.getMergeTargets(piece.id, from).length > 0) return true
      }
    }
    return this.canQuantumCastle(this.state.turn).length > 0
  }

  private _refreshTerminalState(): void {
    this._checkGameOver()
    if (this.state.gameOver) return
    if (!this._hasAnyLegalAction()) {
      this.state.gameOver = {
        winner: null,
        cause: 'no-legal-actions',
        reason: 'Tablas: no hay acciones legales',
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Métodos privados
  // ═══════════════════════════════════════════════════════════════════

  private _classicalPieceAttacksSquare(
    piece: QPiece,
    from: string,
    target: string,
    board: Record<string, QBoardCell[]>,
  ): boolean {
    const [f, r] = sq2rc(from)
    const [tf, tr] = sq2rc(target)

    switch (piece.type) {
      case 'p': {
        const dir = piece.color === 'w' ? 1 : -1
        return Math.abs(tf - f) === 1 && tr === r + dir
      }
      case 'n': {
        const df = Math.abs(tf - f)
        const dr = Math.abs(tr - r)
        return (df === 2 && dr === 1) || (df === 1 && dr === 2)
      }
      case 'k':
        return Math.max(Math.abs(tf - f), Math.abs(tr - r)) === 1
      case 'b':
        return this._classicalSliderAttacks(from, target, BISHOP_DIRS, board)
      case 'r':
        return this._classicalSliderAttacks(from, target, ROOK_DIRS, board)
      case 'q':
        return this._classicalSliderAttacks(from, target, QUEEN_DIRS, board)
      default:
        return false
    }
  }

  private _classicalSliderAttacks(
    from: string,
    target: string,
    dirs: Dir[],
    board: Record<string, QBoardCell[]>,
  ): boolean {
    const [f, r] = sq2rc(from)

    for (const [df, dr] of dirs) {
      let cf = f + df
      let cr = r + dr
      while (cf >= 0 && cf < 8 && cr >= 0 && cr < 8) {
        const sq = rc2sq(cf, cr)!
        if (sq === target) return true
        if ((board[sq] || []).length > 0) break
        cf += df
        cr += dr
      }
    }
    return false
  }

  private _isCastleMove(color: PieceColor, from: string, to: string): boolean {
    const rank = color === 'w' ? '1' : '8'
    return from === `e${rank}` && (to === `g${rank}` || to === `c${rank}`)
  }

  private _isCastleLegalUnderCheck(
    color: PieceColor,
    from: string,
    to: string,
    board: Record<string, QBoardCell[]>,
  ): boolean {
    if (this.isSquareAttackedByClassical(from, color, board)) return false
    const side = to[0] === 'g' ? 'k' : 'q'
    const rank = color === 'w' ? '1' : '8'
    const kingPath = side === 'k' ? [`f${rank}`, `g${rank}`] : [`d${rank}`, `c${rank}`]
    return kingPath.every((sq) => !this.isSquareAttackedByClassical(sq, color, board))
  }

  private _applyCheckFilters(
    piece: QPiece,
    from: string,
    moves: MoveTarget[],
    board: Record<string, QBoardCell[]>,
  ): MoveTarget[] {
    if (piece.type === 'k' && this.isClassicalPiece(piece)) {
      return moves.filter((m) => {
        if (this._isCastleMove(piece.color, from, m.square)) {
          return this._isCastleLegalUnderCheck(piece.color, from, m.square, board)
        }
        return !this.isSquareAttackedByClassical(m.square, piece.color, board)
      })
    }

    if (piece.type === 'k') return moves

    const kingSq = this.getClassicalKingSquare(piece.color)
    if (!kingSq) return moves

    return moves.filter((m) => !this._wouldLeaveKingInCheck(piece, from, m, kingSq))
  }

  private _wouldLeaveKingInCheck(
    piece: QPiece,
    from: string,
    move: MoveTarget,
    kingSq: string,
  ): boolean {
    const snapshot = new Map<string, { positions: Record<string, number>; alive: boolean }>()
    for (const [id, p] of Object.entries(this.state.pieces)) {
      snapshot.set(id, { positions: { ...p.positions }, alive: p.alive })
    }

    this._applyMoveForCheckTest(piece, from, move)
    const board = this.getBoard()
    const newKingSq = piece.type === 'k' ? move.square : kingSq
    const inCheck = this.isSquareAttackedByClassical(newKingSq, piece.color, board)

    for (const [id, snap] of snapshot) {
      const p = this.state.pieces[id]
      if (p) {
        p.positions = snap.positions
        p.alive = snap.alive
      }
    }
    return inCheck
  }

  private _applyMoveForCheckTest(piece: QPiece, from: string, move: MoveTarget): void {
    const board = this.getBoard()
    const targetCells = board[move.square] || []
    const enemyClassical = targetCells.find(
      (c) => c.color !== piece.color && c.probability >= 1,
    )
    if (enemyClassical) {
      const ep = this.state.pieces[enemyClassical.pieceId]
      if (ep) ep.alive = false
    }

    delete piece.positions[from]
    piece.positions[move.square] = 1

    if (piece.type === 'k' && Math.abs(from.charCodeAt(0) - move.square.charCodeAt(0)) === 2) {
      const color = piece.color
      const rank = color === 'w' ? '1' : '8'
      const side = move.square[0] === 'g' ? 'k' : 'q'
      const rookId = side === 'k' ? `${color}_r_h` : `${color}_r_a`
      const rookFrom = side === 'k' ? `h${rank}` : `a${rank}`
      const rookTo = side === 'k' ? `f${rank}` : `d${rank}`
      const rook = this.state.pieces[rookId]
      if (rook) {
        delete rook.positions[rookFrom]
        rook.positions[rookTo] = 1
      }
    }
  }

  /** Movimientos de peón */
  private _pawnMoves(piece: QPiece, from: string, board: Record<string, QBoardCell[]>): MoveTarget[] {
    const [f, r] = sq2rc(from)
    const dir = piece.color === 'w' ? 1 : -1
    const startRank = piece.color === 'w' ? 1 : 6
    const moves: MoveTarget[] = []

    // Avance 1
    const fwd1 = rc2sq(f, r + dir)
    if (fwd1) {
      const cells = board[fwd1] || []
      if (cells.length === 0) {
        moves.push({ square: fwd1, isCapture: false, tunnelThrough: [] })

          // Avance 2 desde posición inicial
          if (r === startRank) {
            const fwd2 = rc2sq(f, r + 2 * dir)
            if (fwd2) {
              const cells2 = board[fwd2] || []
              if (cells2.length === 0) {
                moves.push({ square: fwd2, isCapture: false, tunnelThrough: [] })
              }
            }
          }
        }
    }

    // Capturas diagonales
    for (const df of [-1, 1]) {
      const cap = rc2sq(f + df, r + dir)
      if (cap) {
        const cells = board[cap] || []
        if (cells.some(c => c.color !== piece.color)) {
          moves.push({ square: cap, isCapture: true, tunnelThrough: [] })
        }
      }
    }

    return moves
  }

  /** Movimientos de salto (caballo, rey) */
  private _jumpMoves(from: string, offsets: Dir[], color: PieceColor, board: Record<string, QBoardCell[]>): MoveTarget[] {
    const [f, r] = sq2rc(from)
    const moves: MoveTarget[] = []

    for (const [df, dr] of offsets) {
      const sq = rc2sq(f + df, r + dr)
      if (!sq) continue

      const cells = board[sq] || []
      const hasOwnPiece = cells.some(c => c.color === color)
      if (hasOwnPiece) continue

      const hasEnemy = cells.some(c => c.color !== color)
      moves.push({ square: sq, isCapture: hasEnemy, tunnelThrough: [] })
    }
    return moves
  }

  /** Movimientos del rey, incluyendo enroque clásico */
  private _kingMoves(piece: QPiece, from: string, board: Record<string, QBoardCell[]>): MoveTarget[] {
    const moves = this._jumpMoves(from, KING_OFFSETS, piece.color, board)
    if (Object.keys(piece.positions).length !== 1 || piece.positions[from] !== 1) return moves

    const rank = piece.color === 'w' ? '1' : '8'
    if (this._getClassicalCastleInfo(piece.color, from, 'k', board)) {
      moves.push({ square: `g${rank}`, isCapture: false, tunnelThrough: [] })
    }
    if (this._getClassicalCastleInfo(piece.color, from, 'q', board)) {
      moves.push({ square: `c${rank}`, isCapture: false, tunnelThrough: [] })
    }

    return moves
  }

  /** Movimientos de deslizamiento (alfil, torre, dama) */
  private _sliderMoves(from: string, dirs: Dir[], color: PieceColor, board: Record<string, QBoardCell[]>, myId: string): MoveTarget[] {
    const [f, r] = sq2rc(from)
    const moves: MoveTarget[] = []

    for (const [df, dr] of dirs) {
      let cf = f + df, cr = r + dr
      const tunneled: string[] = []

      while (cf >= 0 && cf < 8 && cr >= 0 && cr < 8) {
        const sq = rc2sq(cf, cr)!
        const cells = board[sq] || []

        // Otra rama de la misma pieza se resuelve mediante fusión, no túnel.
        if (cells.some((cell) => cell.pieceId === myId)) break

        const ownClassical = cells.find(c => c.color === color && c.probability >= 1 && c.pieceId !== myId)
        const ownQuantum = cells.filter(c => c.color === color && c.probability < 1 && c.pieceId !== myId)
        const enemyClassical = cells.find(c => c.color !== color && c.probability >= 1)
        const enemyQuantum = cells.filter(c => c.color !== color && c.probability < 1)

        // Pieza propia clásica → bloqueado
        if (ownClassical) break

        // Pieza enemiga clásica → captura y parar
        if (enemyClassical) {
          moves.push({ square: sq, isCapture: true, tunnelThrough: [...tunneled] })
          break
        }

        // Solo piezas cuánticas en esta casilla
        if (ownQuantum.length > 0 && enemyQuantum.length === 0 && cells.every(c => c.pieceId === myId || (c.color === color && c.probability < 1))) {
          // Piezas propias cuánticas → túnel (pasar sin aterrizar)
          tunneled.push(sq)
          cf += df; cr += dr
          continue
        }

        if (enemyQuantum.length > 0) {
          // Pieza enemiga cuántica → opción de captura + seguir deslizando
          moves.push({ square: sq, isCapture: true, tunnelThrough: [...tunneled] })
          tunneled.push(sq)
          cf += df; cr += dr
          continue
        }

        // Casilla vacía o solo nuestra propia pieza cuántica (fusión se maneja aparte)
        if (cells.length === 0) {
          moves.push({ square: sq, isCapture: false, tunnelThrough: [...tunneled] })
        } else if (cells.every(c => c.pieceId === myId)) {
          // La propia pieza en otra posición → no aterrizar (fusión maneja esto)
          tunneled.push(sq)
        }

        cf += df; cr += dr
      }
    }
    return moves
  }

  private _getClassicalCastleInfo(
    color: PieceColor,
    from: string,
    side: 'k' | 'q',
    board: Record<string, QBoardCell[]>
  ): ClassicalCastleInfo | null {
    const rank = color === 'w' ? '1' : '8'
    if (from !== `e${rank}`) return null

    const rights = this.state.castling[color]
    if ((side === 'k' && !rights.k) || (side === 'q' && !rights.q)) return null

    const rookId = side === 'k' ? `${color}_r_h` : `${color}_r_a`
    const rookFrom = side === 'k' ? `h${rank}` : `a${rank}`
    const rookTo = side === 'k' ? `f${rank}` : `d${rank}`
    const kingId = `${color}_k`
    const king = this.state.pieces[kingId]
    const rook = this.state.pieces[rookId]

    if (!king?.alive || !rook?.alive) return null
    if (Object.keys(king.positions).length !== 1 || king.positions[`e${rank}`] !== 1) return null
    if (Object.keys(rook.positions).length !== 1 || rook.positions[rookFrom] !== 1) return null

    const emptySquares = side === 'k' ? [`f${rank}`, `g${rank}`] : [`b${rank}`, `c${rank}`, `d${rank}`]
    if (emptySquares.some((sq) => (board[sq] || []).length > 0)) return null

    return { side, rookId, rookFrom, rookTo }
  }

  /** Colapsar pieza LEJOS de una casilla (no existe ahí → va a otra posición) */
  private _collapsePieceAway(pieceId: string, awayFrom: string) {
    const piece = this.state.pieces[pieceId]
    if (!piece) return

    const remaining = Object.entries(piece.positions).filter(([sq]) => sq !== awayFrom)
    if (remaining.length === 0) {
      // No tiene otra casilla → muere
      this._killPiece(pieceId)
      return
    }
    if (remaining.length === 1) {
      piece.positions = { [remaining[0][0]]: 1 }
      return
    }

    // Normalizar y elegir proporcionalmente
    const totalProb = remaining.reduce((s, [, p]) => s + p, 0)
    const roll = this._nextRandom() * totalProb
    let accum = 0
    let target = remaining[0][0]
    for (const [sq, p] of remaining) {
      accum += p
      if (roll <= accum) { target = sq; break }
    }

    piece.positions = { [target]: 1 }
  }

  /** Colapsar pieza HACIA una casilla (existe ahí → 100% en esa casilla) */
  private _collapsePieceTo(pieceId: string, toSquare: string) {
    const piece = this.state.pieces[pieceId]
    if (!piece) return
    piece.positions = { [toSquare]: 1 }
  }

  /** Eliminar pieza del juego */
  private _killPiece(pieceId: string) {
    const piece = this.state.pieces[pieceId]
    if (!piece) return
    piece.alive = false
    piece.positions = {}
  }

  /** Resolver entrelazamientos cuando una pieza colapsa */
  private _resolveEntanglementsFor(pieceId: string, observedSquare?: string) {
    const toRemove: number[] = []

    for (const ent of this.state.entanglements) {
      if (ent.type === 'castle') {
        const d = ent.data as QCastleEntData
        if (d.kingId === pieceId || d.rookId === pieceId) {
          const collapsedPiece = this.state.pieces[pieceId]
          if (!collapsedPiece?.alive) {
            // La pieza murió → la otra también colapsa (al estado original si aplica)
            const otherId = d.kingId === pieceId ? d.rookId : d.kingId
            const otherPiece = this.state.pieces[otherId]
            if (otherPiece?.alive && Object.keys(otherPiece.positions).length > 1) {
              // Colapsar al estado original
              const capturedCastledBranch = d.kingId === pieceId
                ? observedSquare === d.castled.king
                : observedSquare === d.castled.rook
              const target = d.kingId === pieceId
                ? (capturedCastledBranch ? d.castled.rook : d.original.rook)
                : (capturedCastledBranch ? d.castled.king : d.original.king)
              this._collapsePieceTo(otherId, target)
            }
          } else {
            // La pieza colapsó a una casilla → determinar si fue "enrocado" o "original"
            const collapsedSq = Object.keys(collapsedPiece.positions)[0]
            const otherId = d.kingId === pieceId ? d.rookId : d.kingId
            const otherPiece = this.state.pieces[otherId]

            if (otherPiece?.alive) {
              if (d.kingId === pieceId) {
                // El rey colapsó
                if (collapsedSq === d.castled.king) {
                  this._collapsePieceTo(d.rookId, d.castled.rook)
                } else {
                  this._collapsePieceTo(d.rookId, d.original.rook)
                }
              } else {
                // La torre colapsó
                if (collapsedSq === d.castled.rook) {
                  this._collapsePieceTo(d.kingId, d.castled.king)
                } else {
                  this._collapsePieceTo(d.kingId, d.original.king)
                }
              }
            }
          }
          toRemove.push(ent.id)
        }
      }

      if (ent.type === 'tunnel') {
        const d = ent.data as QTunnelEntData
        if (d.blockerId === pieceId) {
          const blocker = this.state.pieces[d.blockerId]
          if (blocker?.alive) {
            const blockerSq = Object.keys(blocker.positions)[0]
            if (blockerSq === d.blockerSquare) {
              // El bloqueador estaba ahí → el túnel era inválido → pieza retrocede
              const tunneler = this.state.pieces[d.tunnelerId]
              if (tunneler?.alive) {
                // Buscar la posición actual del tunneler que corresponde al destino post-túnel
                // y moverla de vuelta al origen
                const currentSqs = Object.keys(tunneler.positions)
                if (currentSqs.length > 1) {
                  // Si está en superposición, solo quitar la parte que pasó por el túnel
                  const afterTunnel = currentSqs.filter(s => s !== d.tunnelerOriginal)
                  if (afterTunnel.length > 0) {
                    for (const s of afterTunnel) {
                      delete tunneler.positions[s]
                    }
                    // Renormalizar
                    const totalP = Object.values(tunneler.positions).reduce((a, b) => a + b, 0)
                    for (const s of Object.keys(tunneler.positions)) {
                      tunneler.positions[s] /= totalP
                    }
                  }
                } else {
                  // Estaba solo en la posición post-túnel → volver al origen
                  const sq = currentSqs[0]
                  delete tunneler.positions[sq]
                  tunneler.positions[d.tunnelerOriginal] = 1
                }
              }
            }
          }
          toRemove.push(ent.id)
        }
        if (d.tunnelerId === pieceId) {
          toRemove.push(ent.id)
        }
      }
    }

    this.state.entanglements = this.state.entanglements.filter(e => !toRemove.includes(e.id))
  }

  /** Actualizar derechos de enroque */
  private _updateCastlingRights(pieceId: string, from: string, to: string) {
    // Si mueve el rey → pierde ambos enroques
    if (pieceId.endsWith('_k')) {
      const color = pieceId[0] as PieceColor
      this.state.castling[color] = { k: false, q: false }
    }
    // Si mueve una torre → pierde ese enroque
    if (pieceId === 'w_r_a') this.state.castling.w.q = false
    if (pieceId === 'w_r_h') this.state.castling.w.k = false
    if (pieceId === 'b_r_a') this.state.castling.b.q = false
    if (pieceId === 'b_r_h') this.state.castling.b.k = false
    // Si captura una torre en su casilla original
    if (to === 'a1') this.state.castling.w.q = false
    if (to === 'h1') this.state.castling.w.k = false
    if (to === 'a8') this.state.castling.b.q = false
    if (to === 'h8') this.state.castling.b.k = false
  }

  /** Verificar si algún rey fue capturado */
  private _checkGameOver() {
    const wk = this.state.pieces['w_k']
    const bk = this.state.pieces['b_k']
    if (!wk?.alive && !bk?.alive) {
      throw new QuantumActionError('Estado inválido: ambos reyes están capturados')
    }
    if (!wk?.alive) {
      this.state.gameOver = { winner: 'b', cause: 'king-captured', reason: 'Rey blanco capturado' }
    }
    if (!bk?.alive) {
      this.state.gameOver = { winner: 'w', cause: 'king-captured', reason: 'Rey negro capturado' }
    }
  }

  /** Cambiar turno */
  private _endTurn() {
    this.state.turn = this.state.turn === 'w' ? 'b' : 'w'
    if (this.state.turn === 'w') this.state.moveNumber++
  }

  /** Construir FEN desde un placement (para Stockfish) */
  private _buildFen(placement: Record<string, QPiece>): string {
    const PIECE_CHAR: Record<string, string> = {
      p: 'p', n: 'n', b: 'b', r: 'r', q: 'q', k: 'k',
    }
    const rows: string[] = []
    for (let rank = 7; rank >= 0; rank--) {
      let row = ''
      let empty = 0
      for (let file = 0; file < 8; file++) {
        const sq = rc2sq(file, rank)!
        const piece = placement[sq]
        if (piece) {
          if (empty > 0) { row += empty; empty = 0 }
          const ch = PIECE_CHAR[piece.type]
          row += piece.color === 'w' ? ch.toUpperCase() : ch
        } else {
          empty++
        }
      }
      if (empty > 0) row += empty
      rows.push(row)
    }

    const turn = this.state.turn
    let castling = ''
    if (this.state.castling.w.k) castling += 'K'
    if (this.state.castling.w.q) castling += 'Q'
    if (this.state.castling.b.k) castling += 'k'
    if (this.state.castling.b.q) castling += 'q'
    if (!castling) castling = '-'

    return `${rows.join('/')} ${turn} ${castling} - 0 ${this.state.moveNumber}`
  }

  /** Construir mapa pieceId → square */
  private _buildPieceMap(placement: Record<string, QPiece>): Record<string, string> {
    const map: Record<string, string> = {}
    for (const [sq, piece] of Object.entries(placement)) {
      map[sq] = piece.id
    }
    return map
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Creación del estado inicial
// ═══════════════════════════════════════════════════════════════════════

/**
 * API funcional y pura: valida/clona `state`, aplica la acción con el RNG
 * inyectado y devuelve el nuevo estado sin modificar la entrada.
 */
export function applyAction(
  state: QState,
  action: QuantumAction,
  rng: QuantumRng = Math.random,
): ActionResult {
  const engine = new QuantumChessEngine(rng)
  engine.loadState(state)
  return engine.applyAction(action, rng)
}

function createInitialState(): QState {
  const pieces: Record<string, QPiece> = {}

  const add = (id: string, type: PieceType, color: PieceColor, sq: string) => {
    pieces[id] = { id, type, color, positions: { [sq]: 1 }, alive: true }
  }

  // Blancas
  add('w_r_a', 'r', 'w', 'a1'); add('w_n_b', 'n', 'w', 'b1')
  add('w_b_c', 'b', 'w', 'c1'); add('w_q', 'q', 'w', 'd1')
  add('w_k', 'k', 'w', 'e1'); add('w_b_f', 'b', 'w', 'f1')
  add('w_n_g', 'n', 'w', 'g1'); add('w_r_h', 'r', 'w', 'h1')
  for (let i = 0; i < 8; i++) {
    const file = String.fromCharCode(97 + i)
    add(`w_p_${file}`, 'p', 'w', `${file}2`)
  }

  // Negras
  add('b_r_a', 'r', 'b', 'a8'); add('b_n_b', 'n', 'b', 'b8')
  add('b_b_c', 'b', 'b', 'c8'); add('b_q', 'q', 'b', 'd8')
  add('b_k', 'k', 'b', 'e8'); add('b_b_f', 'b', 'b', 'f8')
  add('b_n_g', 'n', 'b', 'g8'); add('b_r_h', 'r', 'b', 'h8')
  for (let i = 0; i < 8; i++) {
    const file = String.fromCharCode(97 + i)
    add(`b_p_${file}`, 'p', 'b', `${file}7`)
  }

  return {
    pieces,
    turn: 'w',
    castling: { w: { k: true, q: true }, b: { k: true, q: true } },
    history: [],
    moveNumber: 1,
    entanglements: [],
    nextEntId: 1,
    rngCounter: 0,
    gameOver: null,
  }
}
