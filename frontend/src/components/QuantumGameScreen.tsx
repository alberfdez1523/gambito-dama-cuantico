import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import QuantumBoard from './QuantumBoard'
import BoardSkeleton from './BoardSkeleton'
import PlayerBar from './PlayerBar'
import MoveHistory from './MoveHistory'
import EvalBar from './EvalBar'
import ActionButtons from './ActionButtons'
import MusicPlayer from './MusicPlayer'
import PromotionModal from './PromotionModal'
import GameOverModal from './GameOverModal'
import OnlineSessionEndedModal from './OnlineSessionEndedModal'
import QuantumMeasurementRoulette from './QuantumMeasurementRoulette'
import { useQuantumChess } from '../hooks/useQuantumChess'
import { useOnlineGameSync } from '../hooks/useOnlineGameSync'
import { useSoundFX } from '../hooks/useSoundFX'
import { useAmbientMusic } from '../hooks/useAmbientMusic'
import { useTimer } from '../hooks/useTimer'
import { getPlayerLabel, ui } from '../lib/i18n'
import type { AppSettings } from '../lib/settings'
import {
  pendingMeasurementFromLastMove,
  quantumRoomFingerprint,
  quantumStateFingerprint,
} from '../lib/onlineTypes'
import type { GameConfig, Language, PieceColor, QMoveMode, QState } from '../lib/types'

interface QuantumGameScreenProps {
  config: GameConfig
  onNewGame: () => void | Promise<void>
  language: Language
  settings: AppSettings
  onOpenSettings: () => void
  onSettingsChange: (partial: Partial<AppSettings>) => void
}

export default function QuantumGameScreen({
  config,
  onNewGame,
  language,
  settings,
  onOpenSettings,
  onSettingsChange,
}: QuantumGameScreenProps) {
  const sounds = useSoundFX(settings.sfxVolume)
  const music = useAmbientMusic(settings.musicVolume)
  const onlineSync = useOnlineGameSync({
    config,
    enabled: config.opponentMode === 'online',
  })
  const t = ui(language)

  const leavingRef = useRef(false)

  const handleLeaveToMenu = useCallback(async () => {
    if (leavingRef.current) return
    leavingRef.current = true
    try {
      await onNewGame()
    } finally {
      leavingRef.current = false
    }
  }, [onNewGame])

  useEffect(() => {
    if (!onlineSync.opponentLeft) return
    const id = window.setTimeout(() => handleLeaveToMenu(), 2500)
    return () => window.clearTimeout(id)
  }, [onlineSync.opponentLeft, handleLeaveToMenu])

  const loadQuantumRef = useRef<(q: QState) => void>(() => {})
  const turnRef = useRef<PieceColor>('w')
  const exportQStateRef = useRef<() => QState>(() => ({} as QState))
  const measurementEventRef = useRef(false)
  const hadPendingRef = useRef(false)
  const [measurementReleased, setMeasurementReleased] = useState(false)

  const onStateChange = useCallback(
    (engine: import('../lib/quantumEngine').QuantumChessEngine) => {
      if (config.opponentMode !== 'online') return
      const qstate = engine.exportState()
      const pending = pendingMeasurementFromLastMove(qstate, config.playerColor)
      void onlineSync.pushQuantumState(qstate, engine.state.turn, pending).then((ok) => {
        if (!ok && onlineSync.remoteState?.type === 'quantum') {
          loadQuantumRef.current(onlineSync.remoteState.qstate)
        }
      })
    },
    [config.opponentMode, config.playerColor, onlineSync],
  )

  const game = useQuantumChess(config, sounds, language, {
    onStateChange,
    canMove: () => {
      if (config.opponentMode !== 'online') return true
      if (measurementEventRef.current) return false
      return onlineSync.canPlayQuantumMove(turnRef.current, exportQStateRef.current())
    },
  })
  loadQuantumRef.current = game.loadQuantumState
  turnRef.current = game.turn
  exportQStateRef.current = game.exportState
  measurementEventRef.current = !!game.measurementEvent
  const isOnline = game.isOnline

  const handleDismissMeasurement = useCallback(() => {
    game.dismissMeasurement()
    if (config.opponentMode !== 'online') return
    void onlineSync.pushQuantumState(game.exportState(), game.turn, null)
  }, [config.opponentMode, game, onlineSync])
  const reduceMotion = useReducedMotion()
  const [boardReady, setBoardReady] = useState(false)
  const [mobileModesOpen, setMobileModesOpen] = useState(false)

  const pending = onlineSync.pendingMeasurement
  const isInitiator = pending?.initiator === config.playerColor
  const isWaitingOpponentMeasurement =
    isOnline && !!pending && !isInitiator
  const rouletteMeasurement =
    game.measurementEvent ??
    (isInitiator && pending ? pending.event : null)

  useEffect(() => {
    if (!isOnline) return
    if (hadPendingRef.current && !pending) {
      setMeasurementReleased(true)
      const id = window.setTimeout(() => setMeasurementReleased(false), 4500)
      return () => window.clearTimeout(id)
    }
    hadPendingRef.current = !!pending
  }, [isOnline, pending])

  useEffect(() => {
    const timer = setTimeout(() => setBoardReady(true), 80)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (music.volume !== settings.musicVolume) {
      music.setVolume(settings.musicVolume)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.musicVolume])

  const timer = useTimer({
    enabled: config.useTimer,
    minutes: config.timerMinutes,
    turn: game.turn,
    gameStarted: true,
    gameOver: game.gameOver,
  })

  useEffect(() => {
    if (timer.timedOut && !game.gameOverInfo) {
      game.handleTimedOut(timer.timedOut)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.timedOut])

  useEffect(() => {
    if (!onlineSync.shouldApplyRemote || !onlineSync.remoteState) return
    if (onlineSync.remoteState.type !== 'quantum') return

    const remoteRoom = onlineSync.remoteState
    const local = game.exportState()
    const localRoom = {
      type: 'quantum' as const,
      qstate: local,
      pendingMeasurement: onlineSync.pendingMeasurement,
    }
    if (quantumRoomFingerprint(localRoom) === quantumRoomFingerprint(remoteRoom)) {
      onlineSync.markRemoteApplied(onlineSync.remoteVersion)
      return
    }

    onlineSync.beginRemoteApply()
    game.loadQuantumState(remoteRoom.qstate)
    onlineSync.markRemoteApplied(onlineSync.remoteVersion)
    onlineSync.endRemoteApply()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineSync.remoteVersion])

  useEffect(() => {
    if (config.opponentMode !== 'online') return
    if (onlineSync.syncError !== 'CONFLICT' && onlineSync.syncError !== 'OUT_OF_SYNC') return
    const remote = onlineSync.remoteState
    if (remote?.type !== 'quantum') return
    const local = game.exportState()
    if (quantumRoomFingerprint({ type: 'quantum', qstate: local, pendingMeasurement: onlineSync.pendingMeasurement }) === quantumRoomFingerprint(remote)) return

    onlineSync.beginRemoteApply()
    game.loadQuantumState(remote.qstate)
    onlineSync.markRemoteApplied(onlineSync.remoteVersion)
    onlineSync.endRemoteApply()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineSync.syncError, onlineSync.remoteVersion])

  useEffect(() => {
    if (game.gameOverInfo && config.opponentMode === 'online') {
      void onlineSync.finishGame()
    }
  }, [game.gameOverInfo, config.opponentMode, onlineSync])

  const opponentColor: PieceColor = config.playerColor === 'w' ? 'b' : 'w'
  const topColor: PieceColor = game.boardFlipped ? config.playerColor : opponentColor
  const bottomColor: PieceColor = game.boardFlipped ? opponentColor : config.playerColor

  const labelForColor = (c: PieceColor) => {
    if (isOnline) return c === config.playerColor ? t.you : (language === 'es' ? 'Rival' : 'Opponent')
    return getPlayerLabel(c, language)
  }

  const classicHistory = useMemo(() => {
    return game.history.map((m) => ({
      color: m.color,
      from: m.from,
      to: m.to,
      piece: m.pieceType,
      captured: m.captured?.type,
      promotion: undefined,
      san: `${m.to}`,
      flags: '',
      description: m.description,
    }))
  }, [game.history])

  const topBar = useMemo(() => ({
    label: labelForColor(topColor),
    elo: '',
    color: topColor,
    isActive: game.turn === topColor && !game.gameOver,
    captures: [] as any[],
    materialDiff: 0,
    time: config.useTimer ? (topColor === 'w' ? timer.whiteTime : timer.blackTime) : null,
    isLow: config.useTimer ? (topColor === 'w' ? timer.whiteTime : timer.blackTime) < 60 : false,
  }), [topColor, config, game, timer, language])

  const bottomBar = useMemo(() => ({
    label: labelForColor(bottomColor),
    elo: '',
    color: bottomColor,
    isActive: game.turn === bottomColor && !game.gameOver,
    captures: [] as any[],
    materialDiff: 0,
    time: config.useTimer ? (bottomColor === 'w' ? timer.whiteTime : timer.blackTime) : null,
    isLow: config.useTimer ? (bottomColor === 'w' ? timer.whiteTime : timer.blackTime) < 60 : false,
  }), [bottomColor, config, game, timer, language])

  const modeLabels: Record<QMoveMode, { icon: string; label: string; desc: string }> = {
    classical: { icon: '♟', label: t.modeClassical, desc: t.modeClassicalDesc },
    quantum: { icon: '⚛', label: t.modeQuantum, desc: t.modeQuantumDesc },
    merge: { icon: '⊕', label: t.modeMerge, desc: t.modeMergeDesc },
  }

  const modeButtons: QMoveMode[] = ['classical', 'quantum', 'merge']

  const modeColor = (mode: QMoveMode, active: boolean) => {
    if (!active) return 'border-surface-4 bg-surface-2 text-neutral-500 hover:bg-surface-3 hover:text-neutral-300'
    if (mode === 'quantum') return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
    if (mode === 'merge') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
    return 'border-accent/30 bg-accent/10 text-accent'
  }

  const boardMotion = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, scale: 0.97 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.4, delay: 0.1 } }

  const renderModeButton = (mode: QMoveMode, compact = false) => {
    const info = modeLabels[mode]
    const active = game.moveMode === mode
    const enabled = game.availableMoveModes.includes(mode)
    return (
      <button
        key={mode}
        type="button"
        onClick={() => {
          game.chooseMoveMode(mode)
          setMobileModesOpen(false)
        }}
        disabled={!enabled || game.gameOver}
        className={`${compact ? 'min-w-[96px] shrink-0' : 'w-full'} rounded border px-3.5 py-3 text-left text-ui-sm transition-colors
          ${active ? modeColor(mode, true) : enabled && !game.gameOver ? modeColor(mode, false) : 'cursor-not-allowed border-surface-4 bg-surface-1 text-neutral-700'}`}
      >
        <span className="mr-2 text-sm">{info.icon}</span>
        <span className="font-semibold">{info.label}</span>
        {!compact && <span className="mt-0.5 block text-ui-sm text-neutral-500">{info.desc}</span>}
      </button>
    )
  }

  return (
    <div className="bg-atm-quantum flex min-h-screen flex-col bg-surface-0">
      <header className="flex items-center justify-between border-b border-surface-4 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <span className="font-serif text-lg text-indigo-400">⚛</span>
          <span className="hidden font-serif text-sm text-white sm:inline">GdD</span>
          <span className="text-ui-xs font-medium uppercase tracking-wider text-neutral-500">
            {isOnline
              ? `${t.onlineBadge}${config.online?.code ? ` · ${config.online.code}` : ''}`
              : t.quantumBadge}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenSettings}
            className="min-h-[44px] rounded px-3 py-1.5 text-ui-sm font-medium text-neutral-500 transition-colors hover:bg-surface-2 hover:text-white"
            aria-label={t.settings}
          >
            ⚙ {t.settings}
          </button>
          <button
            type="button"
            onClick={handleLeaveToMenu}
            className="min-h-[44px] rounded px-3 py-1.5 text-ui-sm font-medium text-neutral-500 transition-colors hover:bg-surface-2 hover:text-white"
          >
            {t.menu}
          </button>
        </div>
      </header>

      {isWaitingOpponentMeasurement && (
        <motion.div
          className="border-b border-indigo-500/25 bg-indigo-500/10 px-4 py-2.5 text-center text-ui-sm text-indigo-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {t.measurementPending}
        </motion.div>
      )}

      {measurementReleased && isOnline && onlineSync.isMyTurn && (
        <motion.div
          className="border-b border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-center text-ui-sm text-emerald-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {t.measurementCanMove}
        </motion.div>
      )}

      <div className="flex flex-1 items-start justify-center gap-0 px-4 py-4 lg:py-8">
        <motion.div
          className="hidden w-56 flex-col border-r border-surface-4 pr-4 lg:flex xl:w-64"
          initial={reduceMotion ? false : { opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.4, delay: 0.15 }}
        >
          <p className="mb-3 text-ui-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
            {t.moveTypes}
          </p>
          <div className="space-y-2">
            {modeButtons.map((mode) => renderModeButton(mode))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-ui-sm text-neutral-500" aria-live="polite">
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                game.status.type === 'player' ? 'bg-indigo-400'
                  : game.status.type === 'over' ? 'bg-red-400'
                  : 'bg-neutral-600'
              }`}
            />
            <span>{game.status.text}</span>
          </div>
          <p className="mt-3 text-ui-xs text-neutral-600" title={t.undoComingSoon}>
            ↩ {t.undoComingSoon}
          </p>
        </motion.div>

        <motion.div className="flex flex-col lg:px-6" {...boardMotion}>
          <PlayerBar {...topBar} />

          {!boardReady ? (
            <BoardSkeleton />
          ) : (
            <QuantumBoard
              board={game.board}
              selectedPiece={game.selectedPiece}
              legalTargets={game.legalTargets}
              mergeTargets={game.mergeTargets}
              moveMode={game.moveMode}
              firstQuantumTarget={game.firstQuantumTarget}
              lastMove={game.lastMove}
              boardFlipped={game.boardFlipped}
              isThinking={game.isThinking}
              playerColor={game.controlColor}
              onSquareClick={game.handleSquareClick}
              onDrop={game.handleDrop}
              language={language}
              statusText={game.status.text}
            />
          )}

          <PlayerBar {...bottomBar} />

          <div className="py-2 lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2" aria-live="polite">
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    game.status.type === 'player' ? 'bg-indigo-400'
                      : game.status.type === 'over' ? 'bg-red-400'
                      : 'bg-neutral-600'
                  }`}
                />
                <span className="text-ui-sm text-neutral-500">{game.status.text}</span>
              </div>
              {!game.gameOver && (
                <button
                  type="button"
                  onClick={() => setMobileModesOpen((v) => !v)}
                  className="min-h-[44px] rounded border border-surface-4 px-3 text-ui-xs font-semibold text-indigo-300"
                >
                  {modeLabels[game.moveMode].icon} {modeLabels[game.moveMode].label}
                </button>
              )}
            </div>

            {!game.gameOver && (
              <div className="-mx-1 mt-2 overflow-x-auto px-1 pb-1">
                <div className="flex gap-2">
                  {modeButtons.map((mode) => renderModeButton(mode, true))}
                </div>
              </div>
            )}

            {mobileModesOpen && !game.gameOver && (
              <div
                className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border border-surface-4 bg-surface-1 p-4 shadow-2xl lg:hidden"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                role="dialog"
                aria-label={t.moveTypes}
              >
                <p className="mb-3 text-ui-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
                  {t.moveTypes}
                </p>
                <div className="space-y-2">
                  {modeButtons.map((mode) => renderModeButton(mode))}
                </div>
              </div>
            )}
          </div>

          {(game.classicalCastleOptions.length > 0 || game.quantumCastleOptions.length > 0) && !game.gameOver && !game.isThinking && (
            <div className="flex flex-col gap-2" style={{ width: 'var(--board-size)' }}>
              {game.classicalCastleOptions.length > 0 && (
                <div className="flex gap-2">
                  {game.classicalCastleOptions.map((side) => (
                    <button
                      key={`classic-${side}`}
                      type="button"
                      onClick={() => game.doClassicalCastle(side)}
                      className="min-h-[44px] flex-1 rounded border border-accent/25 bg-accent/5 px-3 py-2 text-ui-sm font-medium text-accent transition-colors hover:bg-accent/15"
                    >
                      {t.castleShort(side)}
                    </button>
                  ))}
                </div>
              )}
              {game.quantumCastleOptions.length > 0 && (
                <div className="flex gap-2">
                  {game.quantumCastleOptions.map((side) => (
                    <button
                      key={`quantum-${side}`}
                      type="button"
                      onClick={() => game.doQuantumCastle(side)}
                      className="min-h-[44px] flex-1 rounded border border-indigo-500/25 bg-indigo-500/5 px-3 py-2 text-ui-sm font-medium text-indigo-400 transition-colors hover:bg-indigo-500/15"
                    >
                      {t.quantumCastle(side)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-2 flex w-full flex-col gap-2 lg:hidden" style={{ width: 'var(--board-size)' }}>
            <EvalBar
              chances={game.chances}
              playerColor={config.playerColor}
              language={language}
              variant="quantum-heuristic"
            />
            <MoveHistory history={classicHistory} language={language} />
          </div>
        </motion.div>

        <motion.div
          className="hidden w-72 flex-col border-l border-surface-4 lg:flex xl:w-80"
          initial={reduceMotion ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.4, delay: 0.2 }}
        >
          <div className="p-4">
            <EvalBar
              chances={game.chances}
              playerColor={config.playerColor}
              language={language}
              variant="quantum-heuristic"
            />
          </div>
          <div className="rule" />
          <div className="flex-1 overflow-hidden p-4">
            <MoveHistory history={classicHistory} language={language} />
          </div>
          <div className="rule" />
          <div className="p-4">
            <ActionButtons
              onUndo={() => {}}
              onFlip={game.flip}
              onResign={game.resign}
              canUndo={false}
              gameOver={game.gameOver}
              language={language}
              showUndo={false}
            />
            <p className="mt-2 text-ui-xs text-neutral-600">{t.undoComingSoon}</p>
          </div>
          <div className="rule" />
          <div className="p-4">
            <MusicPlayer
              playing={music.playing}
              volume={music.volume}
              onToggle={music.toggle}
              onVolumeChange={(v) => onSettingsChange({ musicVolume: v })}
              language={language}
            />
          </div>
        </motion.div>
      </div>

      <div
        className="flex items-center gap-2 border-t border-surface-4 px-4 py-2.5 lg:hidden"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex flex-1">
          <ActionButtons
            onUndo={() => {}}
            onFlip={game.flip}
            onResign={game.resign}
            canUndo={false}
            gameOver={game.gameOver}
            language={language}
            showUndo={false}
          />
        </div>
        <button
          type="button"
          onClick={music.toggle}
          className={`flex h-11 w-11 items-center justify-center rounded text-sm transition-colors
            ${music.playing ? 'bg-indigo-500/15 text-indigo-400' : 'text-neutral-600 hover:text-neutral-400'}`}
          aria-label={music.playing ? t.pause : t.play}
        >
          {music.playing ? '⏸' : '♫'}
        </button>
      </div>

      <PromotionModal
        visible={!!game.promotionPending}
        color={config.playerColor}
        onSelect={game.handlePromotion}
        language={language}
      />
      <GameOverModal
        info={game.gameOverInfo}
        onNewGame={handleLeaveToMenu}
        onDismiss={game.dismissGameOver}
        language={language}
      />
      <OnlineSessionEndedModal
        visible={onlineSync.opponentLeft}
        onMenu={handleLeaveToMenu}
        language={language}
      />
      <QuantumMeasurementRoulette
        visible={!!rouletteMeasurement}
        measurement={rouletteMeasurement}
        onClose={handleDismissMeasurement}
        language={language}
      />
    </div>
  )
}
