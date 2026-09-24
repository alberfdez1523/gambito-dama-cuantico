// Estado cuántico: validación de invariantes, forma canónica, huella estable,
// RNG reproducible y posición inicial. Funciones puras sin dependencia del motor.

import type { GameResultCause, PieceColor, PieceType, QPiece, QState, QuantumRng } from './types'

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

export function cloneState(state: QState): QState {
  return structuredClone(state)
}

export function isBoardSquare(value: string): boolean {
  return /^[a-h][1-8]$/.test(value)
}

export function normalizeLoadedState(next: QState): QState {
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

export function createInitialState(): QState {
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
