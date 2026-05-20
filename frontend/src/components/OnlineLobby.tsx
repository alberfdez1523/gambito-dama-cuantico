import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { GameConfig, GameMode, Language, OnlineMeta, PieceColor, PlayerColorChoice } from '../lib/types'
import {
  createOnlineRoom,
  joinOnlineRoom,
  startOnlineRoom,
  subscribeToRoom,
  getInviteUrl,
  isOnlineAvailable,
  ensureOnlineAuth,
  abandonOnlineRoom,
} from '../lib/onlineRoom'
import type { OnlineRoomRow } from '../lib/onlineTypes'
import { ui } from '../lib/i18n'
import OnlineBetaNotice, { OnlineBetaBadge } from './OnlineBetaNotice'

interface OnlineLobbyProps {
  language: Language
  initialGameMode: GameMode
  initialColor: PlayerColorChoice
  useTimer: boolean
  timerMinutes: number
  difficulty: GameConfig['difficulty']
  initialJoinCode?: string | null
  onBack: () => void
  onRoomActive?: (roomId: string) => void
  onStart: (config: GameConfig) => void
}

type LobbyView = 'menu' | 'create' | 'join' | 'waiting'

export default function OnlineLobby({
  language,
  initialGameMode,
  initialColor,
  useTimer,
  timerMinutes,
  difficulty,
  initialJoinCode,
  onBack,
  onRoomActive,
  onStart,
}: OnlineLobbyProps) {
  const t = ui(language)
  const [view, setView] = useState<LobbyView>(initialJoinCode ? 'join' : 'menu')
  const [gameMode, setGameMode] = useState<GameMode>(initialGameMode)
  const [color, setColor] = useState<PlayerColorChoice>(initialColor)
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? '')
  const [room, setRoom] = useState<OnlineRoomRow | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const supabaseReady = isOnlineAvailable()

  useEffect(() => {
    if (!supabaseReady) return
    ensureOnlineAuth()
      .then(setUserId)
      .catch((e) => setError(e instanceof Error ? e.message : 'Auth error'))
  }, [supabaseReady])

  useEffect(() => {
    if (room?.id) onRoomActive?.(room.id)
  }, [room?.id, onRoomActive])

  useEffect(() => {
    if (!room?.id) return
    return subscribeToRoom(room.id, {
      onRoom: setRoom,
      onDeleted: () => {
        setRoom(null)
        setView('menu')
        setError(t.onlineOpponentLeftMessage)
      },
    })
  }, [room?.id, t.onlineOpponentLeftMessage])

  const resolveColor = (): PieceColor =>
    color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color

  const buildMeta = useCallback(
    (r: OnlineRoomRow, uid: string): OnlineMeta => {
      const isHost =
        (r.host_color === 'w' && r.white_player_id === uid) ||
        (r.host_color === 'b' && r.black_player_id === uid)
      const myColor: PieceColor =
        r.white_player_id === uid ? 'w' : r.black_player_id === uid ? 'b' : r.host_color
      return {
        roomId: r.id,
        code: r.code,
        myColor,
        isHost,
        userId: uid,
      }
    },
    [],
  )

  const tryStartGame = useCallback(
    (r: OnlineRoomRow, uid: string) => {
      if (r.status !== 'playing') return
      if (!r.white_player_id || !r.black_player_id) return
      const meta = buildMeta(r, uid)
      onStart({
        playerColor: meta.myColor,
        difficulty,
        opponentMode: 'online',
        useTimer,
        timerMinutes,
        gameMode: r.mode,
        online: meta,
      })
    },
    [buildMeta, difficulty, onStart, timerMinutes, useTimer],
  )

  useEffect(() => {
    if (!room || !userId) return
    tryStartGame(room, userId)
  }, [room, userId, tryStartGame])

  const handleCreate = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const hostColor = resolveColor()
      const config: GameConfig = {
        playerColor: hostColor,
        difficulty,
        opponentMode: 'online',
        useTimer,
        timerMinutes,
        gameMode,
      }
      const created = await createOnlineRoom(gameMode, hostColor, config)
      setRoom(created)
      setView('waiting')
    } catch (e) {
      setError(e instanceof Error ? e.message : t.onlineError)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!userId || !joinCode.trim()) return
    setLoading(true)
    setError(null)
    try {
      const joined = await joinOnlineRoom(joinCode)
      setRoom(joined)
      if (joined.status === 'playing') {
        tryStartGame(joined, userId)
      } else {
        setView('waiting')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'ROOM_NOT_FOUND') setError(t.onlineRoomNotFound)
      else if (msg === 'ROOM_FULL') setError(t.onlineRoomFull)
      else if (msg === 'ROOM_FINISHED') setError(t.onlineRoomFinished)
      else setError(msg || t.onlineError)
    } finally {
      setLoading(false)
    }
  }

  const handleHostStart = async () => {
    if (!room || !userId) return
    setLoading(true)
    try {
      const updated = await startOnlineRoom(room.id)
      setRoom(updated)
      tryStartGame(updated, userId)
    } catch (e) {
      setError(e instanceof Error ? e.message : t.onlineError)
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    if (!room) return
    void navigator.clipboard?.writeText(getInviteUrl(room.code))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleBack = () => {
    onBack()
  }

  useEffect(() => {
    if (!room?.id || view === 'menu') return
    const onPageHide = () => {
      void abandonOnlineRoom(room.id).catch((e) => console.error('[online] pagehide abandon:', e))
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [room?.id, view])

  if (!supabaseReady) {
    return (
      <motion.div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-0 px-6 text-center">
        <p className="text-ui-lg text-white">{t.onlineNotConfigured}</p>
        <p className="max-w-md text-ui-sm text-neutral-500">{t.onlineNotConfiguredHint}</p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-4 rounded border border-surface-4 px-6 py-3 text-ui-sm text-neutral-300"
        >
          {t.menu}
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div className="chess-grid-bg min-h-screen bg-surface-0 px-4 py-8">
      <div className="mx-auto max-w-md">
        <button
          type="button"
          onClick={handleBack}
          className="mb-6 text-ui-sm text-neutral-500 hover:text-white"
        >
          {t.menu}
        </button>

        <motion.div className="flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-2xl text-white">{t.onlineTitle}</h1>
          <OnlineBetaBadge language={language} />
        </motion.div>
        <p className="mt-2 text-ui-sm text-neutral-500">{t.onlineSubtitle}</p>
        <div className="mt-4">
          <OnlineBetaNotice language={language} />
        </div>

        {error && (
          <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-ui-sm text-red-300">
            {error}
          </p>
        )}

        {view === 'menu' && (
          <div className="mt-8 space-y-3">
            <label className="block text-ui-xs font-semibold uppercase tracking-wider text-neutral-600">
              {t.gameMode}
            </label>
            <motion.div className="mb-4 flex overflow-hidden rounded border border-surface-4">
              {(['classic', 'quantum'] as GameMode[]).map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setGameMode(m)}
                  className={`flex-1 py-3 text-ui-sm font-semibold ${i > 0 ? 'border-l border-surface-4' : ''} ${
                    gameMode === m
                      ? m === 'quantum'
                        ? 'bg-indigo-500/10 text-indigo-400'
                        : 'bg-accent/10 text-accent'
                      : 'text-neutral-500'
                  }`}
                >
                  {m === 'classic' ? t.modeClassical : t.modeQuantum}
                </button>
              ))}
            </motion.div>

            <button
              type="button"
              onClick={() => setView('create')}
              className="w-full rounded border-2 border-accent bg-accent/5 py-4 text-ui-sm font-semibold text-accent"
            >
              {t.onlineCreateRoom}
            </button>
            <button
              type="button"
              onClick={() => setView('join')}
              className="w-full rounded border border-surface-4 py-4 text-ui-sm font-semibold text-neutral-300"
            >
              {t.onlineJoinRoom}
            </button>
          </div>
        )}

        {view === 'create' && (
          <div className="mt-8 space-y-4">
            <p className="text-ui-sm text-neutral-400">{t.onlineCreateHint}</p>
            <button
              type="button"
              disabled={loading || !userId}
              onClick={() => void handleCreate()}
              className="w-full rounded border-2 border-accent py-4 text-ui-sm font-semibold text-accent disabled:opacity-50"
            >
              {loading ? t.onlineConnecting : t.onlineCreateRoom}
            </button>
            <button type="button" onClick={() => setView('menu')} className="text-ui-sm text-neutral-500">
              {t.cancel}
            </button>
          </div>
        )}

        {view === 'join' && (
          <div className="mt-8 space-y-4">
            <label htmlFor="room-code" className="text-ui-xs font-semibold uppercase text-neutral-600">
              {t.onlineRoomCode}
            </label>
            <input
              id="room-code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="w-full rounded border border-surface-4 bg-surface-1 px-4 py-3 text-center font-mono text-xl tracking-widest text-white"
              placeholder="ABC123"
            />
            <button
              type="button"
              disabled={loading || !joinCode.trim() || !userId}
              onClick={() => void handleJoin()}
              className="w-full rounded border-2 border-accent py-4 text-ui-sm font-semibold text-accent disabled:opacity-50"
            >
              {loading ? t.onlineConnecting : t.onlineJoinRoom}
            </button>
            <button type="button" onClick={() => setView('menu')} className="text-ui-sm text-neutral-500">
              {t.cancel}
            </button>
          </div>
        )}

        {view === 'waiting' && room && (
          <div className="mt-8 space-y-4 text-center">
            <p className="text-ui-xs uppercase tracking-wider text-neutral-600">{t.onlineRoomCode}</p>
            <p className="font-mono text-3xl font-bold tracking-[0.3em] text-accent">{room.code}</p>
            <p className="text-ui-sm text-neutral-400">
              {room.black_player_id && room.white_player_id
                ? t.onlineBothConnected
                : t.onlineWaitingOpponent}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="rounded border border-surface-4 py-3 text-ui-sm text-neutral-300"
              >
                {copied ? t.copied : t.onlineCopyLink}
              </button>
              {userId &&
                room.white_player_id === userId &&
                room.host_color === 'w' &&
                room.black_player_id && (
                  <button
                    type="button"
                    onClick={() => void handleHostStart()}
                    disabled={loading}
                    className="rounded border-2 border-accent py-3 text-ui-sm font-semibold text-accent"
                  >
                    {t.onlineStartGame}
                  </button>
                )}
              {userId &&
                room.black_player_id === userId &&
                room.host_color === 'b' &&
                room.white_player_id && (
                  <button
                    type="button"
                    onClick={() => void handleHostStart()}
                    disabled={loading}
                    className="rounded border-2 border-accent py-3 text-ui-sm font-semibold text-accent"
                  >
                    {t.onlineStartGame}
                  </button>
                )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
