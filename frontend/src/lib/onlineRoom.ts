import { Chess } from 'chess.js'
import { tryMove } from './chessRules'
import type { GameConfig, GameMode, GameResult, PieceColor } from './types'
import { hashClassicState, type ClassicRoomState, type OnlineRoomRow, type QuantumRoomState, type RoomGameState } from './onlineTypes'
import { getSupabase } from './supabase'
import { getInviteUrl, isSupabaseConfigured, parseRoomCodeFromUrl } from './onlineConfig'
import { hashQuantumState, QuantumChessEngine } from './quantumEngine'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

interface PushRoomStatePatch {
  state: RoomGameState
  turn: PieceColor
  status?: OnlineRoomRow['status']
  measurement_seed?: string | null
  actorColor?: PieceColor
  move?: Record<string, unknown> | null
}

function summarizeMove(state: RoomGameState): Record<string, unknown> | null {
  if (state.type === 'classic') {
    if (!state.lastMove) return { type: 'classic' }
    return {
      type: 'classic',
      from: state.lastMove.from,
      to: state.lastMove.to,
    }
  }

  const last = state.qstate.history[state.qstate.history.length - 1]
  if (!last) return { type: 'quantum' }

  return {
    type: 'quantum',
    pieceId: last.pieceId,
    pieceType: last.pieceType,
    moveType: last.moveType,
    from: last.from,
    to: last.to,
    secondTo: last.secondTo ?? null,
    captured: last.captured ?? null,
    measured: Boolean(last.measurement),
  }
}

async function logRoomMove(
  supabase: ReturnType<typeof getSupabase>,
  row: {
    room_id: string
    version: number
    actor_color: PieceColor | null
    mode: GameMode
    move: Record<string, unknown> | null
    state: RoomGameState
  },
): Promise<void> {
  const { error } = await supabase.from('room_moves').insert(row)

  if (
    error &&
    error.code !== '23505' &&
    error.code !== '42P01' &&
    !error.message.includes('room_moves')
  ) {
    console.warn('[online] room move log failed:', error.message)
  }
}

/** Entero uniforme en [0, max) con CSPRNG y sin sesgo de módulo. */
function secureRandomInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buffer = new Uint32Array(1)
  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] >= limit)
  return buffer[0] % max
}

export function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[secureRandomInt(CODE_CHARS.length)]
  }
  return code
}

/** Semilla provisional: la migración 202609240001 la sustituye por una generada en BD. */
export function randomSeed(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function initialClassicState(): ClassicRoomState {
  const game = new Chess()
  const fen = game.fen()
  return {
    type: 'classic',
    fen,
    lastMove: null,
    pgn: '',
    revision: 0,
    stateHash: hashClassicState(fen),
    rngCounter: 0,
    clocks: { whiteTime: null, blackTime: null, paused: false },
    result: null,
    rematch: null,
  }
}

export function initialQuantumState(): QuantumRoomState {
  const engine = new QuantumChessEngine()
  const qstate = engine.exportState()
  return {
    type: 'quantum',
    qstate,
    revision: 0,
    stateHash: hashQuantumState(qstate),
    rngCounter: qstate.rngCounter,
    clocks: { whiteTime: null, blackTime: null, paused: false },
    result: null,
    rematch: null,
  }
}

export function classicResultFromFen(fen: string): GameResult | null {
  try {
    const game = new Chess(fen)
    if (!game.isGameOver()) return null
    if (game.isCheckmate()) {
      return { winner: game.turn() === 'w' ? 'b' : 'w', cause: 'checkmate' }
    }
    return { winner: null, cause: 'draw' }
  } catch {
    return null
  }
}

export function initialRoomState(mode: GameMode): RoomGameState {
  return mode === 'quantum' ? initialQuantumState() : initialClassicState()
}

export async function ensureOnlineAuth(): Promise<string> {
  const supabase = getSupabase()
  const { data: sessionData } = await supabase.auth.getSession()
  if (sessionData.session?.user?.id) {
    return sessionData.session.user.id
  }
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.user?.id) {
    throw new Error(error?.message ?? 'No se pudo iniciar sesión anónima')
  }
  return data.user.id
}

export async function createOnlineRoom(
  mode: GameMode,
  hostColor: PieceColor,
  config: GameConfig,
): Promise<OnlineRoomRow> {
  const supabase = getSupabase()
  const userId = await ensureOnlineAuth()

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode()
    const insert = {
      code,
      mode,
      status: 'waiting' as const,
      host_color: hostColor,
      white_player_id: hostColor === 'w' ? userId : null,
      black_player_id: hostColor === 'b' ? userId : null,
      state: initialRoomState(mode),
      version: 0,
      turn: 'w' as PieceColor,
      config,
      measurement_seed: mode === 'quantum' ? randomSeed() : null,
    }

    const { data, error } = await supabase.from('rooms').insert(insert).select().single()
    if (!error && data) return data as OnlineRoomRow
    if (error?.code !== '23505') throw new Error(error?.message ?? 'No se pudo crear la sala')
  }
  throw new Error('No se pudo generar un código único')
}

const JOIN_ERROR_CODES = ['ROOM_NOT_FOUND', 'ROOM_FINISHED', 'ROOM_FULL'] as const

/**
 * Se une a una sala por código mediante la RPC `join_room_by_code`: las salas en
 * espera no son legibles para quien no participa, así que no se pueden enumerar.
 */
export async function joinOnlineRoom(code: string): Promise<OnlineRoomRow> {
  const supabase = getSupabase()
  await ensureOnlineAuth()
  const normalized = code.trim().toUpperCase().replace(/\s/g, '')

  const { data, error } = await supabase.rpc('join_room_by_code', { p_code: normalized })
  if (error) {
    const known = JOIN_ERROR_CODES.find((known) => error.message.includes(known))
    throw new Error(known ?? error.message)
  }
  if (!data) throw new Error('ROOM_NOT_FOUND')
  return data as OnlineRoomRow
}

export async function startOnlineRoom(roomId: string): Promise<OnlineRoomRow> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('rooms')
    .update({
      status: 'playing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId)
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'No se pudo iniciar la partida')
  return data as OnlineRoomRow
}

export async function fetchOnlineRoom(roomId: string): Promise<OnlineRoomRow | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as OnlineRoomRow) ?? null
}

export async function pushRoomState(
  roomId: string,
  expectedVersion: number,
  patch: PushRoomStatePatch,
): Promise<OnlineRoomRow> {
  const supabase = getSupabase()
  const updatePayload: Record<string, unknown> = {
    state: patch.state,
    turn: patch.turn,
    version: expectedVersion + 1,
    updated_at: new Date().toISOString(),
  }
  if (patch.status !== undefined) updatePayload.status = patch.status
  if (patch.measurement_seed !== undefined) updatePayload.measurement_seed = patch.measurement_seed

  const { data, error } = await supabase
    .from('rooms')
    .update(updatePayload)
    .eq('id', roomId)
    .eq('version', expectedVersion)
    .select()
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('VERSION_CONFLICT')
  const updated = data as OnlineRoomRow
  void logRoomMove(supabase, {
    room_id: updated.id,
    version: updated.version,
    actor_color: patch.actorColor ?? null,
    mode: updated.mode,
    move: patch.move === undefined ? summarizeMove(patch.state) : patch.move,
    state: patch.state,
  })
  return updated
}

/** Comprueba que `targetFen` sea un solo movimiento legal desde `baseFen`. */
export function isLegalMoveFromFen(
  baseFen: string,
  targetFen: string,
  lastMove: { from: string; to: string },
): boolean {
  const promotions: Array<'q' | 'r' | 'b' | 'n' | undefined> = ['q', 'r', 'b', 'n', undefined]
  for (const promotion of promotions) {
    try {
      const game = new Chess(baseFen)
      const result = tryMove(game, { from: lastMove.from, to: lastMove.to, promotion })
      if (result && game.fen() === targetFen) return true
    } catch {
      /* FEN base inválido */
    }
  }
  return false
}

export async function finishOnlineRoom(roomId: string): Promise<void> {
  const supabase = getSupabase()
  await supabase
    .from('rooms')
    .update({ status: 'finished', updated_at: new Date().toISOString() })
    .eq('id', roomId)
}

/** Elimina la sala de la BD (al salir al menú o desconectarse). */
/** Borra salas sin actividad reciente (RPC cleanup_stale_rooms, por defecto 15 min). */
export async function cleanupStaleRooms(maxAgeMinutes = 15): Promise<number> {
  if (!isSupabaseConfigured()) return 0

  const supabase = getSupabase()
  const pBefore = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString()

  const { data, error } = await supabase.rpc('cleanup_stale_rooms', { p_before: pBefore })

  if (error) {
    const rpcMissing =
      error.code === 'PGRST202' ||
      error.message.includes('cleanup_stale_rooms') ||
      error.message.includes('Could not find the function')
    if (rpcMissing) {
      console.warn('[online] cleanup_stale_rooms RPC not available')
      return 0
    }
    console.warn('[online] cleanup_stale_rooms failed:', error.message)
    return 0
  }

  return typeof data === 'number' ? data : 0
}

export async function abandonOnlineRoom(roomId: string): Promise<boolean> {
  const supabase = getSupabase()
  await ensureOnlineAuth()

  const { error: rpcError } = await supabase.rpc('abandon_room', { p_room_id: roomId })
  if (!rpcError) return true

  const rpcMissing =
    rpcError.code === 'PGRST202' ||
    rpcError.message.includes('abandon_room') ||
    rpcError.message.includes('Could not find the function')

  if (!rpcMissing) {
    if (
      rpcError.message.includes('room_not_found_or_not_allowed') ||
      rpcError.code === 'P0001'
    ) {
      return false
    }
    throw new Error(rpcError.message)
  }

  const { data, error } = await supabase.from('rooms').delete().eq('id', roomId).select('id')
  if (error) throw new Error(error.message)
  return (data?.length ?? 0) > 0
}

export interface RoomSubscriptionHandlers {
  onRoom: (room: OnlineRoomRow) => void
  onDeleted?: () => void
}

export function subscribeToRoom(roomId: string, handlers: RoomSubscriptionHandlers): () => void {
  const supabase = getSupabase()

  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          handlers.onDeleted?.()
          return
        }
        if (payload.new) handlers.onRoom(payload.new as OnlineRoomRow)
      },
    )
    .subscribe()

  void fetchOnlineRoom(roomId).then((room) => {
    if (room) handlers.onRoom(room)
    else handlers.onDeleted?.()
  })

  return () => {
    void supabase.removeChannel(channel)
  }
}

export interface RoomPresenceHandlers {
  onPeers: (peerIds: string[]) => void
}

export function subscribeToRoomPresence(
  roomId: string,
  playerId: string,
  handlers: RoomPresenceHandlers,
): () => void {
  const supabase = getSupabase()
  const channel = supabase.channel(`presence:room:${roomId}`, {
    config: {
      presence: { key: playerId },
    },
  })

  const emitPresence = () => {
    const state = channel.presenceState() as Record<string, unknown[]>
    handlers.onPeers(Object.keys(state).filter(Boolean))
  }

  channel.on('presence', { event: 'sync' }, emitPresence)
  channel.on('presence', { event: 'join' }, emitPresence)
  channel.on('presence', { event: 'leave' }, emitPresence)
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      void channel.track({
        playerId,
        onlineAt: new Date().toISOString(),
      }).then(emitPresence)
    }
  })

  const heartbeat = window.setInterval(() => {
    void channel.track({
      playerId,
      onlineAt: new Date().toISOString(),
    })
  }, 20_000)

  return () => {
    window.clearInterval(heartbeat)
    void channel.untrack()
    void supabase.removeChannel(channel)
  }
}

export function isOnlineAvailable(): boolean {
  return isSupabaseConfigured()
}

export { getInviteUrl, parseRoomCodeFromUrl }
