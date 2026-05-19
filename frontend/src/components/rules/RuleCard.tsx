import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RuleDefinition } from './types'
import MiniBoard from './MiniBoard'
import { useMiniSqPx } from './useMiniSqPx'

interface RuleCardProps {
  rule: RuleDefinition
  index: number
  es: boolean
  defaultOpen?: boolean
  variant?: 'classic' | 'quantum'
}

export default function RuleCard({
  rule,
  index,
  es,
  defaultOpen = false,
  variant = 'classic',
}: RuleCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [step, setStep] = useState(0)
  const sqPx = useMiniSqPx()

  const steps =
    rule.steps ??
    (rule.board ? [{ caption: es ? 'Ejemplo' : 'Example', board: rule.board }] : [])
  const currentStep = steps[Math.min(step, steps.length - 1)]
  const hasSteps = steps.length > 1

  const accentClass =
    variant === 'quantum'
      ? rule.bgColor || 'bg-indigo-500/10 border-indigo-500/20'
      : 'bg-accent/10 border-accent/20'
  const titleClass =
    variant === 'quantum' ? rule.color || 'text-indigo-300' : 'text-white'

  return (
    <article
      id={`rule-${rule.id}`}
      className="rules-card scroll-mt-24 overflow-hidden rounded-lg border border-surface-4 bg-surface-1"
    >
      <button
        type="button"
        className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-surface-2/40 lg:p-5"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`rule-body-${rule.id}`}
      >
        <motion.div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border text-lg ${accentClass}`}
        >
          {rule.icon}
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className={`text-ui-base font-bold ${titleClass}`}>{rule.title}</h3>
              <p className="mt-1 text-ui-sm leading-snug text-neutral-400">{rule.summary}</p>
            </div>
            <span
              className={`mt-1 flex-shrink-0 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            >
              ▾
            </span>
          </div>
          <span className="mt-2 inline-block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
            {es ? 'Regla' : 'Rule'} #{index + 1}
            {hasSteps && ` · ${steps.length} ${es ? 'pasos' : 'steps'}`}
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`rule-body-${rule.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-4 px-4 pb-5 pt-4 lg:px-5 lg:pb-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
                <motion.div className="min-w-0 flex-1 space-y-4" layout>
                  <p className="text-ui-sm leading-relaxed text-neutral-300">{rule.desc}</p>

                  {rule.bullets && rule.bullets.length > 0 && (
                    <ul className="rules-bullet-list space-y-2 text-ui-sm text-neutral-400">
                      {rule.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}

                  {rule.tip && (
                    <p className="rules-tip text-ui-sm">
                      <span className="font-semibold text-accent">
                        {es ? 'En la partida: ' : 'In-game: '}
                      </span>
                      {rule.tip}
                    </p>
                  )}
                </motion.div>

                {currentStep && (
                  <div className="flex flex-shrink-0 flex-col items-center gap-3">
                    <MiniBoard
                      squares={currentStep.board}
                      sqPx={sqPx}
                      stepKey={`${rule.id}-${step}`}
                    />
                    <p className="max-w-[220px] text-center text-ui-xs text-neutral-500">
                      {currentStep.caption}
                    </p>

                    {hasSteps && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rules-step-btn"
                          disabled={step === 0}
                          onClick={(e) => {
                            e.stopPropagation()
                            setStep((s) => Math.max(0, s - 1))
                          }}
                          aria-label={es ? 'Paso anterior' : 'Previous step'}
                        >
                          ←
                        </button>
                        <span className="min-w-[4.5rem] text-center text-ui-xs text-neutral-500">
                          {step + 1} / {steps.length}
                        </span>
                        <button
                          type="button"
                          className="rules-step-btn"
                          disabled={step >= steps.length - 1}
                          onClick={(e) => {
                            e.stopPropagation()
                            setStep((s) => Math.min(steps.length - 1, s + 1))
                          }}
                          aria-label={es ? 'Paso siguiente' : 'Next step'}
                        >
                          →
                        </button>
                      </div>
                    )}

                    {hasSteps && (
                      <div className="flex gap-1.5">
                        {steps.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            className={`h-1.5 rounded-full transition-all ${
                              i === step
                                ? 'w-5 bg-accent'
                                : 'w-1.5 bg-surface-4 hover:bg-neutral-500'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setStep(i)
                            }}
                            aria-label={`${es ? 'Paso' : 'Step'} ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  )
}
