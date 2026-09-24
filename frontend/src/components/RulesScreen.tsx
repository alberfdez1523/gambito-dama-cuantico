import { useState, useMemo, useCallback } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import type { Language } from '../lib/types'
import type { RuleCategory } from './rules/types'
import RuleCard from './rules/RuleCard'
import PieceExplorer from './rules/PieceExplorer'
import CaptureFlowLab from './rules/CaptureFlowLab'
import Glossary from './rules/Glossary'
import QuantumTutorial from './rules/QuantumTutorial'
import GameIcon from './GameIcon'
import {
  getClassicRules,
  getQuantumRules,
  getPieceGuide,
  getCaptureScenarios,
  getGlossary,
  getQuickStart,
  getCategoryLabels,
} from './rules/content'
import { useRulesScrollSpy } from './rules/useRulesScrollSpy'

interface RulesScreenProps {
  onBack: () => void
  language: Language
  initialTab?: Tab
}

type Tab = 'classic' | 'quantum' | 'tutorial'

const CATEGORY_ORDER: RuleCategory[] = [
  'intro',
  'movement',
  'captures',
  'special',
  'endgame',
]

export default function RulesScreen({ onBack, language, initialTab = 'quantum' }: RulesScreenProps) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [activeSection, setActiveSection] = useState<string>('')
  const es = language === 'es'
  const isTutorial = tab === 'tutorial'
  const contentTab = tab === 'classic' ? 'classic' : 'quantum'

  const rules = useMemo(
    () => (contentTab === 'classic' ? getClassicRules(es) : getQuantumRules(es)),
    [contentTab, es],
  )
  const categoryLabels = useMemo(() => getCategoryLabels(es), [es])
  const quickStart = useMemo(() => getQuickStart(es, contentTab), [es, contentTab])
  const pieceGuide = useMemo(() => getPieceGuide(es), [es])
  const captureScenarios = useMemo(() => getCaptureScenarios(es), [es])
  const glossary = useMemo(() => getGlossary(es), [es])

  const rulesByCategory = useMemo(() => {
    const map = new Map<RuleCategory, typeof rules>()
    for (const cat of CATEGORY_ORDER) {
      const items = rules.filter((r) => r.category === cat)
      if (items.length > 0) map.set(cat, items)
    }
    return map
  }, [rules])

  const tocItems = useMemo(() => {
    if (isTutorial) {
      return [{ id: 'quantum-tutorial', label: es ? 'Tutorial cuántico' : 'Quantum tutorial' }]
    }

    const items: { id: string; label: string }[] = []
    for (const [, catRules] of rulesByCategory) {
      for (const r of catRules) {
        items.push({ id: `rule-${r.id}`, label: r.title })
      }
    }
    if (tab === 'classic') {
      items.push({
        id: 'piece-explorer',
        label: es ? 'Guía de piezas' : 'Piece guide',
      })
    } else {
      items.push({
        id: 'capture-lab',
        label: es ? 'Laboratorio de capturas' : 'Capture lab',
      })
      items.push({ id: 'glossary', label: es ? 'Glosario' : 'Glossary' })
    }
    return items
  }, [rulesByCategory, tab, es, isTutorial])

  const sectionIds = useMemo(() => tocItems.map((item) => item.id), [tocItems])

  const setActiveSectionStable = useCallback((id: string) => {
    setActiveSection(id)
  }, [])

  const { scrollToSection } = useRulesScrollSpy(sectionIds, setActiveSectionStable)

  const tabTitle =
    tab === 'classic'
      ? es
        ? 'Ajedrez clásico'
        : 'Classic chess'
      : tab === 'tutorial'
        ? es
          ? 'Tutorial cuántico'
          : 'Quantum tutorial'
      : es
        ? 'Ajedrez cuántico'
        : 'Quantum chess'

  return (
    <m.div className="min-h-screen bg-surface-0">
      <header className="sticky top-0 z-30 border-b border-surface-4 bg-surface-0/95 backdrop-blur-sm">
        <m.div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-8">
          <m.div className="flex items-center gap-2.5">
            <GameIcon name="queen" className="h-5 w-5 text-accent" />
            <span className="text-ui-sm font-semibold text-white">
              Gambito de Dama <span className="text-accent">Cuántico</span>
            </span>
          </m.div>
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] rounded-md border border-surface-4 bg-surface-1 px-4 py-2 text-ui-sm font-semibold text-neutral-300 transition-colors hover:border-accent/30 hover:text-white"
          >
            <span className="inline-flex items-center gap-2">
              <GameIcon name="chevron" className="rotate-180" />
              {es ? 'Menú' : 'Menu'}
            </span>
          </button>
        </m.div>
      </header>

      <m.div className="mx-auto max-w-6xl px-4 py-8 lg:flex lg:gap-10 lg:px-8 lg:py-12">
        <nav
          className="rules-toc hidden lg:block lg:w-52 lg:flex-shrink-0"
          aria-label={es ? 'Índice de reglas' : 'Rules index'}
        >
          <p className="mb-3 text-ui-xs font-semibold uppercase tracking-wider text-neutral-600">
            {es ? 'En esta página' : 'On this page'}
          </p>
          <ul className="space-y-1">
            {tocItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`rules-toc-link w-full text-left ${
                    activeSection === item.id ? 'rules-toc-link-active' : ''
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">
          <m.div
            className="mb-8 text-center lg:text-left"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl font-semibold text-white lg:text-4xl">
              {es ? 'Reglas del juego' : 'Game rules'}
            </h1>
            <p className="mt-2 text-ui-sm text-neutral-500">
              {es
                ? 'Aprende con ejemplos interactivos paso a paso'
                : 'Learn with step-by-step interactive examples'}
            </p>
          </m.div>

          <m.div className="mb-8 flex justify-center lg:justify-start">
            <m.div
              role="tablist"
              aria-label={es ? 'Contenido de aprendizaje' : 'Learning content'}
              className="flex rounded-lg bg-surface-2 p-1"
            >
              {(
                [
                  { key: 'classic' as Tab, label: es ? 'Clásico' : 'Classic', icon: 'classic' as const },
                  { key: 'quantum' as Tab, label: es ? 'Cuántico' : 'Quantum', icon: 'atom' as const },
                  { key: 'tutorial' as Tab, label: es ? 'Academia' : 'Academy', icon: 'book' as const },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  data-testid={`rules-tab-${t.key}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => {
                    setTab(t.key)
                  }}
                  className={`min-h-[44px] rounded-md px-5 py-2 text-ui-sm font-semibold transition-colors
                    ${
                      tab === t.key
                        ? t.key === 'quantum' || t.key === 'tutorial'
                          ? 'bg-surface-0 text-indigo-400 shadow-subtle'
                          : 'bg-surface-0 text-accent shadow-subtle'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <GameIcon name={t.icon} />
                    {t.label}
                  </span>
                </button>
              ))}
            </m.div>
          </m.div>

          {!isTutorial && (
            <AnimatePresence mode="wait">
            <m.div
              key={tab}
              className="rules-quickstart mb-10"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <h2 className="mb-3 text-ui-xs font-semibold uppercase tracking-wider text-neutral-600">
                {es ? 'Resumen rápido' : 'Quick summary'} — {tabTitle}
              </h2>
              <m.div className="divide-y divide-line/70 border-y border-line/70">
                {quickStart.map((item) => (
                  <m.div key={item.text} className="flex items-center gap-3 py-3">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-quantum" aria-hidden="true" />
                    <p className="text-ui-sm text-neutral-300">{item.text}</p>
                  </m.div>
                ))}
              </m.div>
            </m.div>
            </AnimatePresence>
          )}

          <m.div className="rules-toc-mobile mb-8 lg:hidden">
            <label htmlFor="rules-jump" className="mb-2 block text-ui-xs text-neutral-600">
              {es ? 'Ir a sección' : 'Jump to section'}
            </label>
            <select
              id="rules-jump"
              className="w-full rounded border border-surface-4 bg-surface-1 px-3 py-2.5 text-ui-sm text-white"
              value={activeSection}
              onChange={(e) => {
                if (e.target.value) scrollToSection(e.target.value)
              }}
            >
              <option value="">{es ? 'Seleccionar…' : 'Select…'}</option>
              {tocItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </m.div>

          <AnimatePresence mode="wait">
            <m.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-10"
            >
              {isTutorial ? (
                <QuantumTutorial es={es} />
              ) : (
                <>
                  {Array.from(rulesByCategory.entries()).map(([category, catRules]) => (
                    <section key={category} aria-labelledby={`cat-${category}`}>
                      <h2 id={`cat-${category}`} className="rules-category-title mb-4">
                        {categoryLabels[category]}
                      </h2>
                      <m.div className="space-y-4">
                        {catRules.map((rule, idx) => (
                          <RuleCard
                            key={rule.id}
                            rule={rule}
                            index={idx}
                            es={es}
                            variant={contentTab}
                            defaultOpen={idx === 0 && category === 'intro'}
                          />
                        ))}
                      </m.div>
                    </section>
                  ))}

                  {tab === 'classic' ? (
                    <m.div id="piece-explorer">
                      <PieceExplorer pieces={pieceGuide} es={es} />
                    </m.div>
                  ) : (
                    <>
                      <m.div id="capture-lab">
                        <CaptureFlowLab scenarios={captureScenarios} es={es} />
                      </m.div>
                      <m.div id="glossary">
                        <Glossary items={glossary} es={es} />
                      </m.div>
                    </>
                  )}
                </>
              )}
            </m.div>
          </AnimatePresence>

          <m.div className="h-16" />
        </main>
      </m.div>
    </m.div>
  )
}
