import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import type { GameConfig, PieceColor } from '../lib/types'
import type { ClassicRoomState, OnlineRoomRow, QuantumRoomState } from '../lib/onlineTypes'
import type { OnlineMeta } from '../lib/types'
import {
  abandonOnlineRoom,
  finishOnlineRoom,
  getInviteUrl,
  pushRoomState,
  subscribeToRoom,
} from '../lib/onlineRoom'
import type { QState } from '../lib/types'

interface UseOnlineGameSyncOptions {
  config: GameConfig
  enabled: boolean
}

export function useOnlineGameSync({ config, enabled }: UseOnlineGameSyncOptions) {
  const online = config.online
  const [room, setRoom] = useState<OnlineRoomRow | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [opponentLeft, setOpponentLeft] = useState(false)
  const applyingRemote = useRef(false)
  const lastAppliedVersion = useRef(-1)
  const hasAbandonedRef = useRef(false)

  const isOnline = enabled && !!online

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

    const unsub = subscribeToRoom(online.roomId, {
      onRoom: (next) => setRoom(next),
      onDeleted: () => {
        setRoom(null)
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
  }, [isOnline, online?.roomId, leaveRoom])

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
      if (!online || !room || applyingRemote.current) return false
      const state: ClassicRoomState = { type: 'classic', fen, lastMove: lastMove ?? null }
      try {
        const updated = await pushRoomState(room.id, room.version, {
          state,
          turn,
        })
        setRoom(updated)
        setSyncError(null)
        return true
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : 'Sync error')
        return false
      }
    },
    [online, room],
  )

  const pushQuantumState = useCallback(
    async (qstate: QState, turn: PieceColor) => {
      if (!online || !room || applyingRemote.current) return false
      const state: QuantumRoomState = { type: 'quantum', qstate }
      try {
        const updated = await pushRoomState(room.id, room.version, {
          state,
          turn,
          measurement_seed: room.measurement_seed,
        })
        setRoom(updated)
        setSyncError(null)
        return true
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : 'Sync error')
        return false
      }
    },
    [online, room],
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
