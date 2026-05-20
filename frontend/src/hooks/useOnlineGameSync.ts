import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import type { GameConfig, PieceColor } from '../lib/types'
import type { ClassicRoomState, OnlineRoomRow, QuantumRoomState } from '../lib/onlineTypes'
import type { OnlineMeta } from '../lib/types'
import {
  abandonOnlineRoom,
  finishOnlineRoom,
  fetchOnlineRoom,
  getInviteUrl,
  pushRoomStateWithRetry,
  subscribeToRoom,
} from '../lib/onlineRoom'
import type { QState } from '../lib/types'

interface UseOnlineGameSyncOptions {
  config: GameConfig
  enabled: boolean
}

const ROOM_WAIT_MS = 80
const ROOM_WAIT_ATTEMPTS = 25

export function useOnlineGameSync({ config, enabled }: UseOnlineGameSyncOptions) {
  const online = config.online
  const [room, setRoom] = useState<OnlineRoomRow | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [opponentLeft, setOpponentLeft] = useState(false)
  const applyingRemote = useRef(false)
  const lastAppliedVersion = useRef(-1)
  const hasAbandonedRef = useRef(false)
  const roomRef = useRef<OnlineRoomRow | null>(null)

  const isOnline = enabled && !!online

  const syncRoom = useCallback((next: OnlineRoomRow | null) => {
    roomRef.current = next
    setRoom(next)
  }, [])

  const waitForRoom = useCallback(async (): Promise<OnlineRoomRow | null> => {
    if (roomRef.current) return roomRef.current
    if (!online?.roomId) return null
    for (let i = 0; i < ROOM_WAIT_ATTEMPTS; i++) {
      const fetched = await fetchOnlineRoom(online.roomId)
      if (fetched) {
        syncRoom(fetched)
        return fetched
      }
      await new Promise((r) => setTimeout(r, ROOM_WAIT_MS))
    }
    return roomRef.current
  }, [online?.roomId, syncRoom])

  const leaveRoom = useCallback(async (): Promise<boolean> => {
    if (!online?.roomId || hasAbandonedRef.current) return false
    try {
      const deleted = await abandonOnlineRoom(online.roomId)
      if (deleted) hasAbandonedRef.current = true
      return deleted
    } catch (e) {
      console.error('[online] abandon room failed:', e)
      return false
    }
  }, [online?.roomId])

  useEffect(() => {
    if (!isOnline || !online?.roomId) return
    lastAppliedVersion.current = -1
    hasAbandonedRef.current = false
    setOpponentLeft(false)
    syncRoom(null)

    const unsub = subscribeToRoom(online.roomId, {
      onRoom: (next) => syncRoom(next),
      onDeleted: () => {
        syncRoom(null)
        if (!hasAbandonedRef.current) setOpponentLeft(true)
      },
    })

    const onPageHide = () => {
      void leaveRoom()
    }
    window.addEventListener('pagehide', onPageHide)

    return () => {
      window.removeEventListener('pagehide', onPageHide)
      unsub()
    }
  }, [isOnline, online?.roomId, leaveRoom, syncRoom])

  const isMyTurn = isOnline && room ? room.turn === config.playerColor : true

  const opponentConnected = isOnline && room
    ? Boolean(
        room.white_player_id &&
          room.black_player_id &&
          (room.status === 'playing' || room.status === 'finished'),
      )
    : false

  const pushClassicState = useCallback(
    async (fen: string, turn: PieceColor, lastMove?: { from: string; to: string } | null) => {
      if (!online?.roomId || applyingRemote.current) return false
      const active = await waitForRoom()
      if (!active) {
        setSyncError('ROOM_NOT_READY')
        return false
      }
      const state: ClassicRoomState = { type: 'classic', fen, lastMove: lastMove ?? null }
      try {
        const updated = await pushRoomStateWithRetry(active.id, { state, turn })
        syncRoom(updated)
        lastAppliedVersion.current = updated.version
        setSyncError(null)
        return true
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : 'Sync error')
        return false
      }
    },
    [online?.roomId, syncRoom, waitForRoom],
  )

  const pushQuantumState = useCallback(
    async (qstate: QState, turn: PieceColor) => {
      if (!online?.roomId || applyingRemote.current) return false
      const active = await waitForRoom()
      if (!active) {
        setSyncError('ROOM_NOT_READY')
        return false
      }
      const state: QuantumRoomState = { type: 'quantum', qstate }
      try {
        const updated = await pushRoomStateWithRetry(active.id, {
          state,
          turn,
          measurement_seed: active.measurement_seed,
        })
        syncRoom(updated)
        lastAppliedVersion.current = updated.version
        setSyncError(null)
        return true
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : 'Sync error')
        return false
      }
    },
    [online?.roomId, syncRoom, waitForRoom],
  )

  const finishGame = useCallback(async () => {
    if (!online?.roomId) return
    try {
      await finishOnlineRoom(online.roomId)
    } catch {
      /* ignore */
    }
  }, [online?.roomId])

  const copyInviteLink = useCallback(() => {
    if (!online?.code) return
    const url = getInviteUrl(online.code)
    void navigator.clipboard?.writeText(url)
  }, [online?.code])

  const shouldApplyRemote = isOnline && room && room.version > lastAppliedVersion.current

  const markRemoteApplied = useCallback((version: number) => {
    lastAppliedVersion.current = version
  }, [])

  const beginRemoteApply = useCallback(() => {
    applyingRemote.current = true
  }, [])

  const endRemoteApply = useCallback(() => {
    applyingRemote.current = false
  }, [])

  const validateClassicFen = useCallback((fen: string) => {
    try {
      new Chess(fen)
      return true
    } catch {
      return false
    }
  }, [])

  return {
    isOnline,
    room,
    isMyTurn,
    opponentConnected,
    opponentLeft,
    syncError,
    pushClassicState,
    pushQuantumState,
    finishGame,
    leaveRoom,
    copyInviteLink,
    shouldApplyRemote,
    markRemoteApplied,
    beginRemoteApply,
    endRemoteApply,
    validateClassicFen,
    remoteVersion: room?.version ?? 0,
    remoteState: room?.state ?? null,
    remoteTurn: room?.turn,
  }
}

export type OnlineGameSync = ReturnType<typeof useOnlineGameSync>

export function buildOnlineConfig(
  base: Omit<GameConfig, 'opponentMode' | 'online'>,
  meta: OnlineMeta,
): GameConfig {
  return {
    ...base,
    opponentMode: 'online',
    online: meta,
  }
}
