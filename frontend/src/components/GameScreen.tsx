import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Board from './Board'
import BoardSkeleton from './BoardSkeleton'
import MoveHistory from './MoveHistory'
import EvalBar from './EvalBar'
import ActionButtons from './ActionButtons'
import MusicPlayer from './MusicPlayer'
import PromotionModal from './PromotionModal'
import GameOverModal from './GameOverModal'
import OnlineSessionEndedModal from './OnlineSessionEndedModal'
import GameScaffold from './GameScaffold'
import GameIcon from './GameIcon'
import GameReplayPanel from './GameReplayPanel'
import { useChessGame } from '../hooks/useChessGame'
import { useOnlineGameSync } from '../hooks/useOnlineGameSync'
import { useSoundFX } from '../hooks/useSoundFX'
import { useAmbientMusic } from '../hooks/useAmbientMusic'
import { useTimer } from '../hooks/useTimer'
import { DIFFICULTIES } from '../lib/constants'
import { getDifficultyLabel, getPlayerLabel, ui } from '../lib/i18n'
import type { AppSettings } from '../lib/settings'
import type { GameConfig, GameResult, Language, PieceColor } from '../lib/types'
import type { GameChromeModel, GameNotice, GameTone } from '../lib/gamePresentation'
import { gameAutosave, type GameAutosave } from '../lib/gameAutosave'
import { classicResultFromFen } from '../lib/onlineRoom'
import { onlineResultToGameOverInfo } from '../lib/onlineTypes'
import { createClassicFinishedReplay } from '../lib/gameReplay'
import { saveFinishedReplay } from '../lib/replayStore'

interface GameScreenProps {
  config: GameConfig
  onNewGame: () => void | Promise<void>
  language: Language
  settings: AppSettings
  onOpenSettings: () => void
  onSettingsChange: (partial: Partial<AppSettings>) => void
  resumeAutosave?: GameAutosave | null
  onRematch?: () => void
}

export default function GameScreen({
  config,
  onNewGame,
  language,
  settings,
  onOpenSettings,
  onSettingsChange,
  resumeAutosave = null,
  onRematch,
}: GameScreenProps) {
  const sounds = useSoundFX(settings.sfxVolume, settings.haptics)
  const music = useAmbientMusic(settings.musicVolume)
  const onlineSync = useOnlineGameSync({
    config,
    enabled: config.opponentMode === 'online',
  })
  const t = ui(language)
  const syncedGameOverInfo = useMemo(() => {
    const result = onlineSync.room?.state.result
    return result ? onlineResultToGameOverInfo(result, config.playerColor, language) : null
  }, [config.playerColor, language, onlineSync.room?.state.result])
  const leavingRef = useRef(false)
  const [replayOpen, setReplayOpen] = useState(false)
  const finishedReplaySavedRef = useRef(false)
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

  const onMoveApplied = useCallback(
    async (
      fen: string,
      nextTurn: import('../lib/types').PieceColor,
      lastMove: { from: string; to: string },
      pgn: string,
    ) => {
      if (config.opponentMode === 'online') {
        await onlineSync.pushClassicState(fen, nextTurn, lastMove, pgn, {
          clocks: onlineClockRef.current,
        })
      }
    },
    [config.opponentMode, onlineSync],
  )

  const localFenRef = useRef('')
  const game = useChessGame(config, sounds, language, {
    onMoveApplied,
    canMove: () => config.opponentMode !== 'online' || onlineSync.canPlayMove(localFenRef.current),
  })
  localFenRef.current = game.fen

  const timer = useTimer({
    enabled: config.useTimer,
    minutes: config.timerMinutes,
    turn: game.turn,
    gameStarted: true,
    gameOver: game.gameOver,
  })
  onlineClockRef.current = {
    whiteTime: config.useTimer ? timer.whiteTime : null,
    blackTime: config.useTimer ? timer.blackTime : null,
    paused: false,
  }

  const restoreAttemptedRef = useRef(false)
  const autosaveEndedRef = useRef(false)
  const [resumeHydrated, setResumeHydrated] = useState(!resumeAutosave)

  useEffect(() => {
    if (!resumeAutosave || restoreAttemptedRef.current) return
    restoreAttemptedRef.current = true

    const matchesConfig = resumeAutosave.type === 'classic'
      && config.gameMode === 'classic'
      && resumeAutosave.config.opponentMode === config.opponentMode
      && resumeAutosave.config.playerColor === config.playerColor

    if (matchesConfig && resumeAutosave.type === 'classic') {
      game.loadFen(resumeAutosave.fen, resumeAutosave.lastMove, resumeAutosave.pgn)
      timer.restore(resumeAutosave.clocks)
    }
    setResumeHydrated(true)
    // `game` y `timer` cambian en cada render; sus métodos usados aquí son estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.gameMode, config.opponentMode, config.playerColor, game.loadFen, resumeAutosave, timer.restore])

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
        type: 'classic',
        config: {
          gameMode: 'classic',
          opponentMode,
          playerColor: config.playerColor,
          difficulty: config.difficulty,
          useTimer: config.useTimer,
          timerMinutes: config.timerMinutes,
          rulesetId: 'classic',
          timeControl: config.timeControl,
          options: {},
        },
        fen: game.fen,
        pgn: game.pgn,
        history: game.history,
        lastMove: game.lastMove,
        clocks: { whiteTime: timer.whiteTime, blackTime: timer.blackTime },
      })
    }, 200)

    return () => window.clearTimeout(timeoutId)
  }, [
    config.difficulty,
    config.gameMode,
    config.opponentMode,
    config.timeControl,
    config.playerColor,
    config.timerMinutes,
    config.useTimer,
    game.fen,
    game.gameOver,
    game.history,
    game.lastMove,
    game.pgn,
    resumeHydrated,
    timer.blackTime,
    timer.whiteTime,
  ])

  useEffect(() => {
    const result = game.gameOverInfo ?? syncedGameOverInfo
    if (!result || finishedReplaySavedRef.current || game.history.length === 0) return
    finishedReplaySavedRef.current = true
    void saveFinishedReplay(createClassicFinishedReplay(game.history, config, result))
  }, [config, game.gameOverInfo, game.history, syncedGameOverInfo])

  useEffect(() => {
    if (music.volume !== settings.musicVolume) {
      music.setVolume(settings.musicVolume)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.musicVolume])

  useEffect(() => {
    if (!onlineSync.shouldApplyRemote || !onlineSync.remoteState) return
    if (onlineSync.remoteState.type !== 'classic') return
    if (!onlineSync.validateClassicFen(onlineSync.remoteState.fen)) return
    const remote = onlineSync.remoteState
    if (game.fen === remote.fen && game.pgn === (remote.pgn ?? '')) {
      onlineSync.markRemoteApplied(onlineSync.remoteVersion)
      return
    }

    onlineSync.beginRemoteApply()
    game.loadFen(
      onlineSync.remoteState.fen,
      onlineSync.remoteState.lastMove ?? null,
      onlineSync.remoteState.pgn,
    )
    const clocks = remote.clocks
    if (clocks && clocks.whiteTime !== null && clocks.blackTime !== null) {
      timer.restore({ whiteTime: clocks.whiteTime, blackTime: clocks.blackTime })
    }
    onlineSync.markRemoteApplied(onlineSync.remoteVersion)
    onlineSync.endRemoteApply()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineSync.remoteVersion, game.fen])

  useEffect(() => {
    if (config.opponentMode !== 'online') return
    if (onlineSync.syncError !== 'CONFLICT' && onlineSync.syncError !== 'OUT_OF_SYNC') return
    const remote = onlineSync.remoteState
    if (remote?.type !== 'classic' || !onlineSync.validateClassicFen(remote.fen)) return
    if (game.fen === remote.fen) return

    onlineSync.beginRemoteApply()
    game.loadFen(remote.fen, remote.lastMove ?? null, remote.pgn)
    onlineSync.markRemoteApplied(onlineSync.remoteVersion)
    onlineSync.endRemoteApply()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineSync.syncError, onlineSync.remoteVersion])

  useEffect(() => {
    if (game.gameOverInfo && config.opponentMode === 'online') {
      let result: GameResult | null = classicResultFromFen(game.fen)
      if (timer.timedOut) {
        result = { winner: timer.timedOut === 'w' ? 'b' : 'w', cause: 'timeout' }
      } else if (/rendici|resign/i.test(`${game.gameOverInfo.title} ${game.gameOverInfo.message}`)) {
        result = { winner: config.playerColor === 'w' ? 'b' : 'w', cause: 'resignation' }
      }
      void onlineSync.finishGame(result, onlineClockRef.current)
    }
  }, [config.opponentMode, config.playerColor, game.fen, game.gameOverInfo, onlineSync, timer.timedOut])

  const diffMeta = DIFFICULTIES.find((d) => d.key === config.difficulty)
  const isAIMode = config.opponentMode === 'ai'
  const isOnline = game.isOnline
  const opponentColor = config.playerColor === 'w' ? 'b' : 'w'
  const topColor = game.boardFlipped ? config.playerColor : opponentColor
  const bottomColor = game.boardFlipped ? opponentColor : config.playerColor

  const labelForColor = useCallback((c: PieceColor) => {
    if (isAIMode) return c === config.playerColor ? t.you : 'Stockfish'
    if (isOnline) return c === config.playerColor ? t.you : (language === 'es' ? 'Rival' : 'Opponent')
    return getPlayerLabel(c, language)
  }, [config.playerColor, isAIMode, isOnline, language, t.you])

  const topBar = useMemo(() => {
    const isAI = isAIMode && topColor !== config.playerColor
    return {
      label: labelForColor(topColor),
      elo: isAI ? diffMeta?.elo || '' : '',
      color: topColor,
      captures:
        topColor === config.playerColor ? game.captures.player : game.captures.ai,
      materialDiff:
        topColor === config.playerColor ? game.materialDiff : -game.materialDiff,
      isActive: game.turn === topColor && !game.gameOver,
      turnLabel: game.turn === topColor && !game.gameOver ? (language === 'es' ? 'Mueve' : 'To move') : undefined,
      time: config.useTimer ? (topColor === 'w' ? timer.whiteTime : timer.blackTime) : null,
      isLow: config.useTimer ? (topColor === 'w' ? timer.whiteTime : timer.blackTime) < 60 : false,
    }
  }, [topColor, config, diffMeta, game, timer, isAIMode, labelForColor, language])

  const bottomBar = useMemo(() => {
    const isAI = isAIMode && bottomColor !== config.playerColor
    return {
      label: labelForColor(bottomColor),
      elo: isAI ? diffMeta?.elo || '' : '',
      color: bottomColor,
      captures:
        bottomColor === config.playerColor ? game.captures.player : game.captures.ai,
      materialDiff:
        bottomColor === config.playerColor ? game.materialDiff : -game.materialDiff,
      isActive: game.turn === bottomColor && !game.gameOver,
      turnLabel: game.turn === bottomColor && !game.gameOver ? (language === 'es' ? 'Mueve' : 'To move') : undefined,
      time: config.useTimer ? (bottomColor === 'w' ? timer.whiteTime : timer.blackTime) : null,
      isLow: config.useTimer ? (bottomColor === 'w' ? timer.whiteTime : timer.blackTime) < 60 : false,
    }
  }, [bottomColor, config, diffMeta, game, timer, isAIMode, labelForColor, language])

  const modeBadge = isAIMode
    ? t.classicModeBadge(diffMeta ? getDifficultyLabel(config.difficulty, language) : '')
    : isOnline
      ? t.onlineBadge
      : t.classic2P

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

  const showSyncBanner = !!(onlineSync.syncError && isOnline)
  const showEngineBanner = !!(game.engineError || game.evalError)
  const hasCastleButtons =
    game.classicalCastleOptions.length > 0 && !game.gameOver && !game.isThinking

  const connectionTone: GameTone = onlineSync.isPushing
    ? 'warning'
    : onlineSync.onlineStatus === 'synced'
      ? 'success'
      : onlineSync.onlineStatus === 'conflict' || onlineSync.onlineStatus === 'ended'
        ? 'danger'
        : 'neutral'

  const notices: GameNotice[] = []
  if (showSyncBanner) {
    notices.push({
      id: 'classic-sync',
      tone: onlineSync.syncError === 'CONFLICT' || onlineSync.syncError === 'OUT_OF_SYNC' ? 'warning' : 'danger',
      priority: 'high',
      message:
        onlineSync.syncError === 'CONFLICT' || onlineSync.syncError === 'OUT_OF_SYNC'
          ? language === 'es'
            ? 'Tablero resincronizado con el servidor.'
            : 'Board resynced with server.'
          : `${language === 'es' ? 'Error de sincronización: ' : 'Sync error: '}${onlineSync.syncError}`,
      action: {
        label: language === 'es' ? 'Reconectar' : 'Reconnect',
        onSelect: () => void onlineSync.retryConnection(),
      },
    })
  }
  if (showEngineBanner) {
    notices.push({
      id: 'classic-engine',
      tone: 'danger',
      priority: 'high',
      message: game.engineError || game.evalError || '',
      action: game.engineError
        ? { label: t.engineErrorRetry, onSelect: game.retryAIMove }
        : undefined,
    })
  }

  const chromeModel: GameChromeModel = {
    language,
    variant: 'classic',
    modeLabel: modeBadge,
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
      openInspector: language === 'es' ? 'Abrir inspector de partida' : 'Open game inspector',
      inspectorTitle: language === 'es' ? 'Inspector de partida' : 'Game inspector',
      tabs: {
        game: language === 'es' ? 'Partida' : 'Game',
        history: language === 'es' ? 'Historial' : 'History',
        analysis: language === 'es' ? 'Análisis' : 'Analysis',
      },
    },
  }

  const actionButtons = (
    <ActionButtons
      onUndo={game.undo}
      onFlip={game.flip}
      onResign={game.resign}
      canUndo={game.history.length >= (isAIMode ? 2 : 1) && !game.isThinking}
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
      canUndo={game.history.length >= (isAIMode ? 2 : 1) && !game.isThinking}
      gameOver={game.gameOver}
      language={language}
      showUndo={!isOnline}
      compact
    />
  )

  return (
    <GameScaffold
      model={chromeModel}
      hasCastleButtons={hasCastleButtons}
      onOpenSettings={onOpenSettings}
      onLeave={handleLeaveToMenu}
      board={
        !game.boardReady ? (
          <BoardSkeleton />
        ) : (
          <Board
            fen={game.fen}
            selectedSquare={game.selectedSquare}
            legalSquares={game.legalSquares}
            lastMove={game.lastMove}
            boardFlipped={game.boardFlipped}
            isThinking={game.isThinking}
            playerColor={game.controlColor}
            checkSquare={game.checkSquare}
            getPiece={game.getPiece}
            onSquareClick={game.handleSquareClick}
            onDrop={game.handleDrop}
            language={language}
            statusText={game.status.text}
          />
        )
      }
      boardControls={
        hasCastleButtons ? (
          <div className="flex gap-2">
            {game.classicalCastleOptions.map((side) => (
              <button
                key={`classic-${side}`}
                type="button"
                onClick={() => game.doClassicalCastle(side)}
                className="min-h-[40px] flex-1 rounded border border-accent/25 bg-accent/5 px-2 py-1.5 text-ui-xs font-medium text-accent transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 lg:min-h-[44px] lg:text-ui-sm"
              >
                {t.castleShort(side)}
              </button>
            ))}
          </div>
        ) : undefined
      }
      inspector={{
        game: (
          <div className="space-y-5">
            <section>
              <p className="text-ui-xs font-semibold text-neutral-400">
                {language === 'es' ? 'Estado actual' : 'Current state'}
              </p>
              <p className="mt-1 text-ui-sm leading-relaxed text-neutral-500">{game.status.text}</p>
            </section>
            <div className="rule" />
            {actionButtons}
            {isOnline ? (
              <p className="text-ui-xs leading-relaxed text-neutral-600">
                {language === 'es' ? 'Deshacer no está disponible en partidas en línea.' : 'Undo is unavailable in online games.'}
              </p>
            ) : null}
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
        history: (
          <MoveHistory history={game.history} language={language} pgn={game.pgn} showCopy variant="sheet" />
        ),
        analysis: (
          <div className="space-y-4">
            <EvalBar chances={game.chances} playerColor={config.playerColor} language={language} />
            <p className="text-ui-xs leading-relaxed text-neutral-600">
              {language === 'es'
                ? 'La evaluación compara la posición actual desde tu color.'
                : 'The evaluation compares the current position from your colour.'}
            </p>
          </div>
        ),
      }}
      mobileActions={mobileActionButtons}
      mobileAccessory={(
        <button
          type="button"
          onClick={music.toggle}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${
            music.playing ? 'bg-accent/15 text-accent' : 'text-neutral-600 hover:text-neutral-400'
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
              variant="classic"
              history={game.history}
              playerColor={config.playerColor}
              language={language}
              onClose={() => setReplayOpen(false)}
            />
          )}
        </>
      )}
    />
  )
}
