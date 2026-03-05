import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DIFFICULTIES, TIMER_OPTIONS } from '../lib/constants'
import { checkHealth } from '../lib/api'
import type { GameConfig, PieceColor, Difficulty, PlayerColorChoice } from '../lib/types'

interface StartMenuProps {
  onPlay: (config: GameConfig) => void
}

// Piezas flotantes decorativas
const FLOATING_PIECES = ['♔', '♕', '♗', '♘', '♙', '♚', '♛', '♝', '♞', '♟']

export default function StartMenu({ onPlay }: StartMenuProps) {
  const [color, setColor] = useState<PlayerColorChoice>('w')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [useTimer, setUseTimer] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(10)
  const [serverReady, setServerReady] = useState(false)
  const [checking, setChecking] = useState(true)

  // Verificar estado del servidor
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

  const handlePlay = useCallback(() => {
    if (!serverReady) return
    const playerColor: PieceColor =
      color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color
    onPlay({ playerColor, difficulty, useTimer, timerMinutes })
  }, [color, difficulty, useTimer, timerMinutes, serverReady, onPlay])

  return (
    <div className="bg-radial-orange relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Piezas flotantes de fondo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.035]">
        {FLOATING_PIECES.map((p, i) => (
          <motion.span
            key={i}
            className="absolute text-6xl text-white"
            style={{
              left: `${8 + (i * 9) % 85}%`,
              top: `${5 + ((i * 17) % 80)}%`,
            }}
            animate={{
              y: [0, -30, 0],
              rotate: [0, i % 2 === 0 ? 10 : -10, 0],
            }}
            transition={{
              duration: 5 + (i % 3) * 2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.5,
            }}
          >
            {p}
          </motion.span>
        ))}
      </div>

      {/* Tarjeta principal */}
      <motion.div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/[0.06] bg-surface-1/90 p-8 shadow-2xl backdrop-blur-xl"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo */}
        <motion.div
          className="mb-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="mb-2 text-5xl">♛</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Chess<span className="text-accent">AI</span>
          </h1>
          <p className="mt-1 text-xs text-neutral-500">Juega contra Stockfish</p>
        </motion.div>

        {/* Selector de color */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            Tu color
          </label>
          <div className="flex gap-2">
            {[
              { value: 'w' as PlayerColorChoice, label: 'Blancas', icon: '♔' },
              { value: 'random' as PlayerColorChoice, label: 'Aleatorio', icon: '🎲' },
              { value: 'b' as PlayerColorChoice, label: 'Negras', icon: '♚' },
            ].map((opt) => (
              <motion.button
                key={opt.value}
                onClick={() => setColor(opt.value)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-3 text-sm transition-all duration-200
                  ${color === opt.value
                    ? 'bg-accent/15 text-accent ring-1 ring-accent/40 shadow-glow-sm'
                    : 'bg-surface-2 text-neutral-400 hover:bg-surface-3 hover:text-neutral-200'
                  }`}
              >
                <span className="text-xl">{opt.icon}</span>
                <span className="text-[10px] font-medium">{opt.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Selector de dificultad */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            Dificultad
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {DIFFICULTIES.map((d) => (
              <motion.button
                key={d.key}
                onClick={() => setDifficulty(d.key)}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className={`flex flex-col items-center gap-1 rounded-lg py-2.5 transition-all duration-200
                  ${difficulty === d.key
                    ? 'bg-accent/15 text-accent ring-1 ring-accent/40'
                    : 'bg-surface-2 text-neutral-500 hover:bg-surface-3 hover:text-neutral-300'
                  }`}
              >
                {/* Barras de nivel */}
                <div className="flex gap-[2px]">
                  {[1, 2, 3, 4, 5].map((bar) => (
                    <div
                      key={bar}
                      className={`h-2.5 w-[3px] rounded-sm transition-colors
                        ${bar <= d.bars
                          ? difficulty === d.key ? 'bg-accent' : 'bg-neutral-500'
                          : 'bg-surface-4'
                        }`}
                      style={{ height: `${6 + bar * 2}px` }}
                    />
                  ))}
                </div>
                <span className="text-[9px] font-medium leading-tight">{d.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Timer toggle */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              Reloj
            </label>
            <button
              onClick={() => setUseTimer(!useTimer)}
              className={`relative h-5 w-9 rounded-full transition-colors duration-200
                ${useTimer ? 'bg-accent' : 'bg-surface-3'}`}
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
                className="mt-3 flex gap-1.5"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {TIMER_OPTIONS.map((t) => (
                  <motion.button
                    key={t}
                    onClick={() => setTimerMinutes(t)}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    className={`flex-1 rounded-lg py-2 text-center text-xs font-medium transition-all
                      ${timerMinutes === t
                        ? 'bg-accent/15 text-accent ring-1 ring-accent/40'
                        : 'bg-surface-2 text-neutral-500 hover:bg-surface-3'
                      }`}
                  >
                    {t}′
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Botón de Play */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <motion.button
            onClick={handlePlay}
            disabled={!serverReady}
            whileHover={serverReady ? { scale: 1.02 } : {}}
            whileTap={serverReady ? { scale: 0.98 } : {}}
            className={`btn-shine w-full rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all
              ${serverReady
                ? 'bg-accent text-white shadow-glow hover:bg-accent-hover'
                : 'cursor-wait bg-surface-3 text-neutral-500'
              }`}
          >
            {serverReady ? '▶  Jugar' : checking ? 'Conectando…' : 'Servidor no disponible'}
          </motion.button>
        </motion.div>

        {/* Indicador de estado del servidor */}
        <motion.div
          className="mt-4 flex items-center justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              serverReady ? 'bg-green-500' : checking ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-[10px] text-neutral-600">
            {serverReady ? 'Stockfish listo' : checking ? 'Buscando servidor…' : 'Sin conexión'}
          </span>
        </motion.div>
      </motion.div>
    </div>
  )
}
