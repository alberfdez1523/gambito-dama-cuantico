import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DIFFICULTIES, TIMER_OPTIONS } from '../lib/constants'
import { checkHealth } from '../lib/api'
import { getDifficultyLabel } from '../lib/i18n'
import type { GameConfig, GameMode, OpponentMode, PieceColor, Difficulty, Language, PlayerColorChoice } from '../lib/types'

interface StartMenuProps {
  onPlay: (config: GameConfig) => void
  onOpenOnlineLobby: (prefs: {
    gameMode: GameMode
    color: PlayerColorChoice
    useTimer: boolean
    timerMinutes: number
    difficulty: Difficulty
  }) => void
  onRules: () => void
  language: Language
  onOpenSettings: () => void
}

export default function StartMenu({
  onPlay,
  onOpenOnlineLobby,
  onRules,
  language,
  onOpenSettings,
}: StartMenuProps) {
  const [color, setColor] = useState<PlayerColorChoice>('w')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('ai')
  const [useTimer, setUseTimer] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(10)
  const [gameMode, setGameMode] = useState<GameMode>('classic')
  const [serverReady, setServerReady] = useState(false)
  const [checking, setChecking] = useState(true)

  const requiresEngine = gameMode === 'classic' && opponentMode === 'ai'
  const isOnlineMode = opponentMode === 'online'
  const canPlay = isOnlineMode ? true : requiresEngine ? serverReady : true
  const isQuantum = gameMode === 'quantum'

  const t = language === 'es'
    ? {
        subtitle: isQuantum ? 'Modo cuántico local · 2 jugadores' : 'Clásico vs Stockfish o 2 jugadores',
        tagline: 'Donde el ajedrez se encuentra con la física cuántica',
        gameMode: 'Modo de juego',
        classic: 'Clásico',
        quantum: 'Cuántico',
        yourPieces: 'Tu color',
        white: 'Blancas',
        random: 'Aleatorio',
        black: 'Negras',
        opponent: 'Oponente',
        vsAi: 'Vs IA',
        twoPlayers: '2 jugadores',
        online: 'En línea',
        playOnline: 'Multijugador en línea',
        playLocal: 'Mismo dispositivo',
        quantumInfo: 'Modo cuántico: 2 jugadores en el mismo tablero o en línea con código de sala.',
        difficulty: 'Dificultad',
        diffUnused: 'En 2 jugadores la dificultad no se usa.',
        clock: 'Reloj',
        playClassic: 'Iniciar partida',
        playQuantum: 'Iniciar cuántico',
        connecting: 'Conectando…',
        unavailable: 'Servidor no disponible',
        ready: 'Stockfish listo',
        looking: 'Buscando servidor…',
        offline: 'Sin conexión',
        rules: 'Reglas del juego',
        settings: 'Ajustes',
      }
    : {
        subtitle: isQuantum ? 'Local quantum mode · 2 players' : 'Classic vs Stockfish or 2 players',
        tagline: 'Where chess meets quantum physics',
        gameMode: 'Game mode',
        classic: 'Classic',
        quantum: 'Quantum',
        yourPieces: 'Your color',
        white: 'White',
        random: 'Random',
        black: 'Black',
        opponent: 'Opponent',
        vsAi: 'Vs AI',
        twoPlayers: '2 players',
        online: 'Online',
        playOnline: 'Online multiplayer',
        playLocal: 'Same device',
        quantumInfo: 'Quantum mode: 2 players on one device or online with a room code.',
        difficulty: 'Difficulty',
        diffUnused: 'Difficulty is not used in 2-player mode.',
        clock: 'Clock',
        playClassic: 'Start match',
        playQuantum: 'Start quantum',
        connecting: 'Connecting…',
        unavailable: 'Server unavailable',
        ready: 'Stockfish ready',
        looking: 'Looking for server…',
        offline: 'Offline',
        rules: 'Game rules',
        settings: 'Settings',
      }

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      setChecking(true)
      const ok = await checkHealth()
      if (!cancelled) {
        setServerReady(ok)
        setChecking(false)
        if (!ok) setTimeout(poll, 3000)
      }
    }
    poll()
    return () => { cancelled = true }
  }, [])

  const openOnlineLobby = useCallback(() => {
    onOpenOnlineLobby({
      gameMode,
      color,
      useTimer,
      timerMinutes,
      difficulty,
    })
  }, [color, difficulty, gameMode, onOpenOnlineLobby, timerMinutes, useTimer])

  const handlePlay = useCallback(() => {
    if (!canPlay) return
    if (isOnlineMode) {
      openOnlineLobby()
      return
    }
    const playerColor: PieceColor =
      color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color
    const mode = gameMode === 'quantum' ? 'local' : opponentMode
    onPlay({ playerColor, difficulty, opponentMode: mode, useTimer, timerMinutes, gameMode })
  }, [
    color,
    difficulty,
    opponentMode,
    useTimer,
    timerMinutes,
    gameMode,
    canPlay,
    onPlay,
    isOnlineMode,
    openOnlineLobby,
  ])

  const stagger = {
    hidden: { opacity: 0, y: 12 },
    show: (i: number) => ({
      opacity: 1, y: 0,
      transition: { delay: 0.1 + i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] },
    }),
  }

  return (
    <div className="chess-grid-bg min-h-screen bg-surface-0">
      <div className="mx-auto flex min-h-screen max-w-6xl">

        {/* ── Left branding panel (desktop only) ── */}
        <div className="hidden flex-col justify-center px-14 lg:flex lg:w-[42%]">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="font-serif text-7xl leading-none text-accent">♛</span>
            <h1 className="mt-6 font-serif text-5xl leading-[1.08] text-white">
              Gambito<br />de Dama
            </h1>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              {t.quantum}
            </p>
            <div className="rule my-8 w-16" />
            <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
              {t.tagline}
            </p>
            <p className="mt-2 text-ui-sm text-neutral-600">
              {t.subtitle}
            </p>
          </motion.div>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex flex-1 flex-col justify-center px-6 py-10 lg:border-l lg:border-surface-4 lg:px-16">

          {/* Mobile-only compact header */}
          <motion.div
            className="mb-8 lg:hidden"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center gap-3">
              <span className="font-serif text-3xl text-accent">♛</span>
              <div>
                <h1 className="font-serif text-lg text-white">Gambito de Dama</h1>
                <span className="text-ui-xs font-semibold uppercase tracking-[0.15em] text-accent">
                  {t.quantum}
                </span>
              </div>
            </div>
            <p className="mt-2 text-ui-sm text-neutral-500">{t.subtitle}</p>
          </motion.div>

          <div className="w-full max-w-md">
            {/* Game mode */}
            <motion.div className="mb-7" custom={0} variants={stagger} initial="hidden" animate="show">
              <Label>{t.gameMode}</Label>
              <div className="flex overflow-hidden rounded border border-surface-4">
                {([
                  { value: 'classic' as GameMode, label: `♛ ${t.classic}` },
                  { value: 'quantum' as GameMode, label: `⚛ ${t.quantum}` },
                ] as const).map((opt, i) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setGameMode(opt.value)
                      if (opt.value === 'quantum') { setOpponentMode('local'); setColor('w') }
                    }}
                    className={`flex-1 py-3 text-center text-ui-sm font-semibold uppercase tracking-wider transition-colors
                      ${i > 0 ? 'border-l border-surface-4' : ''}
                      ${gameMode === opt.value
                        ? opt.value === 'quantum'
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'bg-accent/10 text-accent'
                        : 'bg-transparent text-neutral-500 hover:bg-surface-2 hover:text-neutral-300'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Color */}
            <motion.div className="mb-7" custom={1} variants={stagger} initial="hidden" animate="show">
              <Label>{t.yourPieces}</Label>
              <div className="flex overflow-hidden rounded border border-surface-4">
                {([
                  { value: 'w' as PlayerColorChoice, label: `♔ ${t.white}` },
                  { value: 'random' as PlayerColorChoice, label: `⤮ ${t.random}` },
                  { value: 'b' as PlayerColorChoice, label: `♚ ${t.black}` },
                ] as const).map((opt, i) => (
                  <button
                    key={opt.value}
                    onClick={() => setColor(opt.value)}
                    className={`flex-1 py-3 text-center text-ui-sm font-semibold transition-colors
                      ${i > 0 ? 'border-l border-surface-4' : ''}
                      ${color === opt.value
                        ? 'bg-accent/10 text-accent'
                        : 'bg-transparent text-neutral-500 hover:bg-surface-2 hover:text-neutral-300'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Opponent */}
            {!isQuantum ? (
              <motion.div className="mb-7" custom={2} variants={stagger} initial="hidden" animate="show">
                <Label>{t.opponent}</Label>
                <div className="flex overflow-hidden rounded border border-surface-4">
                  {([
                    { value: 'ai' as OpponentMode, label: t.vsAi },
                    { value: 'local' as OpponentMode, label: t.twoPlayers },
                    { value: 'online' as OpponentMode, label: t.online },
                  ] as const).map((opt, i) => (
                    <button
                      key={opt.value}
                      onClick={() => setOpponentMode(opt.value)}
                      className={`flex-1 py-3 text-center text-ui-sm font-semibold transition-colors
                        ${i > 0 ? 'border-l border-surface-4' : ''}
                        ${opponentMode === opt.value
                          ? 'bg-accent/10 text-accent'
                          : 'bg-transparent text-neutral-500 hover:bg-surface-2 hover:text-neutral-300'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div className="mb-7 space-y-3" custom={2} variants={stagger} initial="hidden" animate="show">
                <p className="rounded border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-ui-sm text-indigo-300">
                  ⚛ {t.quantumInfo}
                </p>
                <button
                  type="button"
                  onClick={openOnlineLobby}
                  className="w-full rounded border border-indigo-400/40 py-3 text-ui-sm font-semibold text-indigo-300 hover:bg-indigo-500/10"
                >
                  🌐 {t.playOnline}
                </button>
              </motion.div>
            )}

            {/* Difficulty */}
            <motion.div className="mb-7" custom={3} variants={stagger} initial="hidden" animate="show">
              <Label>{t.difficulty}</Label>
              {gameMode === 'classic' && opponentMode === 'local' && (
                <p className="mb-2 text-ui-sm text-neutral-600">{t.diffUnused}</p>
              )}
              <div className="flex overflow-hidden rounded border border-surface-4">
                {DIFFICULTIES.map((d, i) => (
                  <button
                    key={d.key}
                    onClick={() => setDifficulty(d.key)}
                    disabled={!requiresEngine}
                    className={`flex flex-1 flex-col items-center gap-1.5 py-3 transition-colors
                      ${i > 0 ? 'border-l border-surface-4' : ''}
                      ${difficulty === d.key && requiresEngine
                        ? 'bg-accent/10 text-accent'
                        : requiresEngine
                          ? 'bg-transparent text-neutral-500 hover:bg-surface-2 hover:text-neutral-300'
                          : 'cursor-not-allowed bg-surface-1/60 text-neutral-700'
                      }`}
                  >
                    <div className="flex items-end gap-[2px]">
                      {[1, 2, 3, 4, 5].map((bar) => (
                        <div
                          key={bar}
                          className={`w-[2.5px] rounded-[0.5px] transition-colors
                            ${bar <= d.bars
                              ? difficulty === d.key && requiresEngine ? 'bg-accent' : 'bg-neutral-600'
                              : 'bg-surface-4'
                            }`}
                          style={{ height: `${5 + bar * 2}px` }}
                        />
                      ))}
                    </div>
                    <span className="text-ui-xs font-semibold leading-tight">
                      {getDifficultyLabel(d.key, language)}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Timer */}
            <motion.div className="mb-8" custom={4} variants={stagger} initial="hidden" animate="show">
              <div className="flex items-center justify-between">
                <Label className="mb-0">{t.clock}</Label>
                <button
                  onClick={() => setUseTimer(!useTimer)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${useTimer ? 'bg-accent' : 'bg-surface-3'}`}
                >
                  <motion.div
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
                    animate={{ left: useTimer ? 18 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>
              <AnimatePresence>
                {useTimer && (
                  <motion.div
                    className="mt-3 flex overflow-hidden rounded border border-surface-4"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {TIMER_OPTIONS.map((tm, i) => (
                      <button
                        key={tm}
                        onClick={() => setTimerMinutes(tm)}
                        className={`flex-1 py-2.5 text-center text-ui-sm font-medium transition-colors
                          ${i > 0 ? 'border-l border-surface-4' : ''}
                          ${timerMinutes === tm
                            ? 'bg-accent/10 text-accent'
                            : 'text-neutral-500 hover:bg-surface-2'
                          }`}
                      >
                        {tm}′
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="rule mb-8" />

            {/* Play button */}
            <motion.div custom={5} variants={stagger} initial="hidden" animate="show">
              <button
                onClick={handlePlay}
                disabled={!canPlay}
                className={`w-full rounded py-4 text-ui-sm font-semibold uppercase tracking-[0.2em] transition-all
                  ${canPlay
                    ? isQuantum
                      ? 'border-2 border-indigo-400 bg-indigo-500/5 text-indigo-300 hover:bg-indigo-500 hover:text-white'
                      : 'border-2 border-accent bg-accent/5 text-accent hover:bg-accent hover:text-surface-0'
                    : 'cursor-wait border-2 border-surface-4 bg-surface-2 text-neutral-600'
                  }`}
              >
                {canPlay
                  ? isOnlineMode
                    ? `🌐  ${t.playOnline}`
                    : isQuantum
                      ? `⚛  ${t.playLocal}`
                      : `▸  ${t.playClassic}`
                  : checking
                    ? t.connecting
                    : t.unavailable}
              </button>
            </motion.div>

            {/* Footer links */}
            <motion.div
              className="mt-6 flex items-center justify-between"
              custom={6} variants={stagger} initial="hidden" animate="show"
            >
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onRules}
                  className="min-h-[44px] text-ui-sm font-medium text-neutral-500 transition-colors hover:text-accent"
                >
                  {t.rules} →
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="min-h-[44px] text-ui-sm font-medium text-neutral-500 transition-colors hover:text-accent"
                >
                  ⚙ {t.settings}
                </button>
              </div>

              {gameMode === 'classic' && (
                <div className="flex items-center gap-2">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      serverReady ? 'bg-emerald-500' : checking ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-ui-xs text-neutral-600">
                    {serverReady ? t.ready : checking ? t.looking : t.offline}
                  </span>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={`mb-2.5 block text-ui-xs font-semibold uppercase tracking-[0.15em] text-neutral-500 ${className}`}>
      {children}
    </label>
  )
}
