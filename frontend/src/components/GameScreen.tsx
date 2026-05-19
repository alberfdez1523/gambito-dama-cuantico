import { useEffect, useMemo } from 'react'
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
import { useChessGame } from '../hooks/useChessGame'
import { useSoundFX } from '../hooks/useSoundFX'
import { useAmbientMusic } from '../hooks/useAmbientMusic'
import { useTimer } from '../hooks/useTimer'
import { DIFFICULTIES } from '../lib/constants'
import { getDifficultyLabel, getPlayerLabel, ui } from '../lib/i18n'
import type { AppSettings } from '../lib/settings'
import type { GameConfig, Language } from '../lib/types'

interface GameScreenProps {
  config: GameConfig
  onNewGame: () => void
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
  const game = useChessGame(config, sounds, language)
  const t = ui(language)
  const reduceMotion = useReducedMotion()

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

  const diffMeta = DIFFICULTIES.find((d) => d.key === config.difficulty)
  const isAIMode = config.opponentMode === 'ai'
  const aiColor = config.playerColor === 'w' ? 'b' : 'w'
  const topColor = game.boardFlipped ? config.playerColor : aiColor
  const bottomColor = game.boardFlipped ? aiColor : config.playerColor

  const topBar = useMemo(() => {
    const isAI = isAIMode && topColor !== config.playerColor
    const localLabel = getPlayerLabel(topColor, language)
    return {
      label: isAIMode ? (isAI ? 'Stockfish' : t.you) : localLabel,
      elo: isAI ? diffMeta?.elo || '' : '',
      color: topColor,
      captures: isAI ? game.captures.ai : game.captures.player,
      materialDiff: isAI ? -game.materialDiff : game.materialDiff,
      isActive: game.turn === topColor && !game.gameOver,
      time: config.useTimer ? (topColor === 'w' ? timer.whiteTime : timer.blackTime) : null,
      isLow: config.useTimer ? (topColor === 'w' ? timer.whiteTime : timer.blackTime) < 60 : false,
    }
  }, [topColor, config, diffMeta, game, timer, isAIMode, language, t.you])

  const bottomBar = useMemo(() => {
    const isAI = isAIMode && bottomColor !== config.playerColor
    const localLabel = getPlayerLabel(bottomColor, language)
    return {
      label: isAIMode ? (isAI ? 'Stockfish' : t.you) : localLabel,
      elo: isAI ? diffMeta?.elo || '' : '',
      color: bottomColor,
      captures: isAI ? game.captures.ai : game.captures.player,
      materialDiff: isAI ? -game.materialDiff : game.materialDiff,
      isActive: game.turn === bottomColor && !game.gameOver,
      time: config.useTimer ? (bottomColor === 'w' ? timer.whiteTime : timer.blackTime) : null,
      isLow: config.useTimer ? (bottomColor === 'w' ? timer.whiteTime : timer.blackTime) < 60 : false,
    }
  }, [bottomColor, config, diffMeta, game, timer, isAIMode, language, t.you])

  const modeBadge = isAIMode
    ? t.classicModeBadge(diffMeta ? getDifficultyLabel(config.difficulty, language) : '')
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
            onClick={onNewGame}
            className="min-h-[44px] rounded px-3 py-1.5 text-ui-sm font-medium text-neutral-500 transition-colors hover:bg-surface-2 hover:text-white"
          >
            {t.menu}
          </button>
        </div>
      </header>

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
        onNewGame={onNewGame}
        onDismiss={game.dismissGameOver}
        language={language}
      />
    </div>
  )
}
