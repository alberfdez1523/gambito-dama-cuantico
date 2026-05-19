import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface GlossaryProps {
  items: { term: string; def: string }[]
  es: boolean
}

export default function Glossary({ items, es }: GlossaryProps) {
  const [openTerm, setOpenTerm] = useState<string | null>(null)

  return (
    <section className="rules-panel" aria-labelledby="glossary-title">
      <h2 id="glossary-title" className="rules-section-title">
        {es ? 'Glosario rápido' : 'Quick glossary'}
      </h2>
      <div className="divide-y divide-surface-4 rounded-lg border border-surface-4 bg-surface-1">
        {items.map((item) => {
          const isOpen = openTerm === item.term
          return (
            <div key={item.term}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/40"
                onClick={() => setOpenTerm(isOpen ? null : item.term)}
                aria-expanded={isOpen}
              >
                <span className="text-ui-sm font-semibold text-accent">{item.term}</span>
                <span
                  className={`text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                >
                  ▾
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 pb-3 text-ui-sm leading-relaxed text-neutral-400">
                      {item.def}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </section>
  )
}
