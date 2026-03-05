import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import Board from './Board'
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
import { useTimer, formatTime } from '../hooks/useTimer'
import { DIFFICULTIES } from '../lib/constants'
import type { GameConfig } from '../lib/types'

interface GameScreenProps {
  config: GameConfig
  onNewGame: () => void
}

export default function GameScreen({ config, onNewGame }: GameScreenProps) {
  const sounds = useSoundFX()
  const music = useAmbientMusic()
  const game = useChessGame(config, sounds)

  const timer = useTimer({
    enabled: config.useTimer,
    minutes: config.timerMinutes,
    turn: game.turn,
    gameStarted: true,
    gameOver: game.gameOver,
  })

  // Detectar timeout del reloj
  useEffect(() => {
    if (timer.timedOut && !game.gameOverInfo) {
      game.handleTimedOut(timer.timedOut)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.timedOut])

  const diffMeta = DIFFICULTIES.find((d) => d.key === config.difficulty)
  const aiColor = config.playerColor === 'w' ? 'b' : 'w'

  // Determinar quién va arriba y abajo (según orientación del tablero)
  const topColor = game.boardFlipped ? config.playerColor : aiColor
  const bottomColor = game.boardFlipped ? aiColor : config.playerColor

  const topBar = useMemo(() => {
    const isAI = topColor !== config.playerColor
    return {
      label: isAI ? 'Stockfish' : 'Tú',
      elo: isAI ? diffMeta?.elo || '' : '',
      color: topColor,
      captures: isAI ? game.captures.ai : game.captures.player,
      materialDiff: isAI ? -game.materialDiff : game.materialDiff,
      isActive: game.turn === topColor && !game.gameOver,
      time: config.useTimer ? (topColor === 'w' ? timer.whiteTime : timer.blackTime) : null,
      isLow: config.useTimer
        ? (topColor === 'w' ? timer.whiteTime : timer.blackTime) < 60
        : false,
    }
  }, [topColor, config, diffMeta, game, timer])

  const bottomBar = useMemo(() => {
    const isAI = bottomColor !== config.playerColor
    return {
      label: isAI ? 'Stockfish' : 'Tú',
      elo: isAI ? diffMeta?.elo || '' : '',
      color: bottomColor,
      captures: isAI ? game.captures.ai : game.captures.player,
      materialDiff: isAI ? -game.materialDiff : game.materialDiff,
      isActive: game.turn === bottomColor && !game.gameOver,
      time: config.useTimer ? (bottomColor === 'w' ? timer.whiteTime : timer.blackTime) : null,
      isLow: config.useTimer
        ? (bottomColor === 'w' ? timer.whiteTime : timer.blackTime) < 60
        : false,
    }
  }, [bottomColor, config, diffMeta, game, timer])

  return (
    <div className="flex min-h-screen flex-col bg-surface-0">
      {/* Header */}
      <motion.header
        className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">♛</span>
          <span className="text-sm font-bold text-white">
            Chess<span className="text-accent">AI</span>
          </span>
          <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
            {diffMeta?.label}
          </span>
        </div>
        <motion.button
          onClick={onNewGame}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-neutral-400
            transition-colors hover:bg-surface-3 hover:text-white"
        >
          ← Menú
        </motion.button>
      </motion.header>

      {/* Contenido principal */}
      <div className="flex flex-1 items-start justify-center gap-6 px-4 py-4 lg:py-8">
        {/* Columna del tablero */}
        <motion.div
          className="flex flex-col gap-2"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Barra superior */}
          <PlayerBar
            label={topBar.label}
            elo={topBar.elo}
            color={topBar.color}
            isActive={topBar.isActive}
            captures={topBar.captures}
            materialDiff={topBar.materialDiff}
            time={topBar.time}
            isLow={topBar.isLow}
          />

          {/* Tablero */}
          <Board
            fen={game.fen}
            selectedSquare={game.selectedSquare}
            legalSquares={game.legalSquares}
            lastMove={game.lastMove}
            boardFlipped={game.boardFlipped}
            isThinking={game.isThinking}
            playerColor={config.playerColor}
            checkSquare={game.checkSquare}
            getPiece={game.getPiece}
            onSquareClick={game.handleSquareClick}
            onDrop={game.handleDrop}
          />

          {/* Barra inferior */}
          <PlayerBar
            label={bottomBar.label}
            elo={bottomBar.elo}
            color={bottomBar.color}
            isActive={bottomBar.isActive}
            captures={bottomBar.captures}
            materialDiff={bottomBar.materialDiff}
            time={bottomBar.time}
            isLow={bottomBar.isLow}
          />

          {/* Status */}
          <motion.div
            className="flex items-center justify-center gap-2 py-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                game.status.type === 'player'
                  ? 'bg-accent'
                  : game.status.type === 'thinking'
                    ? 'bg-yellow-500 animate-pulse'
                    : game.status.type === 'over'
                      ? 'bg-red-400'
                      : 'bg-neutral-600'
              }`}
            />
            <span className="text-xs text-neutral-500">{game.status.text}</span>
          </motion.div>
        </motion.div>

        {/* Panel lateral (solo desktop) */}
        <motion.div
          className="hidden w-64 flex-col gap-3 lg:flex"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <EvalBar chances={game.chances} playerColor={config.playerColor} />
          <MoveHistory history={game.history} />
          <ActionButtons
            onUndo={game.undo}
            onFlip={game.flip}
            onResign={game.resign}
            canUndo={game.history.length >= 2 && !game.isThinking}
            gameOver={game.gameOver}
          />
          <MusicPlayer
            playing={music.playing}
            volume={music.volume}
            onToggle={music.toggle}
            onVolumeChange={music.setVolume}
          />
        </motion.div>
      </div>

      {/* Acciones rápidas móvil (solo sm) */}
      <motion.div
        className="flex items-center gap-2 border-t border-white/[0.04] px-4 py-2 lg:hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex flex-1 gap-1.5">
          <ActionButtons
            onUndo={game.undo}
            onFlip={game.flip}
            onResign={game.resign}
            canUndo={game.history.length >= 2 && !game.isThinking}
            gameOver={game.gameOver}
          />
        </div>
        <motion.button
          onClick={music.toggle}
          whileTap={{ scale: 0.9 }}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors
            ${music.playing ? 'bg-accent text-white' : 'bg-surface-2 text-neutral-500'}`}
        >
          {music.playing ? '⏸' : '♫'}
        </motion.button>
      </motion.div>

      {/* Modales */}
      <PromotionModal
        visible={!!game.promotionPending}
        color={config.playerColor}
        onSelect={game.handlePromotion}
      />
      <GameOverModal
        info={game.gameOverInfo}
        onNewGame={onNewGame}
        onDismiss={game.dismissGameOver}
      />
    </div>
  )
}
