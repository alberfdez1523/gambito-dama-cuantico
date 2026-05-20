import { useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Board from './Board'
import BoardSkeleton from './BoardSkeleton'
import PlayerBar from './PlayerBar'
import MoveHistory from './MoveHistory'
import EvalBar from './EvalBar'
import ActionButtons from './ActionButtons'
import MusicPlayer from './MusicPlayer'
import PromotionModal from './PromotionModal'
import GameOverModal from './GameOverModal'
import OnlineSessionEndedModal from './OnlineSessionEndedModal'
import { useChessGame } from '../hooks/useChessGame'
import { useOnlineGameSync } from '../hooks/useOnlineGameSync'
import { useSoundFX } from '../hooks/useSoundFX'
import { useAmbientMusic } from '../hooks/useAmbientMusic'
import { useTimer } from '../hooks/useTimer'
import { DIFFICULTIES } from '../lib/constants'
import { getDifficultyLabel, getPlayerLabel, ui } from '../lib/i18n'
import type { AppSettings } from '../lib/settings'
import type { GameConfig, Language } from '../lib/types'

interface GameScreenProps {
  config: GameConfig
  onNewGame: () => void | Promise<void>
  language: Language
  settings: AppSettings
  onOpenSettings: () => void
  onSettingsChange: (partial: Partial<AppSettings>) => void
}

export default function GameScreen({
  config,
  onNewGame,
  language,
  settings,
  onOpenSettings,
  onSettingsChange,
}: GameScreenProps) {
  const sounds = useSoundFX(settings.sfxVolume)
  const music = useAmbientMusic(settings.musicVolume)
  const onlineSync = useOnlineGameSync({
    config,
    enabled: config.opponentMode === 'online',
  })
  const t = ui(language)
  const reduceMotion = useReducedMotion()

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

  const onMoveApplied = useCallback(
    async (
      fen: string,
      nextTurn: import('../lib/types').PieceColor,
      lastMove: { from: string; to: string },
      pgn: string,
    ) => {
      if (config.opponentMode === 'online') {
        await onlineSync.pushClassicState(fen, nextTurn, lastMove, pgn)
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

  useEffect(() => {
    if (timer.timedOut && !game.gameOverInfo) {
      game.handleTimedOut(timer.timedOut)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.timedOut])

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
      void onlineSync.finishGame()
    }
  }, [game.gameOverInfo, config.opponentMode, onlineSync])

  const diffMeta = DIFFICULTIES.find((d) => d.key === config.difficulty)
  const isAIMode = config.opponentMode === 'ai'
  const isOnline = game.isOnline
  const opponentColor = config.playerColor === 'w' ? 'b' : 'w'
  const aiColor = opponentColor
  const topColor = game.boardFlipped ? config.playerColor : opponentColor
  const bottomColor = game.boardFlipped ? opponentColor : config.playerColor

  const labelForColor = (c: typeof topColor) => {
    if (isAIMode) return c === config.playerColor ? t.you : 'Stockfish'
    if (isOnline) return c === config.playerColor ? t.you : (language === 'es' ? 'Rival' : 'Opponent')
    return getPlayerLabel(c, language)
  }

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
      time: config.useTimer ? (topColor === 'w' ? timer.whiteTime : timer.blackTime) : null,
      isLow: config.useTimer ? (topColor === 'w' ? timer.whiteTime : timer.blackTime) < 60 : false,
    }
  }, [topColor, config, diffMeta, game, timer, isAIMode, isOnline, language, t.you])

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
      time: config.useTimer ? (bottomColor === 'w' ? timer.whiteTime : timer.blackTime) : null,
      isLow: config.useTimer ? (bottomColor === 'w' ? timer.whiteTime : timer.blackTime) < 60 : false,
    }
  }, [bottomColor, config, diffMeta, game, timer, isAIMode, isOnline, language, t.you])

  const modeBadge = isAIMode
    ? t.classicModeBadge(diffMeta ? getDifficultyLabel(config.difficulty, language) : '')
    : isOnline
      ? `${t.onlineBadge}${config.online?.code ? ` · ${config.online.code}` : ''}`
      : t.classic2P

  const boardMotion = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, scale: 0.97 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.4, delay: 0.1 } }

  return (
    <div className="bg-atm-gold flex min-h-screen flex-col bg-surface-0">
      <header className="flex items-center justify-between border-b border-surface-4 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <span className="font-serif text-lg text-accent">♛</span>
          <span className="hidden font-serif text-sm text-white sm:inline">GdD</span>
          <span className="text-ui-xs font-medium uppercase tracking-wider text-neutral-500">
            {modeBadge}
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

      {onlineSync.syncError && isOnline && (
        <motion.div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-center text-ui-sm text-amber-200">
          {onlineSync.syncError === 'CONFLICT' || onlineSync.syncError === 'OUT_OF_SYNC'
            ? language === 'es'
              ? 'Tablero resincronizado con el servidor.'
              : 'Board resynced with server.'
            : `${language === 'es' ? 'Error de sincronización: ' : 'Sync error: '}${onlineSync.syncError}`}
        </motion.div>
      )}

      {(game.engineError || game.evalError) && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2.5">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3 text-center text-ui-sm text-red-300">
            <span>{game.engineError || game.evalError}</span>
            {game.engineError && (
              <button
                type="button"
                onClick={game.retryAIMove}
                className="min-h-[44px] rounded border border-red-400/40 px-3 py-1.5 font-semibold text-red-200 transition-colors hover:bg-red-500/20"
              >
                {t.engineErrorRetry}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 items-start justify-center gap-0 px-4 py-4 lg:py-8">
        <motion.div className="flex flex-col" {...boardMotion}>
          <PlayerBar {...topBar} />

          {!game.boardReady ? (
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
          )}

          <PlayerBar {...bottomBar} />

          <div className="flex items-center justify-center gap-2 py-2" aria-live="polite" aria-atomic="true">
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                game.status.type === 'player' ? 'bg-accent'
                  : game.status.type === 'thinking' ? 'bg-yellow-500 animate-pulse'
                  : game.status.type === 'over' ? 'bg-red-400'
                  : 'bg-neutral-600'
              }`}
            />
            <span className="text-ui-sm text-neutral-500">{game.status.text}</span>
          </div>

          {game.classicalCastleOptions.length > 0 && !game.gameOver && !game.isThinking && (
            <div className="flex gap-2" style={{ width: 'var(--board-size)' }}>
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

          <div className="mt-2 flex w-full flex-col gap-2 lg:hidden" style={{ width: 'var(--board-size)' }}>
            <EvalBar chances={game.chances} playerColor={config.playerColor} language={language} />
            <MoveHistory history={game.history} language={language} pgn={game.pgn} showCopy />
          </div>
        </motion.div>

        <motion.div
          className="hidden w-72 flex-col border-l border-surface-4 lg:flex xl:w-80"
          initial={reduceMotion ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.4, delay: 0.2 }}
        >
          <div className="p-4">
            <EvalBar chances={game.chances} playerColor={config.playerColor} language={language} />
          </div>
          <div className="rule" />
          <div className="flex-1 overflow-hidden p-4">
            <MoveHistory history={game.history} language={language} pgn={game.pgn} showCopy />
          </div>
          <div className="rule" />
          <div className="p-4">
            <ActionButtons
              onUndo={game.undo}
              onFlip={game.flip}
              onResign={game.resign}
              canUndo={game.history.length >= 2 && !game.isThinking}
              gameOver={game.gameOver}
              language={language}
              showUndo={!isOnline}
            />
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
            onUndo={game.undo}
            onFlip={game.flip}
            onResign={game.resign}
            canUndo={game.history.length >= 2 && !game.isThinking}
            gameOver={game.gameOver}
            language={language}
          />
        </div>
        <button
          type="button"
          onClick={music.toggle}
          className={`flex h-11 w-11 items-center justify-center rounded text-sm transition-colors
            ${music.playing ? 'bg-accent/15 text-accent' : 'text-neutral-600 hover:text-neutral-400'}`}
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
    </div>
  )
}
