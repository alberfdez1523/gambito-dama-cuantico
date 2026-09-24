import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import type { GameConfig, PieceColor } from '../lib/types'
import type {
  ClassicRoomState,
  OnlineRoomRow,
  QPendingMeasurement,
  OnlineStatus,
  OnlineClockState,
  QuantumRoomState,
  RoomGameState,
} from '../lib/onlineTypes'
import { hashClassicState, quantumRoomFingerprint, quantumStateFingerprint } from '../lib/onlineTypes'
import type { OnlineMeta } from '../lib/types'
import {
  abandonOnlineRoom,
  classicResultFromFen,
  fetchOnlineRoom,
  getInviteUrl,
  isLegalMoveFromFen,
  initialRoomState,
  pushRoomState,
  subscribeToRoom,
  subscribeToRoomPresence,
} from '../lib/onlineRoom'
import type { QState } from '../lib/types'
import type { GameResult } from '../lib/types'
import { hashQuantumState } from '../lib/quantumEngine'

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
  const [opponentOnline, setOpponentOnline] = useState<boolean | null>(null)
  const [isPushing, setIsPushing] = useState(false)
  const applyingRemote = useRef(false)
  const pushingRef = useRef(false)
  const lastAppliedVersion = useRef(-1)
  const hasAbandonedRef = useRef(false)
  const roomRef = useRef<OnlineRoomRow | null>(null)
  const sawOpponentRef = useRef(false)
  const opponentGraceTimerRef = useRef<number | null>(null)

  const isOnline = enabled && !!online

  const syncRoom = useCallback((next: OnlineRoomRow | null) => {
    if (next?.state) {
      const expectedHash = next.state.type === 'quantum'
        ? hashQuantumState(next.state.qstate)
        : hashClassicState(next.state.fen, next.state.pgn)
      if (
        (next.state.stateHash && next.state.stateHash !== expectedHash)
        || (next.state.revision !== undefined && next.state.revision !== next.version)
      ) {
        setSyncError('STATE_HASH_MISMATCH')
      }
    }
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

  const refreshRoomFromServer = useCallback(async (): Promise<OnlineRoomRow | null> => {
    if (!online?.roomId) return null
    const fresh = await fetchOnlineRoom(online.roomId)
    if (fresh) {
      syncRoom(fresh)
      if (fresh.version > lastAppliedVersion.current) {
        lastAppliedVersion.current = fresh.version - 1
      }
    }
    return fresh
  }, [online?.roomId, syncRoom])

  const retryConnection = useCallback(async (): Promise<OnlineRoomRow | null> => {
    setOpponentLeft(false)
    setOpponentOnline(null)
    setSyncError(null)
    return refreshRoomFromServer()
  }, [refreshRoomFromServer])

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
    sawOpponentRef.current = false
    setOpponentLeft(false)
    setOpponentOnline(null)
    syncRoom(null)

    const clearOpponentGraceTimer = () => {
      if (opponentGraceTimerRef.current != null) {
        window.clearTimeout(opponentGraceTimerRef.current)
        opponentGraceTimerRef.current = null
      }
    }

    const unsubRoom = subscribeToRoom(online.roomId, {
      onRoom: (next) => syncRoom(next),
      onDeleted: () => {
        syncRoom(null)
        if (!hasAbandonedRef.current) setOpponentLeft(true)
      },
    })

    const unsubPresence = online.userId
      ? subscribeToRoomPresence(online.roomId, online.userId, {
          onPeers: (peerIds) => {
            const hasOpponent = peerIds.some((id) => id !== online.userId)
            if (hasOpponent) {
              clearOpponentGraceTimer()
              sawOpponentRef.current = true
              setOpponentOnline(true)
              setOpponentLeft(false)
              return
            }

            if (!sawOpponentRef.current) {
              setOpponentOnline(null)
              return
            }

            // 12 s: rival sin presencia en Realtime (corte de red), no abandono en BD.
            // La sala se borra con Menú, pagehide o cleanup_stale_rooms (15 min).
            clearOpponentGraceTimer()
            opponentGraceTimerRef.current = window.setTimeout(() => {
              setOpponentOnline(false)
              const current = roomRef.current
              if (current?.status === 'playing' && !hasAbandonedRef.current) {
                setOpponentLeft(true)
              }
            }, 12_000)
          },
        })
      : () => {}

    return () => {
      clearOpponentGraceTimer()
      unsubPresence()
      unsubRoom()
    }
  }, [isOnline, online?.roomId, online?.userId, syncRoom])

  const serverClassicFen =
    room?.state && typeof room.state === 'object' && 'type' in room.state && room.state.type === 'classic'
      ? room.state.fen
      : null

  const isMyTurn = isOnline && room ? room.status === 'playing' && room.turn === config.playerColor : true

  const isBoardInSync = useCallback(
    (localFen: string) => {
      if (!isOnline || !serverClassicFen) return true
      return localFen === serverClassicFen
    },
    [isOnline, serverClassicFen],
  )

  const canPlayMove = useCallback(
    (localFen: string) => isMyTurn && isBoardInSync(localFen),
    [isMyTurn, isBoardInSync],
  )

  const isQuantumSynced = useCallback(
    (local: QState) => {
      if (!isOnline || !room || room.state.type !== 'quantum') return true
      return quantumStateFingerprint(local) === quantumStateFingerprint(room.state.qstate)
    },
    [isOnline, room],
  )

  const pendingMeasurement: QPendingMeasurement | null =
    room?.state?.type === 'quantum' ? (room.state.pendingMeasurement ?? null) : null

  const isMeasurementBlocking =
    isOnline && !!pendingMeasurement

  const canPlayQuantumMove = useCallback(
    (localTurn: PieceColor, local: QState) => {
      if (!isOnline) return true
      if (isMeasurementBlocking) return false
      if (!isMyTurn || localTurn !== config.playerColor) return false
      return isQuantumSynced(local)
    },
    [isOnline, isMeasurementBlocking, isMyTurn, config.playerColor, isQuantumSynced],
  )

  const opponentConnected = isOnline && room
    ? Boolean(
        room.white_player_id &&
          room.black_player_id &&
          (room.status === 'playing' || room.status === 'finished') &&
          opponentOnline !== false,
      )
    : false

  const onlineStatus: OnlineStatus = !isOnline
    ? 'synced'
    : opponentLeft
      ? 'ended'
      : syncError
        ? 'conflict'
        : !room
          ? 'connecting'
          : room.status === 'finished'
            ? 'ended'
          : room.status === 'waiting' || !room.white_player_id || !room.black_player_id
            ? 'waiting'
            : opponentOnline === false
              ? 'reconnecting'
              : 'synced'

  const pushClassicState = useCallback(
    async (
      fen: string,
      turn: PieceColor,
      lastMove?: { from: string; to: string } | null,
      pgn?: string,
      metadata?: { clocks?: OnlineClockState; result?: GameResult | null },
    ) => {
      if (!online?.roomId || applyingRemote.current || pushingRef.current) return false
      pushingRef.current = true
      setIsPushing(true)
      try {
        let active = await waitForRoom()
        for (let attempt = 0; attempt < 2; attempt++) {
          if (!active || active.state.type !== 'classic') {
            setSyncError('ROOM_NOT_READY')
            return false
          }

          const serverFen = active.state.fen
          if (fen === serverFen) {
            setSyncError(null)
            return true
          }

          if (!lastMove || !isLegalMoveFromFen(serverFen, fen, lastMove)) {
            await refreshRoomFromServer()
            setSyncError('OUT_OF_SYNC')
            return false
          }

          const normalizedPgn = pgn ?? ''
          const state: ClassicRoomState = {
            type: 'classic',
            fen,
            lastMove,
            pgn: normalizedPgn,
            revision: active.version + 1,
            stateHash: hashClassicState(fen, normalizedPgn),
            rngCounter: 0,
            clocks: metadata?.clocks ?? active.state.clocks ?? { whiteTime: null, blackTime: null, paused: false },
            result: metadata?.result === undefined ? classicResultFromFen(fen) : metadata.result,
          }
          try {
            const updated = await pushRoomState(active.id, active.version, {
              state,
              turn,
              actorColor: config.playerColor,
            })
            syncRoom(updated)
            lastAppliedVersion.current = updated.version
            setSyncError(null)
            return true
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Sync error'
            if (msg !== 'VERSION_CONFLICT' || attempt === 1) throw e
            active = await refreshRoomFromServer()
          }
        }
        return false
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Sync error'
        if (msg === 'VERSION_CONFLICT') {
          await refreshRoomFromServer()
          setSyncError('CONFLICT')
        } else {
          setSyncError(msg)
        }
        return false
      } finally {
        pushingRef.current = false
        setIsPushing(false)
      }
    },
    [online?.roomId, config.playerColor, refreshRoomFromServer, syncRoom, waitForRoom],
  )

  const pushQuantumState = useCallback(
    async (
      qstate: QState,
      turn: PieceColor,
      pending: QPendingMeasurement | null | undefined = undefined,
      metadata?: { clocks?: OnlineClockState; result?: GameResult | null },
    ) => {
      if (!online?.roomId || applyingRemote.current || pushingRef.current) return false
      pushingRef.current = true
      setIsPushing(true)
      try {
        const active = await waitForRoom()
        if (!active) {
          setSyncError('ROOM_NOT_READY')
          return false
        }

        if (active.state.type !== 'quantum') {
          setSyncError('ROOM_NOT_READY')
          return false
        }

        const serverRoom = active.state
        const nextRoom: QuantumRoomState = {
          type: 'quantum',
          qstate,
          pendingMeasurement: pending === undefined ? (serverRoom.pendingMeasurement ?? null) : pending,
          revision: active.version + 1,
          stateHash: hashQuantumState(qstate),
          rngCounter: qstate.rngCounter,
          clocks: metadata?.clocks ?? serverRoom.clocks ?? { whiteTime: null, blackTime: null, paused: Boolean(pending) },
          result: metadata?.result === undefined
            ? qstate.gameOver ? { winner: qstate.gameOver.winner, cause: qstate.gameOver.cause } : null
            : metadata.result,
        }
        if (quantumRoomFingerprint(serverRoom) === quantumRoomFingerprint(nextRoom)) {
          setSyncError(null)
          return true
        }

        const onlyPendingChange =
          quantumStateFingerprint(serverRoom.qstate) === quantumStateFingerprint(qstate) &&
          quantumRoomFingerprint(serverRoom) !== quantumRoomFingerprint(nextRoom)

        if (active.turn !== config.playerColor && !onlyPendingChange) {
          await refreshRoomFromServer()
          setSyncError('OUT_OF_SYNC')
          return false
        }

        const updated = await pushRoomState(active.id, active.version, {
          state: nextRoom,
          turn,
          measurement_seed: active.measurement_seed,
          actorColor: config.playerColor,
        })
        syncRoom(updated)
        lastAppliedVersion.current = updated.version
        setSyncError(null)
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Sync error'
        if (msg === 'VERSION_CONFLICT') {
          await refreshRoomFromServer()
          setSyncError('CONFLICT')
        } else {
          setSyncError(msg)
        }
        return false
      } finally {
        pushingRef.current = false
        setIsPushing(false)
      }
    },
    [online?.roomId, config.playerColor, refreshRoomFromServer, syncRoom, waitForRoom],
  )

  const finishGame = useCallback(async (
    result?: GameResult | null,
    clocks?: OnlineClockState,
  ) => {
    if (!online?.roomId) return
    try {
      const active = await waitForRoom()
      if (!active || active.status === 'finished') return

      const derivedResult = active.state.type === 'classic'
        ? classicResultFromFen(active.state.fen)
        : active.state.qstate.gameOver
          ? {
              winner: active.state.qstate.gameOver.winner,
              cause: active.state.qstate.gameOver.cause,
            } satisfies GameResult
          : null
      const state: RoomGameState = {
        ...active.state,
        revision: active.version + 1,
        clocks: clocks ?? active.state.clocks,
        result: result === undefined ? derivedResult : result,
      }
      const updated = await pushRoomState(active.id, active.version, {
        state,
        turn: active.turn,
        status: 'finished',
        actorColor: config.playerColor,
      })
      syncRoom(updated)
      lastAppliedVersion.current = updated.version
    } catch {
      /* ignore */
    }
  }, [config.playerColor, online?.roomId, syncRoom, waitForRoom])

  const requestRematch = useCallback(async (): Promise<boolean> => {
    if (!online?.roomId) return false
    let active = await waitForRoom()
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!active || active.status !== 'finished') return false
      const votes = {
        w: active.state.rematch?.w ?? false,
        b: active.state.rematch?.b ?? false,
        [config.playerColor]: true,
      }
      const accepted = votes.w && votes.b
      const nextState = accepted
        ? {
            ...initialRoomState(active.mode),
            revision: active.version + 1,
            clocks: {
              whiteTime: config.useTimer ? config.timerMinutes * 60 : null,
              blackTime: config.useTimer ? config.timerMinutes * 60 : null,
              paused: false,
            },
            result: null,
            rematch: null,
          }
        : {
            ...active.state,
            revision: active.version + 1,
            rematch: votes,
          }
      try {
        const updated = await pushRoomState(active.id, active.version, {
          state: nextState,
          turn: accepted ? 'w' : active.turn,
          status: accepted ? 'playing' : 'finished',
          measurement_seed: accepted && active.measurement_seed
            ? `${active.measurement_seed}:r${active.version + 1}`
            : active.measurement_seed,
          actorColor: config.playerColor,
          move: accepted ? { type: 'rematch' } : { type: 'rematch-request' },
        })
        syncRoom(updated)
        lastAppliedVersion.current = updated.version
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (message !== 'VERSION_CONFLICT' || attempt === 1) return false
        active = await refreshRoomFromServer()
      }
    }
    return false
  }, [config.playerColor, config.timerMinutes, config.useTimer, online?.roomId, refreshRoomFromServer, syncRoom, waitForRoom])

  const copyInviteLink = useCallback(() => {
    if (!online?.code) return
    const url = getInviteUrl(online.code)
    void navigator.clipboard?.writeText(url)
  }, [online?.code])

  const shouldApplyRemote =
    isOnline && room && !pushingRef.current && room.version > lastAppliedVersion.current

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
    isBoardInSync,
    canPlayMove,
    isQuantumSynced,
    canPlayQuantumMove,
    pendingMeasurement,
    isMeasurementBlocking,
    opponentConnected,
    opponentOnline,
    opponentLeft,
    onlineStatus,
    isPushing,
    syncError,
    pushClassicState,
    pushQuantumState,
    finishGame,
    requestRematch,
    rematchRequestedByMe: Boolean(room?.state.rematch?.[config.playerColor]),
    rematchRequestedByOpponent: Boolean(room?.state.rematch?.[config.playerColor === 'w' ? 'b' : 'w']),
    leaveRoom,
    copyInviteLink,
    refreshRoomFromServer,
    retryConnection,
    shouldApplyRemote,
    markRemoteApplied,
    beginRemoteApply,
    endRemoteApply,
    validateClassicFen,
    remoteVersion: room?.version ?? 0,
    remoteState: room?.state ?? null,
    remoteTurn: room?.turn,
    serverClassicFen,
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
