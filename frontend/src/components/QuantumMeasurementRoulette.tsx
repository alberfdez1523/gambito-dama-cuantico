import { useEffect, useMemo, useState } from 'react'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { Language, QMeasurementEvent } from '../lib/types'
import { useModalA11y } from '../hooks/useModalA11y'

interface QuantumMeasurementRouletteProps {
  visible: boolean
  measurement: QMeasurementEvent | null
  onClose: () => void
  /** En online solo el iniciador cierra y libera el turno; el rival puede girar la ruleta. */
  canDismiss?: boolean
  /** Gira y libera automáticamente la medición tras una breve revelación. */
  autoResolve?: boolean
  /** Límite para liberar una medición online aunque nadie pulse la ruleta. */
  timeoutSeconds?: number
  language: Language
}

export default function QuantumMeasurementRoulette({
  visible,
  measurement,
  onClose,
  canDismiss = true,
  autoResolve = false,
  timeoutSeconds,
  language,
}: QuantumMeasurementRouletteProps) {
  const [spun, setSpun] = useState(false)
  const [spinDone, setSpinDone] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(timeoutSeconds ?? 0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!visible) {
      setSpun(false)
      setSpinDone(false)
      setSecondsLeft(timeoutSeconds ?? 0)
      return
    }
    setSecondsLeft(timeoutSeconds ?? 0)
  }, [timeoutSeconds, visible])

  useEffect(() => {
    if (!visible || spun || !autoResolve) return
    const id = window.setTimeout(() => setSpun(true), reduceMotion ? 40 : 350)
    return () => window.clearTimeout(id)
  }, [autoResolve, reduceMotion, spun, visible])

  useEffect(() => {
    if (!visible || !timeoutSeconds || spun) return
    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      const next = Math.max(0, timeoutSeconds - elapsed)
      setSecondsLeft(next)
      if (next <= 1) setSpun(true)
    }, 250)
    return () => window.clearInterval(interval)
  }, [spun, timeoutSeconds, visible])

  useEffect(() => {
    if (!visible || !spinDone || !canDismiss || (!autoResolve && !timeoutSeconds)) return
    const id = window.setTimeout(onClose, reduceMotion ? 120 : 650)
    return () => window.clearTimeout(id)
  }, [autoResolve, canDismiss, onClose, reduceMotion, spinDone, timeoutSeconds, visible])

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
    ? (es ? 'La atacante existe y la jugada continúa.' : 'The attacker exists and the move continues.')
    : (es ? 'La pieza objetivo existe y la captura se completa.' : 'The target exists and the capture completes.')
  const outcomeDead = target === 'attacker'
    ? (es ? 'La atacante no estaba ahí; la captura falla.' : 'The attacker was not there; capture fails.')
    : (es ? 'La pieza objetivo no estaba ahí; la captura falla.' : 'The target was not there; capture fails.')

  const scenarioText = useMemo(() => {
    switch (scenario) {
      case 'q-vs-q': return {
        title: es ? 'Captura cuántica vs cuántica' : 'Quantum vs quantum capture',
        text: es ? 'Primero la pieza atacante; si vive, se mide la pieza objetivo.' : 'Attacker first; if alive, measure target.',
      }
      case 'q-vs-c': return {
        title: es ? 'Captura cuántica vs clásica' : 'Quantum vs classic capture',
        text: es ? 'Solo se mide la atacante.' : 'Only the attacker is measured.',
      }
      default: return {
        title: es ? 'Captura clásica vs cuántica' : 'Classic vs quantum capture',
        text: es ? 'Se mide la pieza objetivo.' : 'The target piece is measured.',
      }
    }
  }, [scenario, es])

  const active = visible && !!measurement
  const { containerRef } = useModalA11y(active, undefined, false)

  if (!active || !measurement) return null

  const outcomeLine = revealResult
    ? (isAlive ? outcomeAlive : outcomeDead)
    : null

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 px-0 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-sm lg:items-center lg:px-4 lg:pb-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <m.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[92dvh] w-full max-w-none flex-col rounded-t-xl border border-quantum/20 bg-surface-1 text-center lg:max-h-none lg:max-w-sm lg:rounded-lg"
            initial={reduceMotion ? false : { y: 40, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: 40, scale: 0.98, opacity: 0 }}
          >
            {/* Móvil: cabecera compacta */}
            <div className="shrink-0 border-b border-surface-4 px-4 py-3 text-left lg:hidden">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-surface-4" aria-hidden />
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-quantum">
                    {es ? 'Medición' : 'Measurement'}
                  </p>
                  <h3 id={titleId} className="truncate font-serif text-sm text-ink">
                    {scenarioText.title}
                  </h3>
                </div>
                <span className="shrink-0 rounded border border-quantum/20 bg-quantum/10 px-2 py-0.5 text-[10px] font-semibold text-quantum">
                  {step}/{totalSteps}
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] text-neutral-500">
                {measuredTitle} · {alivePct}% {es ? 'vivo' : 'alive'}
              </p>
            </div>

            {/* Escritorio: cabecera completa */}
            <div className="hidden border-b border-surface-4 px-5 py-4 text-left lg:block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-quantum">
                    {es ? 'Medición cuántica' : 'Quantum measurement'}
                  </p>
                  <h3 id={titleId} className="mt-1 font-serif text-base text-ink">{scenarioText.title}</h3>
                  <p className="mt-1 text-xs leading-tight text-neutral-500">{scenarioText.text}</p>
                </div>
                <span className="rounded border border-quantum/20 bg-quantum/10 px-2 py-1 text-[10px] font-semibold text-quantum">
                  {es ? 'Paso' : 'Step'} {step}/{totalSteps}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded border border-quantum/15 bg-quantum/5 px-3 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-quantum">{es ? 'Qué se mide' : 'What is measured'}</p>
                  <p className="mt-1 font-semibold text-ink">{measuredTitle}</p>
                  <p className="mt-1 text-neutral-500">{es ? `Se comprueba si la ${measuredLabel} existe.` : `Checks if the ${measuredLabel} exists.`}</p>
                </div>
                <div className="rounded border border-surface-4 bg-surface-2 px-3 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-neutral-500">{es ? 'Contexto' : 'Context'}</p>
                  <p className="mt-1 text-neutral-400">
                    {priorStepResult
                      ? es ? `Antes: ${priorStepResult.target === 'attacker' ? 'atacante' : 'pieza objetivo'} ${priorStepResult.result === 'alive' ? 'viva' : 'muerta'}.`
                           : `Before: ${priorStepResult.target === 'attacker' ? 'attacker' : 'target'} ${priorStepResult.result}.`
                      : es ? 'Tirada directa.' : 'Direct spin.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-4 py-3 lg:px-5 lg:py-4">
              <div className="flex flex-1 flex-col items-center justify-center">
                <div className="relative mx-auto h-[min(36vw,28dvh)] w-[min(36vw,28dvh)] min-h-[7.5rem] min-w-[7.5rem] lg:h-48 lg:w-48 lg:min-h-0 lg:min-w-0">
                  <m.div
                    className="relative h-full w-full rounded-full p-2 lg:p-2.5"
                    animate={{ rotate: finalWheelRotation }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 1.2, ease: [0.1, 0.9, 0.2, 1] }}
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
                  </m.div>
                  <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
                    <div className="h-0 w-0 border-x-[6px] border-t-[10px] border-x-transparent border-t-white drop-shadow" />
                  </div>
                </div>

                {/* Móvil: resultado en una línea tras girar */}
                {outcomeLine && (
                  <p className={`mt-3 max-w-full px-1 text-left text-[11px] leading-snug lg:hidden ${isAlive ? 'text-emerald-400/90' : 'text-red-400/90'}`}>
                    {outcomeLine}
                  </p>
                )}

                {/* Escritorio: grids detallados */}
                <div className="mt-4 hidden w-full grid-cols-2 gap-2 text-left text-[11px] lg:grid">
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

                <div className="mt-3 hidden w-full rounded border border-surface-4 bg-surface-2 px-3 py-2 text-left text-[11px] lg:block">
                  <div className="flex items-center justify-between text-neutral-500">
                    <span>{es ? 'Tirada' : 'Roll'}</span>
                    <span className="font-mono font-semibold text-ink">
                      {revealResult ? `${Math.round(roll * 100)} / 100` : '—'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-neutral-500">
                    <span>{es ? 'Umbral vivo' : 'Alive threshold'}</span>
                    <span className="font-mono font-semibold text-quantum">&lt; {alivePct}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex shrink-0 items-center justify-center gap-2 pb-1 lg:mt-4">
                <button
                  type="button"
                  onClick={() => { if (!spun) setSpun(true) }}
                  disabled={spun}
                  className={`min-h-[44px] flex-1 rounded px-4 py-2 text-xs font-semibold transition-colors lg:flex-none
                    ${spun
                      ? 'cursor-not-allowed border border-surface-4 bg-surface-2 text-neutral-600'
                      : 'border border-quantum/30 bg-quantum/10 text-quantum hover:bg-quantum/20'
                    }`}
                >
                  {spun
                    ? (es ? 'Resuelta' : 'Resolved')
                    : timeoutSeconds
                      ? `${es ? 'Girar ruleta' : 'Spin roulette'} · ${secondsLeft}s`
                      : (es ? 'Girar ruleta' : 'Spin roulette')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={!spinDone || !canDismiss}
                  className={`min-h-[44px] flex-1 rounded px-4 py-2 text-xs font-semibold transition-colors lg:flex-none
                    ${spinDone && canDismiss
                      ? 'border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20'
                      : 'cursor-not-allowed border border-surface-4 bg-surface-2 text-neutral-700'
                    }`}
                >
                  {canDismiss
                    ? (es ? 'Cerrar' : 'Close')
                    : (es ? 'Espera al rival' : 'Wait for opponent')}
                </button>
              </div>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
