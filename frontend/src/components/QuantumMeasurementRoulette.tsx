import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { Language, QMeasurementEvent } from '../lib/types'
import { useModalA11y } from '../hooks/useModalA11y'

interface QuantumMeasurementRouletteProps {
  visible: boolean
  measurement: QMeasurementEvent | null
  onClose: () => void
  language: Language
}

export default function QuantumMeasurementRoulette({
  visible, measurement, onClose, language,
}: QuantumMeasurementRouletteProps) {
  const [spun, setSpun] = useState(false)
  const [spinDone, setSpinDone] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!visible) { setSpun(false); setSpinDone(false) }
  }, [visible])

  const probability = measurement?.probability ?? 0.5
  const roll = measurement?.roll ?? 0.5
  const result = measurement?.result ?? 'dead'
  const target = measurement?.target ?? 'defender'
  const attackerWasQuantum = measurement?.attackerWasQuantum ?? false
  const defenderWasQuantum = measurement?.defenderWasQuantum ?? false
  const step = measurement?.step ?? 1
  const totalSteps = measurement?.totalSteps ?? 1
  const priorStepResult = measurement?.priorStepResult

  const alivePct = Math.round(probability * 100)
  const deadPct = 100 - alivePct
  const isAlive = result === 'alive'
  const baseTurns = reduceMotion ? 0 : 1440
  const pointerDeg = Math.min(359.9, Math.max(0, roll * 360))
  const finalWheelRotation = spun ? baseTurns - pointerDeg : 0
  const revealResult = spinDone

  const scenario = useMemo(() => {
    if (attackerWasQuantum && defenderWasQuantum) return 'q-vs-q'
    if (attackerWasQuantum) return 'q-vs-c'
    return 'c-vs-q'
  }, [attackerWasQuantum, defenderWasQuantum])

  const es = language === 'es'
  const measuredLabel = target === 'attacker' ? (es ? 'pieza atacante' : 'attacking piece') : (es ? 'pieza objetivo' : 'target piece')
  const measuredTitle = target === 'attacker' ? (es ? 'Atacante' : 'Attacker') : (es ? 'Objetivo' : 'Target')
  const titleId = 'quantum-measurement-title'

  const outcomeAlive = target === 'attacker'
    ? (es ? 'La atacante existe en esa casilla y la jugada puede continuar.' : 'The attacker exists on that square and the move can continue.')
    : (es ? 'La objetivo existe en esa casilla y la captura se completa.' : 'The target exists on that square and the capture is completed.')
  const outcomeDead = target === 'attacker'
    ? (es ? 'La atacante no estaba realmente en esa casilla; la captura falla y la pieza colapsa en su otra posición.' : 'The attacker was not actually on that square; the capture fails and the piece collapses to its other position.')
    : (es ? 'La objetivo no estaba realmente en esa casilla; la captura falla y la pieza objetivo colapsa en su otra posición.' : 'The target was not actually on that square; the capture fails and the target piece collapses to its other position.')

  const scenarioText = useMemo(() => {
    switch (scenario) {
      case 'q-vs-q': return {
        title: es ? 'Captura cuántica contra cuántica' : 'Quantum vs quantum capture',
        text: es ? 'Primero se comprueba si la atacante existe. Si sobrevive, se mide la objetivo.' : 'First check if the attacker exists. If it survives, measure the target.',
      }
      case 'q-vs-c': return {
        title: es ? 'Captura cuántica contra clásica' : 'Quantum vs classic capture',
        text: es ? 'Solo se mide la atacante. Si existe, captura normalmente.' : 'Only the attacker is measured. If it exists, it captures normally.',
      }
      default: return {
        title: es ? 'Captura clásica contra cuántica' : 'Classic vs quantum capture',
        text: es ? 'Solo se mide la pieza objetivo para decidir si la captura ocurre.' : 'Only the target piece is measured to decide if the capture occurs.',
      }
    }
  }, [scenario, es])

  const active = visible && !!measurement
  const { containerRef } = useModalA11y(active)

  if (!active || !measurement) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-sm overflow-hidden rounded-lg border border-indigo-500/20 bg-surface-1 text-center"
            initial={reduceMotion ? false : { scale: 0.93, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduceMotion ? undefined : { scale: 0.93, opacity: 0 }}
          >
            <div className="border-b border-surface-4 px-5 py-4 text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-indigo-400">
                    {es ? 'Medición cuántica' : 'Quantum measurement'}
                  </p>
                  <h3 id={titleId} className="mt-1 font-serif text-base text-white">{scenarioText.title}</h3>
                  <p className="mt-1 text-xs leading-tight text-neutral-500">{scenarioText.text}</p>
                </div>
                <span className="rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold text-indigo-300">
                  {es ? 'Paso' : 'Step'} {step}/{totalSteps}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded border border-indigo-500/15 bg-indigo-500/5 px-3 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-indigo-400">{es ? 'Qué se mide' : 'What is measured'}</p>
                  <p className="mt-1 font-semibold text-white">{measuredTitle}</p>
                  <p className="mt-1 text-neutral-500">{es ? `Se comprueba si la ${measuredLabel} existe.` : `Checks if the ${measuredLabel} exists.`}</p>
                </div>
                <div className="rounded border border-surface-4 bg-surface-2 px-3 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-neutral-500">{es ? 'Contexto' : 'Context'}</p>
                  <p className="mt-1 text-neutral-400">
                    {priorStepResult
                      ? es ? `Antes: ${priorStepResult.target === 'attacker' ? 'atacante' : 'objetivo'} salió ${priorStepResult.result === 'alive' ? 'viva' : 'muerta'}.`
                           : `Before: ${priorStepResult.target === 'attacker' ? 'attacker' : 'target'} came out ${priorStepResult.result}.`
                      : es ? 'Tirada directa.' : 'Direct spin.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="relative mx-auto h-48 w-48">
                <motion.div
                  className="relative h-full w-full rounded-full p-2.5"
                  animate={{ rotate: finalWheelRotation }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 1.35, ease: [0.1, 0.9, 0.2, 1] }}
                  onAnimationComplete={() => { if (spun) setSpinDone(true) }}
                >
                  <div
                    className="h-full w-full rounded-full border border-white/[0.06]"
                    style={{
                      background: `conic-gradient(
                        rgba(34,197,94,0.92) 0deg ${alivePct * 3.6}deg,
                        rgba(239,68,68,0.92) ${alivePct * 3.6}deg 360deg
                      )`,
                    }}
                  />
                  <div className="pointer-events-none absolute inset-[28%] flex flex-col items-center justify-center rounded-full bg-surface-0/95 ring-1 ring-white/[0.06]">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
                      {es ? 'Resultado' : 'Result'}
                    </span>
                    <span className={`mt-0.5 text-sm font-bold ${revealResult ? (isAlive ? 'text-emerald-400' : 'text-red-400') : 'text-neutral-400'}`}>
                      {revealResult ? (isAlive ? (es ? 'VIVO' : 'ALIVE') : (es ? 'MUERTO' : 'DEAD')) : '—'}
                    </span>
                    <span className="mt-0.5 text-[10px] text-neutral-500">{measuredTitle}</span>
                  </div>
                </motion.div>
                <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
                  <div className="rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-surface-0">▼</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-left text-[11px]">
                <div className="rounded border border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
                  <p className="font-semibold uppercase tracking-wider text-emerald-400">{es ? 'Si vivo' : 'If alive'}</p>
                  <p className="mt-1 text-neutral-400">{outcomeAlive}</p>
                  <p className="mt-1.5 font-mono text-emerald-300">{alivePct}%</p>
                </div>
                <div className="rounded border border-red-500/15 bg-red-500/5 px-3 py-2">
                  <p className="font-semibold uppercase tracking-wider text-red-400">{es ? 'Si muerto' : 'If dead'}</p>
                  <p className="mt-1 text-neutral-400">{outcomeDead}</p>
                  <p className="mt-1.5 font-mono text-red-300">{deadPct}%</p>
                </div>
              </div>

              <div className="mt-3 rounded border border-surface-4 bg-surface-2 px-3 py-2 text-left text-[11px]">
                <div className="flex items-center justify-between text-neutral-500">
                  <span>{es ? 'Tirada' : 'Roll'}</span>
                  <span className="font-mono font-semibold text-white">
                    {revealResult ? `${Math.round(roll * 100)} / 100` : '—'}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-neutral-500">
                  <span>{es ? 'Umbral vivo' : 'Alive threshold'}</span>
                  <span className="font-mono font-semibold text-indigo-300">&lt; {alivePct}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => { if (!spun) setSpun(true) }}
                  disabled={spun}
                  className={`min-h-[44px] rounded px-4 py-2 text-xs font-semibold transition-colors
                    ${spun
                      ? 'cursor-not-allowed border border-surface-4 bg-surface-2 text-neutral-600'
                      : 'border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                    }`}
                >
                  {spun ? (es ? 'Resuelta' : 'Resolved') : (es ? 'Girar ruleta' : 'Spin roulette')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={!spinDone}
                  className={`min-h-[44px] rounded px-4 py-2 text-xs font-semibold transition-colors
                    ${spinDone
                      ? 'border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20'
                      : 'cursor-not-allowed border border-surface-4 bg-surface-2 text-neutral-700'
                    }`}
                >
                  {es ? 'Cerrar' : 'Close'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
