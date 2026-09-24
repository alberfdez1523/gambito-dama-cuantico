import { useState, useEffect, useCallback } from 'react'
import { m } from 'framer-motion'
import type { GameConfig, GameMode, Language, OnlineMeta, PieceColor, PlayerColorChoice } from '../lib/types'
import {
  createOnlineRoom,
  joinOnlineRoom,
  startOnlineRoom,
  subscribeToRoom,
  getInviteUrl,
  isOnlineAvailable,
  ensureOnlineAuth,
} from '../lib/onlineRoom'
import type { OnlineRoomRow } from '../lib/onlineTypes'
import { ui } from '../lib/i18n'
import GameIcon from './GameIcon'

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
  const [color] = useState<PlayerColorChoice>(initialColor)
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? '')
  const [room, setRoom] = useState<OnlineRoomRow | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [assignedColor, setAssignedColor] = useState<PieceColor | null>(null)
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
      const myColor: PieceColor =
        assignedColor ??
        r.client_color ??
        (r.white_player_id === uid ? 'w' : r.black_player_id === uid ? 'b' : r.host_color)
      const isHost =
        myColor === r.host_color &&
        ((myColor === 'w' && r.white_player_id === uid) ||
          (myColor === 'b' && r.black_player_id === uid))
      return {
        roomId: r.id,
        code: r.code,
        myColor,
        isHost,
        userId: uid,
      }
    },
    [assignedColor],
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
      setAssignedColor(hostColor)
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
      const joinedColor =
        joined.client_color ??
        (joined.white_player_id === userId && joined.black_player_id !== userId ? 'w' : 'b')
      setAssignedColor(joinedColor)
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

  const copyLink = async () => {
    if (!room) return
    try {
      await navigator.clipboard.writeText(getInviteUrl(room.code))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(ui(language).inviteCopyFailed)
    }
  }

  const shareLink = async () => {
    if (!room) return
    const url = getInviteUrl(room.code)
    if (!navigator.share) {
      await copyLink()
      return
    }
    try {
      await navigator.share({
        title: 'Gambito de Dama Cuántico',
        text: ui(language).joinMyRoom(room.code),
        url,
      })
    } catch {
      // Cancelar la hoja nativa no es un error de partida.
    }
  }

  const handleBack = () => {
    onBack()
  }

  if (!supabaseReady) {
    return (
      <m.div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-0 px-6 text-center">
        <p className="text-ui-lg text-white">{t.onlineNotConfigured}</p>
        <p className="max-w-md text-ui-sm text-neutral-500">{t.onlineNotConfiguredHint}</p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-4 rounded border border-surface-4 px-6 py-3 text-ui-sm text-neutral-300"
        >
          {t.menu}
        </button>
      </m.div>
    )
  }

  return (
    <m.div className="min-h-screen bg-surface-0 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={handleBack}
          className="mb-6 inline-flex min-h-11 items-center gap-2 text-ui-sm text-neutral-500 hover:text-ink"
        >
          <GameIcon name="chevron" className="rotate-180" />
          {t.menu}
        </button>

        <m.div className="flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-4xl text-ink">{t.onlineTitle}</h1>
        </m.div>
        <p className="mt-2 text-ui-sm text-neutral-500">{t.onlineSubtitle}</p>

        {error && (
          <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-ui-sm text-red-300">
            {error}
          </p>
        )}

        {view === 'menu' && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <fieldset>
              <legend className="mb-3 block text-ui-sm font-semibold text-neutral-300">
                {t.gameMode}
              </legend>
              <m.div role="radiogroup" className="mb-5 flex rounded-lg bg-surface-2 p-1">
              {(['classic', 'quantum'] as GameMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={gameMode === m}
                  onClick={() => setGameMode(m)}
                  className={`min-h-[44px] flex-1 rounded-md py-3 text-ui-sm font-semibold ${
                    gameMode === m
                      ? m === 'quantum'
                        ? 'bg-surface-0 text-quantum shadow-subtle'
                        : 'bg-surface-0 text-accent shadow-subtle'
                      : 'text-neutral-500'
                  }`}
                >
                  {m === 'classic' ? t.modeClassical : t.modeQuantum}
                </button>
              ))}
              </m.div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setView('create')}
                  className={`min-h-[52px] w-full rounded-lg border px-5 text-ui-sm font-semibold ${gameMode === 'quantum' ? 'border-quantum bg-quantum/10 text-quantum' : 'border-accent bg-accent/5 text-accent'}`}
                >
                  {t.onlineCreateRoom}
                </button>
                <button
                  type="button"
                  onClick={() => setView('join')}
                  className="min-h-[52px] w-full rounded-lg bg-surface-2 px-5 text-ui-sm font-semibold text-neutral-300 hover:bg-surface-3"
                >
                  {t.onlineJoinRoom}
                </button>
              </div>
            </fieldset>

            <aside className="rounded-xl bg-surface-1 p-5" aria-label={ui(language).roomSummary}>
              <h2 className="text-ui-base font-semibold text-white">{ui(language).summary}</h2>
              <dl className="mt-5 space-y-4 text-ui-sm">
                <div className="flex justify-between gap-4"><dt className="text-neutral-500">{t.gameMode}</dt><dd className={gameMode === 'quantum' ? 'text-quantum' : 'text-accent'}>{gameMode === 'quantum' ? t.modeQuantum : t.modeClassical}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-neutral-500">{ui(language).clock}</dt><dd className="text-neutral-300">{useTimer ? `${timerMinutes} min` : ui(language).noClock}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-neutral-500">{ui(language).color}</dt><dd className="text-neutral-300">{color === 'random' ? (ui(language).random) : color === 'w' ? (ui(language).white) : (ui(language).black)}</dd></div>
              </dl>
              <p className="mt-6 text-ui-xs leading-relaxed text-neutral-500">{ui(language).multiplayerBetaNotice}</p>
            </aside>
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
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="border border-line bg-surface-1 p-6 text-center">
            <p className="text-ui-xs uppercase tracking-wider text-neutral-600">{t.onlineRoomCode}</p>
            <p className="my-5 font-mono text-4xl font-bold tracking-[0.28em] text-accent" aria-label={`${t.onlineRoomCode}: ${room.code}`}>{room.code}</p>
            <p className="text-ui-sm text-neutral-400">
              {room.black_player_id && room.white_player_id
                ? t.onlineBothConnected
                : t.onlineWaitingOpponent}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-surface-4 py-3 text-ui-sm text-neutral-300"
              >
                <GameIcon name="copy" />
                {copied ? t.copied : t.onlineCopyLink}
              </button>
              <button
                type="button"
                onClick={() => void shareLink()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-surface-4 py-3 text-ui-sm text-neutral-300"
              >
                <GameIcon name="share" />
                {ui(language).shareInvitation}
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
            <aside className="rounded-xl bg-surface-2 p-5 text-left">
              <h2 className="text-ui-base font-semibold text-white">{ui(language).players}</h2>
              <div className="mt-4 space-y-3">
                <LobbySeat label={room.white_player_id ? (room.white_player_id === userId ? (ui(language).you) : (ui(language).guest)) : (ui(language).waiting)} color="w" connected={!!room.white_player_id} language={language} />
                <LobbySeat label={room.black_player_id ? (room.black_player_id === userId ? (ui(language).you) : (ui(language).guest)) : (ui(language).waiting)} color="b" connected={!!room.black_player_id} language={language} />
              </div>
            </aside>
          </div>
        )}
      </div>
    </m.div>
  )
}

function LobbySeat({
  label,
  color,
  connected,
  language,
}: {
  label: string
  color: PieceColor
  connected: boolean
  language: Language
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface-1 p-3">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${color === 'w' ? 'player-avatar-white' : 'player-avatar-black'}`} aria-hidden="true">
        {color === 'w' ? '♔' : '♚'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-ui-sm font-semibold text-neutral-300">{label}</p>
        <p className="text-ui-xs text-neutral-500">{color === 'w' ? (ui(language).white) : (ui(language).black)}</p>
      </div>
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-surface-4'}`} aria-label={connected ? (ui(language).connected) : (ui(language).disconnected)} />
    </div>
  )
}
