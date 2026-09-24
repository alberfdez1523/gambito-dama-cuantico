import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QuantumBoard from './QuantumBoard'
import BoardSkeleton from './BoardSkeleton'
import MoveHistory from './MoveHistory'
import EvalBar from './EvalBar'
import ActionButtons from './ActionButtons'
import MusicPlayer from './MusicPlayer'
import PromotionModal from './PromotionModal'
import GameOverModal from './GameOverModal'
import OnlineSessionEndedModal from './OnlineSessionEndedModal'
import QuantumMeasurementRoulette from './QuantumMeasurementRoulette'
import QuantumCapturePreviewModal from './QuantumCapturePreviewModal'
import GameScaffold from './GameScaffold'
import GameIcon, { type GameIconName } from './GameIcon'
import QuantumPieceInspector from './QuantumPieceInspector'
import GameReplayPanel from './GameReplayPanel'
import { useQuantumChess } from '../hooks/useQuantumChess'
import { useOnlineGameSync } from '../hooks/useOnlineGameSync'
import { useSoundFX } from '../hooks/useSoundFX'
import { useAmbientMusic } from '../hooks/useAmbientMusic'
import { useTimer } from '../hooks/useTimer'
import { usePlayerLabel } from '../hooks/usePlayerLabel'
import { ui } from '../lib/i18n'
import type { AppSettings } from '../lib/settings'
import {
  onlineResultToGameOverInfo,
  quantumRoomFingerprint,
} from '../lib/onlineTypes'
import type { GameConfig, GameResult, Language, PieceColor, PieceType, QMoveMode, QState } from '../lib/types'
import type { GameChromeModel, GameNotice, GameTone } from '../lib/gamePresentation'
import { gameAutosave, type GameAutosave } from '../lib/gameAutosave'
import { createSeededQuantumRng } from '../lib/quantumEngine'
import { createQuantumFinishedReplay } from '../lib/gameReplay'
import { saveFinishedReplay } from '../lib/replayStore'

interface QuantumGameScreenProps {
  config: GameConfig
  onNewGame: () => void | Promise<void>
  language: Language
  settings: AppSettings
  onOpenSettings: () => void
  onSettingsChange: (partial: Partial<AppSettings>) => void
  resumeAutosave?: GameAutosave | null
  onRematch?: () => void
}

export default function QuantumGameScreen({
  config,
  onNewGame,
  language,
  settings,
  onOpenSettings,
  onSettingsChange,
  resumeAutosave = null,
  onRematch,
}: QuantumGameScreenProps) {
  const sounds = useSoundFX(settings.sfxVolume, settings.haptics)
  const music = useAmbientMusic(settings.musicVolume)
  const onlineSync = useOnlineGameSync({
    config,
    enabled: config.opponentMode === 'online',
  })
  const getQuantumRng = useCallback((counter: number) => {
    const seed = onlineSync.room?.measurement_seed
    return seed ? createSeededQuantumRng(seed, counter) : Math.random
  }, [onlineSync.room?.measurement_seed])
  const t = ui(language)
  const syncedGameOverInfo = useMemo(() => {
    const result = onlineSync.room?.state.result
    return result ? onlineResultToGameOverInfo(result, config.playerColor, language) : null
  }, [config.playerColor, language, onlineSync.room?.state.result])

  const leavingRef = useRef(false)
  const onlineClockRef = useRef({
    whiteTime: config.useTimer ? config.timerMinutes * 60 : null,
    blackTime: config.useTimer ? config.timerMinutes * 60 : null,
    paused: false,
  })

  const handleLeaveToMenu = useCallback(async () => {
    if (leavingRef.current) return
    leavingRef.current = true
    try {
      await onNewGame()
    } finally {
      leavingRef.current = false
    }
  }, [onNewGame])

  const loadQuantumRef = useRef<(q: QState) => void>(() => {})
  const turnRef = useRef<PieceColor>('w')
  const exportQStateRef = useRef<() => QState>(() => ({} as QState))
  const measurementEventRef = useRef(false)
  const measurementBlockingRef = useRef(false)
  const hadPendingRef = useRef(false)
  const [measurementReleased, setMeasurementReleased] = useState(false)
  const [replayOpen, setReplayOpen] = useState(false)
  const finishedReplaySavedRef = useRef(false)

  const onStateChange = useCallback(
    (engine: import('../lib/quantumEngine').QuantumChessEngine, meta?: import('../hooks/useQuantumChess').QuantumStateChangeMeta) => {
      if (config.opponentMode !== 'online') return
      const qstate = engine.exportState()
      const pending = meta?.pendingMeasurement ?? null
      void onlineSync.pushQuantumState(qstate, engine.state.turn, pending, {
        clocks: { ...onlineClockRef.current, paused: Boolean(pending) },
      }).then((ok) => {
        if (!ok && onlineSync.remoteState?.type === 'quantum') {
          loadQuantumRef.current(onlineSync.remoteState.qstate)
        }
      })
    },
    [config.opponentMode, onlineSync],
  )

  const game = useQuantumChess(config, sounds, language, {
    onStateChange,
    getRng: getQuantumRng,
    canMove: () => {
      if (measurementBlockingRef.current) return false
      if (config.opponentMode !== 'online') return true
      if (measurementEventRef.current) return false
      return onlineSync.canPlayQuantumMove(turnRef.current, exportQStateRef.current())
    },
  })
  loadQuantumRef.current = game.loadQuantumState
  turnRef.current = game.turn
  exportQStateRef.current = game.exportState
  measurementEventRef.current = !!game.measurementEvent || game.isMeasurementBlocking
  measurementBlockingRef.current = game.isMeasurementBlocking
  const isOnline = game.isOnline
  const isAIMode = config.opponentMode === 'ai'
  const [boardReady, setBoardReady] = useState(false)

  const pending = onlineSync.pendingMeasurement
  const isInitiator = !pending || pending.initiator === config.playerColor
  const rouletteMeasurement = game.measurementEvent ?? pending?.event ?? null
  const showMeasurementRoulette = !!rouletteMeasurement && (game.isMeasurementBlocking || !!pending)

  const handleDismissMeasurement = useCallback(() => {
    if (isOnline && pending && pending.initiator !== config.playerColor) return
    game.dismissMeasurement()
    if (config.opponentMode !== 'online') return
    void onlineSync.pushQuantumState(game.exportState(), game.turn, null)
  }, [config.opponentMode, config.playerColor, game, onlineSync, isOnline, pending])

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
    paused: showMeasurementRoulette,
  })
  onlineClockRef.current = {
    whiteTime: config.useTimer ? timer.whiteTime : null,
    blackTime: config.useTimer ? timer.blackTime : null,
    paused: showMeasurementRoulette,
  }

  const restoreAttemptedRef = useRef(false)
  const autosaveEndedRef = useRef(false)
  const [resumeHydrated, setResumeHydrated] = useState(!resumeAutosave)

  useEffect(() => {
    if (!resumeAutosave || restoreAttemptedRef.current) return
    restoreAttemptedRef.current = true

    const matchesConfig = resumeAutosave.type === 'quantum'
      && config.gameMode === 'quantum'
      && resumeAutosave.config.opponentMode === config.opponentMode
      && resumeAutosave.config.playerColor === config.playerColor

    if (matchesConfig && resumeAutosave.type === 'quantum') {
      game.loadQuantumState(
        resumeAutosave.qstate,
        resumeAutosave.lastMove,
        resumeAutosave.replayActions,
        resumeAutosave.replaySnapshots,
      )
      timer.restore(resumeAutosave.clocks)
    }
    setResumeHydrated(true)
    // `game` y `timer` cambian en cada render; sus métodos usados aquí son estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.gameMode, config.opponentMode, config.playerColor, game.loadQuantumState, resumeAutosave, timer.restore])

  useEffect(() => {
    if (timer.timedOut && !game.gameOverInfo) {
      game.handleTimedOut(timer.timedOut)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.timedOut])

  useEffect(() => {
    const opponentMode = config.opponentMode
    if (opponentMode === 'online') return
    if (game.gameOver) {
      autosaveEndedRef.current = true
      gameAutosave.clear()
      return
    }
    if (!resumeHydrated || autosaveEndedRef.current) return

    const timeoutId = window.setTimeout(() => {
      gameAutosave.save({
        type: 'quantum',
        config: {
          gameMode: 'quantum',
          opponentMode,
          playerColor: config.playerColor,
          difficulty: config.difficulty,
          useTimer: config.useTimer,
          timerMinutes: config.timerMinutes,
          rulesetId: config.rulesetId ?? 'quantum-standard',
          timeControl: config.timeControl,
          options: config.options,
        },
        qstate: game.exportState(),
        replayActions: game.replayActions,
        replaySnapshots: game.replaySnapshots,
        lastMove: game.lastMove,
        clocks: { whiteTime: timer.whiteTime, blackTime: timer.blackTime },
      })
    }, 200)

    return () => window.clearTimeout(timeoutId)
    // Se guarda cuando cambia el tablero, no en cada render del objeto `game`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.difficulty,
    config.gameMode,
    config.opponentMode,
    config.options,
    config.playerColor,
    config.rulesetId,
    config.timeControl,
    config.timerMinutes,
    config.useTimer,
    game.board,
    game.gameOver,
    game.history,
    game.lastMove,
    game.turn,
    resumeHydrated,
    timer.blackTime,
    timer.whiteTime,
  ])

  useEffect(() => {
    const result = game.gameOverInfo ?? syncedGameOverInfo
    const initialState = game.replaySnapshots[0]
    if (!result || !initialState || finishedReplaySavedRef.current || game.history.length === 0) return
    finishedReplaySavedRef.current = true
    void saveFinishedReplay(createQuantumFinishedReplay(
      initialState,
      game.exportState(),
      game.replayActions,
      config,
      result,
    ))
  }, [config, game, syncedGameOverInfo])

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
    const clocks = remoteRoom.clocks
    if (clocks && clocks.whiteTime !== null && clocks.blackTime !== null) {
      timer.restore({ whiteTime: clocks.whiteTime, blackTime: clocks.blackTime })
    }
    game.syncRemotePendingMeasurement(remoteRoom.pendingMeasurement ?? null)
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
    game.syncRemotePendingMeasurement(remote.pendingMeasurement ?? null)
    onlineSync.markRemoteApplied(onlineSync.remoteVersion)
    onlineSync.endRemoteApply()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineSync.syncError, onlineSync.remoteVersion])

  useEffect(() => {
    if (game.gameOverInfo && config.opponentMode === 'online') {
      const qResult = game.exportState().gameOver
      let result: GameResult | null = qResult
        ? { winner: qResult.winner, cause: qResult.cause }
        : null
      if (timer.timedOut) {
        result = { winner: timer.timedOut === 'w' ? 'b' : 'w', cause: 'timeout' }
      } else if (/rendici|resign/i.test(`${game.gameOverInfo.title} ${game.gameOverInfo.message}`)) {
        result = { winner: config.playerColor === 'w' ? 'b' : 'w', cause: 'resignation' }
      }
      void onlineSync.finishGame(result, onlineClockRef.current)
    }
  }, [config.opponentMode, config.playerColor, game, onlineSync, timer.timedOut])

  const opponentColor: PieceColor = config.playerColor === 'w' ? 'b' : 'w'
  const topColor: PieceColor = game.boardFlipped ? config.playerColor : opponentColor
  const bottomColor: PieceColor = game.boardFlipped ? opponentColor : config.playerColor

  const labelForColor = usePlayerLabel({
    playerColor: config.playerColor,
    language,
    isAIMode,
    isOnline,
    aiName: ui(language).quantumAi,
  })

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
    turnLabel: game.turn === topColor && !game.gameOver ? (ui(language).toMove) : undefined,
    accent: 'quantum' as const,
    captures: [] as PieceType[],
    materialDiff: 0,
    time: config.useTimer ? (topColor === 'w' ? timer.whiteTime : timer.blackTime) : null,
    isLow: config.useTimer ? (topColor === 'w' ? timer.whiteTime : timer.blackTime) < 60 : false,
    coherence: game.coherence ? {
      used: game.coherence[topColor].used,
      limit: game.coherence[topColor].limit,
      label: ui(language).coherenceUsed,
    } : undefined,
  }), [topColor, config, game, timer, labelForColor, language])

  const bottomBar = useMemo(() => ({
    label: labelForColor(bottomColor),
    elo: '',
    color: bottomColor,
    isActive: game.turn === bottomColor && !game.gameOver,
    turnLabel: game.turn === bottomColor && !game.gameOver ? (ui(language).toMove) : undefined,
    accent: 'quantum' as const,
    captures: [] as PieceType[],
    materialDiff: 0,
    time: config.useTimer ? (bottomColor === 'w' ? timer.whiteTime : timer.blackTime) : null,
    isLow: config.useTimer ? (bottomColor === 'w' ? timer.whiteTime : timer.blackTime) < 60 : false,
    coherence: game.coherence ? {
      used: game.coherence[bottomColor].used,
      limit: game.coherence[bottomColor].limit,
      label: ui(language).coherenceUsed,
    } : undefined,
  }), [bottomColor, config, game, timer, labelForColor, language])

  const modeLabels: Record<QMoveMode, { icon: GameIconName; label: string; desc: string }> = {
    classical: { icon: 'classic', label: t.modeClassical, desc: t.modeClassicalDesc },
    quantum: { icon: 'atom', label: t.modeQuantum, desc: t.modeQuantumDesc },
    merge: { icon: 'merge', label: t.modeMerge, desc: t.modeMergeDesc },
  }

  const modeButtons: QMoveMode[] = ['classical', 'quantum', 'merge']

  const modeColor = (mode: QMoveMode, active: boolean) => {
    if (!active) return 'border-surface-4 bg-surface-2 text-neutral-500 hover:bg-surface-3 hover:text-neutral-300'
    if (mode === 'quantum') return 'border-quantum/30 bg-quantum/10 text-quantum'
    if (mode === 'merge') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
    return 'border-accent/30 bg-accent/10 text-accent'
  }

  const onlineStatusText = onlineSync.isPushing
    ? t.onlineSyncing
    : onlineSync.onlineStatus === 'connecting'
      ? t.onlineStatusConnecting
      : onlineSync.onlineStatus === 'waiting'
        ? t.onlineStatusWaiting
        : onlineSync.onlineStatus === 'reconnecting'
          ? t.onlineStatusReconnecting
          : onlineSync.onlineStatus === 'conflict'
            ? t.onlineStatusConflict
            : onlineSync.onlineStatus === 'ended'
              ? t.onlineStatusEnded
              : t.onlineStatusSynced

  const renderModeButton = (mode: QMoveMode, compact = false) => {
    const info = modeLabels[mode]
    const active = game.moveMode === mode
    const enabled = game.availableMoveModes.includes(mode)
    return (
      <button
        key={mode}
        type="button"
        data-testid={`quantum-mode-${mode}`}
        aria-pressed={active}
        aria-label={`${info.label}: ${info.desc}`}
        onClick={() => game.chooseMoveMode(mode)}
        disabled={!enabled || game.gameOver}
        className={`${compact ? 'flex min-h-[36px] min-w-0 flex-1 items-center justify-center gap-1 px-1.5 py-1.5' : 'block w-full px-3.5 py-3 text-left'} rounded border text-ui-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quantum/70
          ${active ? modeColor(mode, true) : enabled && !game.gameOver ? modeColor(mode, false) : 'cursor-not-allowed border-surface-4 bg-surface-1 text-neutral-700'}`}
      >
        <GameIcon name={info.icon} className={compact ? 'h-3.5 w-3.5' : 'mr-2 h-4 w-4'} />
        <span className={`font-semibold ${compact ? 'truncate text-[11px] leading-tight' : ''}`}>{info.label}</span>
        {!compact && <span className="mt-0.5 block text-ui-sm text-neutral-500">{info.desc}</span>}
      </button>
    )
  }

  const showMeasureBanner = showMeasurementRoulette
  const showReleasedBanner = measurementReleased && isOnline && onlineSync.isMyTurn && !pending
  const showAiErrorBanner = isAIMode && !!game.engineError
  const hasCastleButtons =
    (game.classicalCastleOptions.length > 0 || game.quantumCastleOptions.length > 0)
    && !game.gameOver && !game.isThinking && !game.isMeasurementBlocking

  const connectionTone: GameTone = onlineSync.isPushing
    ? 'warning'
    : onlineSync.onlineStatus === 'synced'
      ? 'success'
      : onlineSync.onlineStatus === 'conflict' || onlineSync.onlineStatus === 'ended'
        ? 'danger'
        : 'neutral'

  const notices: GameNotice[] = []
  if (showMeasureBanner) {
    notices.push({
      id: 'quantum-measurement',
      tone: 'neutral',
      priority: 'high',
      message: isInitiator
        ? ui(language).measurementSpinHint
        : ui(language).measurementShareHint,
    })
  }
  if (showReleasedBanner) {
    notices.push({
      id: 'quantum-measurement-released',
      tone: 'success',
      priority: 'normal',
      message: t.measurementCanMove,
    })
  }
  if (showAiErrorBanner) {
    notices.push({
      id: 'quantum-ai-fallback',
      tone: 'warning',
      priority: 'normal',
      message: ui(language).quantumAiMoveFailed,
      action: {
        label: ui(language).engineErrorRetry,
        onSelect: game.retryAIMove,
      },
    })
  }
  if (isOnline && onlineSync.syncError) {
    notices.push({
      id: 'quantum-sync',
      tone: onlineSync.syncError === 'CONFLICT' || onlineSync.syncError === 'OUT_OF_SYNC' ? 'warning' : 'danger',
      priority: 'high',
      message:
        onlineSync.syncError === 'CONFLICT' || onlineSync.syncError === 'OUT_OF_SYNC'
          ? ui(language).quantumStateResynced
          : `${ui(language).syncError}${onlineSync.syncError}`,
      action: {
        label: ui(language).reconnect,
        onSelect: () => void onlineSync.retryConnection(),
      },
    })
  }

  const quantumState = game.exportState()
  const selectedRailPiece = game.selectedPiece
    ? quantumState.pieces[game.selectedPiece.id]
    : null

  const chromeModel: GameChromeModel = {
    language,
    variant: 'quantum',
    modeLabel: isOnline
      ? `${t.quantumBadge} · ${t.onlineBadge}`
      : isAIMode
        ? (language === 'es'
            ? `${config.rulesetId === 'quantum-coherence' ? 'Coherencia limitada' : 'Cuántico'} vs IA · ${config.difficulty}`
            : `${config.rulesetId === 'quantum-coherence' ? 'Limited coherence' : 'Quantum'} vs AI · ${config.difficulty}`)
        : config.rulesetId === 'quantum-coherence'
          ? (ui(language).limitedCoherence)
          : t.quantumBadge,
    roomCode: isOnline ? config.online?.code : undefined,
    connection: isOnline ? { label: onlineStatusText, tone: connectionTone } : undefined,
    players: { top: topBar, bottom: bottomBar },
    status: {
      message: game.status.text,
      tone:
        game.status.type === 'player'
          ? 'accent'
          : game.status.type === 'thinking'
            ? 'warning'
            : game.status.type === 'over'
              ? 'danger'
              : 'neutral',
    },
    notices,
    labels: {
      settings: t.settings,
      menu: t.menu,
      openInspector: ui(language).openQuantumInspector,
      inspectorTitle: ui(language).quantumInspector,
      tabs: {
        game: ui(language).game,
        history: ui(language).history,
        analysis: ui(language).analysis,
      },
    },
  }

  const actionButtons = (
    <ActionButtons
      onUndo={game.undo}
      onFlip={game.flip}
      onResign={game.resign}
      canUndo={game.canUndo}
      gameOver={game.gameOver}
      language={language}
      showUndo={!isOnline}
    />
  )

  const mobileActionButtons = (
    <ActionButtons
      onUndo={game.undo}
      onFlip={game.flip}
      onResign={game.resign}
      canUndo={game.canUndo}
      gameOver={game.gameOver}
      language={language}
      showUndo={!isOnline}
      compact
    />
  )

  const pieceInspector = (
    <QuantumPieceInspector
      state={quantumState}
      board={game.board}
      selectedPiece={game.selectedPiece}
      legalTargets={game.legalTargets}
      mergeTargets={game.mergeTargets}
      moveMode={game.moveMode}
      firstQuantumTarget={game.firstQuantumTarget}
      language={language}
      showHints={settings.showHints}
    />
  )

  return (
    <GameScaffold
      model={chromeModel}
      hasCastleButtons={hasCastleButtons}
      onOpenSettings={onOpenSettings}
      onLeave={handleLeaveToMenu}
      contextRail={(
        <div className="space-y-5 py-1">
          {game.coherence && (
            <section className="border border-cyan-400/25 bg-cyan-500/[0.06] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-ui-xs font-semibold text-cyan-300">
                  {ui(language).limitedCoherence}
                </p>
                <span className="font-mono text-ui-xs text-cyan-300">
                  {game.coherence[game.turn].used}/{game.coherence[game.turn].limit}
                </span>
              </div>
              <div className="mt-3 flex gap-1" aria-hidden="true">
                {Array.from({ length: game.coherence[game.turn].limit }, (_, index) => (
                  <span
                    key={index}
                    className={`h-2 flex-1 border ${index < game.coherence![game.turn].used ? 'border-cyan-300 bg-cyan-300' : 'border-cyan-300/30 bg-transparent'}`}
                  />
                ))}
              </div>
              <p className="mt-3 text-[0.68rem] leading-5 text-neutral-500">
                {ui(language).coherenceCostHint}
              </p>
            </section>
          )}
          <section>
            <p className="mb-3 text-ui-xs font-semibold text-neutral-400">
              {t.moveTypes}
            </p>
            <div className="space-y-2" role="group" aria-label={t.moveTypes}>
              {modeButtons.map((mode) => renderModeButton(mode))}
            </div>
          </section>
          {selectedRailPiece ? (
            <section className="border-t border-surface-4 pt-4">
              <p className="text-ui-xs font-semibold text-neutral-400">
                {ui(language).selection}
              </p>
              <p className="mt-2 text-ui-sm font-medium text-ink">
                {game.selectedPiece?.square} · {Object.keys(selectedRailPiece.positions).length}{' '}
                {ui(language).branchesPlural}
              </p>
              <p className="mt-1 font-mono text-ui-xs text-neutral-600">
                {Object.keys(selectedRailPiece.positions).join(' / ')}
              </p>
            </section>
          ) : (
            <p className="border-t border-surface-4 pt-4 text-ui-xs leading-relaxed text-neutral-600">
              {ui(language).selectPieceToInspect}
            </p>
          )}
        </div>
      )}
      board={
        !boardReady ? (
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
              turnColor={game.turn}
              onSquareClick={game.handleSquareClick}
              onDrop={game.handleDrop}
              language={language}
              statusText={game.status.text}
              checkSquare={game.checkSquare}
              entanglements={quantumState.entanglements}
            />
          )
      }
      boardControls={(
        <div className="space-y-1.5">
          <div className="game-quantum-controls lg:hidden">
            <p className="mb-1 text-ui-xs font-semibold text-neutral-500">
                {t.moveTypes}
            </p>
            <div className="flex gap-1" role="group" aria-label={t.moveTypes}>
              {modeButtons.map((mode) => renderModeButton(mode, true))}
            </div>
          </div>
          {hasCastleButtons && (
            <div className="flex flex-wrap gap-1.5">
              {game.classicalCastleOptions.map((side) => (
                <button
                  key={`classic-${side}`}
                  type="button"
                  onClick={() => game.doClassicalCastle(side)}
                  className="min-h-[36px] min-w-0 flex-1 rounded border border-accent/25 bg-accent/5 px-2 py-1 text-ui-xs font-medium text-accent transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                >
                  {t.castleShort(side)}
                </button>
              ))}
              {game.quantumCastleOptions.map((side) => (
                <button
                  key={`quantum-${side}`}
                  type="button"
                  onClick={() => game.doQuantumCastle(side)}
                  className="min-h-[36px] min-w-0 flex-1 rounded border border-quantum/25 bg-quantum/5 px-2 py-1 text-ui-xs font-medium text-quantum transition-colors hover:bg-quantum/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quantum/70"
                >
                  {t.quantumCastle(side)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      inspector={{
        game: (
          <div className="space-y-5">
            {pieceInspector}
            <div className="rule" />
            {actionButtons}
            <p className="text-ui-xs leading-relaxed text-neutral-600">
              {isOnline ? t.quantumUndoOnlineDisabled : t.quantumUndoReady}
            </p>
            <div className="rule" />
            <MusicPlayer
              playing={music.playing}
              volume={music.volume}
              onToggle={music.toggle}
              onVolumeChange={(v) => onSettingsChange({ musicVolume: v })}
              language={language}
            />
          </div>
        ),
        history: <MoveHistory history={classicHistory} language={language} variant="sheet" />,
        analysis: (
          <div className="space-y-4">
            <EvalBar
              chances={game.chances}
              playerColor={config.playerColor}
              language={language}
              variant="quantum-heuristic"
            />
            <p className="text-ui-xs leading-relaxed text-neutral-600">
              {ui(language).expectedMaterialHint}
            </p>
          </div>
        ),
      }}
      mobileActions={mobileActionButtons}
      mobileAccessory={(
        <button
          type="button"
          onClick={music.toggle}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quantum/70 ${
            music.playing ? 'bg-quantum/15 text-quantum' : 'text-neutral-600 hover:text-neutral-400'
          }`}
          aria-label={music.playing ? t.pause : t.play}
        >
          <GameIcon name={music.playing ? 'pause' : 'music'} />
        </button>
      )}
      overlays={(
        <>
          <PromotionModal
            visible={!!game.promotionPending}
            color={config.playerColor}
            onSelect={game.handlePromotion}
            language={language}
          />
          <QuantumCapturePreviewModal
            preview={game.capturePreview}
            language={language}
            onConfirm={game.confirmComplexCapture}
            onCancel={game.cancelComplexCapture}
          />
          <GameOverModal
            info={game.gameOverInfo ?? syncedGameOverInfo}
            onNewGame={handleLeaveToMenu}
            onRematch={isOnline ? () => void onlineSync.requestRematch() : onRematch}
            onReplay={() => setReplayOpen(true)}
            rematchPending={isOnline && onlineSync.rematchRequestedByMe}
            opponentRequestedRematch={isOnline && onlineSync.rematchRequestedByOpponent}
            language={language}
          />
          <OnlineSessionEndedModal
            visible={onlineSync.opponentLeft}
            onMenu={handleLeaveToMenu}
            onRetry={() => void onlineSync.retryConnection()}
            language={language}
          />
          {replayOpen && (
            <GameReplayPanel
              variant="quantum"
              snapshots={game.replaySnapshots}
              actions={game.replayActions}
              rulesetId={config.rulesetId === 'quantum-coherence' ? 'quantum-coherence' : 'quantum-standard'}
              maxCoherence={config.options?.maxCoherence}
              playerColor={config.playerColor}
              language={language}
              onClose={() => setReplayOpen(false)}
            />
          )}
          <QuantumMeasurementRoulette
            visible={showMeasurementRoulette}
            measurement={rouletteMeasurement}
            onClose={handleDismissMeasurement}
            canDismiss={!isOnline || isInitiator}
            autoResolve={settings.autoResolveMeasurements}
            timeoutSeconds={isOnline ? 15 : undefined}
            language={language}
          />
        </>
      )}
    />
  )
}
