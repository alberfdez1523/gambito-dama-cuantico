import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CaptureScenario } from './types'
import MiniBoard from './MiniBoard'
import { useMiniSqPx } from './useMiniSqPx'

interface CaptureFlowLabProps {
  scenarios: CaptureScenario[]
  es: boolean
}

export default function CaptureFlowLab({ scenarios, es }: CaptureFlowLabProps) {
  const [activeId, setActiveId] = useState(scenarios[0]?.id ?? 'c-c')
  const [step, setStep] = useState(0)
  const sqPx = useMiniSqPx()

  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0]
  if (!active) return null

  const currentStep = active.steps[Math.min(step, active.steps.length - 1)]

  const selectScenario = (id: string) => {
    setActiveId(id)
    setStep(0)
  }

  return (
    <section className="rules-panel" aria-labelledby="capture-lab-title">
      <h2 id="capture-lab-title" className="rules-section-title">
        {es ? 'Laboratorio de capturas cuánticas' : 'Quantum capture lab'}
      </h2>
      <p className="mb-4 text-ui-sm text-neutral-400">
        {es
          ? 'Elige un tipo de captura y avanza paso a paso para ver qué se mide y qué ocurre.'
          : 'Pick a capture type and step through what gets measured and what happens.'}
      </p>

      <motion.div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => selectScenario(s.id)}
            className={`rules-capture-card ${activeId === s.id ? 'rules-capture-card-active' : ''}`}
            aria-pressed={activeId === s.id}
          >
            <span className="text-ui-xs font-bold uppercase tracking-wide text-neutral-500">
              {s.attacker === 'quantum' ? '⚛' : '♟'} → {s.defender === 'quantum' ? '⚛' : '♟'}
            </span>
            <span className="mt-1 text-ui-sm font-semibold text-white">{s.label}</span>
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          className="mt-6 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <span className="text-ui-xs font-semibold uppercase tracking-wider text-indigo-400">
                  {es ? 'Qué se mide' : 'What is measured'}
                </span>
                <p className="mt-1 text-ui-sm text-white">{active.measured}</p>
              </div>
              <div>
                <span className="text-ui-xs font-semibold uppercase tracking-wider text-indigo-400">
                  {es ? 'Resultado' : 'Outcome'}
                </span>
                <p className="mt-1 text-ui-sm text-neutral-300">{active.outcome}</p>
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-col items-center gap-3">
              {currentStep && (
                <>
                  <MiniBoard
                    squares={currentStep.board}
                    sqPx={sqPx}
                    stepKey={`${active.id}-${step}`}
                  />
                  <p className="max-w-[240px] text-center text-ui-xs text-neutral-500">
                    {currentStep.caption}
                  </p>
                </>
              )}

              {active.steps.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rules-step-btn"
                    disabled={step === 0}
                    onClick={() => setStep((s) => s - 1)}
                    aria-label={es ? 'Paso anterior' : 'Previous step'}
                  >
                    ←
                  </button>
                  <span className="min-w-[4.5rem] text-center text-ui-xs text-neutral-500">
                    {step + 1} / {active.steps.length}
                  </span>
                  <button
                    type="button"
                    className="rules-step-btn"
                    disabled={step >= active.steps.length - 1}
                    onClick={() => setStep((s) => s + 1)}
                    aria-label={es ? 'Paso siguiente' : 'Next step'}
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
