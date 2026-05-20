import { Chess } from 'chess.js'
import type { GameConfig, GameMode, PieceColor } from './types'
import type { ClassicRoomState, OnlineRoomRow, QuantumRoomState, RoomGameState } from './onlineTypes'
import { getSupabase, isSupabaseConfigured } from './supabase'
import { QuantumChessEngine } from './quantumEngine'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

function randomSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

export function initialClassicState(): ClassicRoomState {
  const game = new Chess()
  return {
    type: 'classic',
    fen: game.fen(),
    lastMove: null,
    pgn: '',
  }
}

export function initialQuantumState(): QuantumRoomState {
  const engine = new QuantumChessEngine()
  return {
    type: 'quantum',
    qstate: engine.exportState(),
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

export async function joinOnlineRoom(code: string): Promise<OnlineRoomRow> {
  const supabase = getSupabase()
  const userId = await ensureOnlineAuth()
  const normalized = code.trim().toUpperCase().replace(/\s/g, '')

  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', normalized)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!room) throw new Error('ROOM_NOT_FOUND')
  if (room.status === 'finished') throw new Error('ROOM_FINISHED')

  const r = room as OnlineRoomRow
  if (r.white_player_id === userId || r.black_player_id === userId) {
    return r
  }

  if (r.status !== 'waiting') {
    throw new Error('ROOM_FULL')
  }

  const patch: Partial<OnlineRoomRow> = {}
  if (!r.white_player_id) patch.white_player_id = userId
  else if (!r.black_player_id) patch.black_player_id = userId
  else throw new Error('ROOM_FULL')

  const { data: updated, error: upErr } = await supabase
    .from('rooms')
    .update({
      ...patch,
      status: 'playing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', r.id)
    .eq('version', r.version)
    .select()
    .single()

  if (upErr || !updated) throw new Error(upErr?.message ?? 'No se pudo unir a la sala')
  return updated as OnlineRoomRow
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
  patch: {
    state: RoomGameState
    turn: PieceColor
    status?: OnlineRoomRow['status']
    measurement_seed?: string | null
  },
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
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('VERSION_CONFLICT')
  return data as OnlineRoomRow
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
      const result = game.move({ from: lastMove.from, to: lastMove.to, promotion })
      if (result && game.fen() === targetFen) return true
    } catch {
      /* siguiente promoción */
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

export function getInviteUrl(code: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''
  return `${base}?room=${encodeURIComponent(code)}`
}

export function parseRoomCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const room = params.get('room')
  return room ? room.trim().toUpperCase() : null
}

export function isOnlineAvailable(): boolean {
  return isSupabaseConfigured()
}
