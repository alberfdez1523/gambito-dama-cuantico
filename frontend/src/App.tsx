import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { flushSync } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import StartMenu from './components/StartMenu'
import GameScreen from './components/GameScreen'
import QuantumGameScreen from './components/QuantumGameScreen'
import SettingsPanel from './components/SettingsPanel'
import BoardSkeleton from './components/BoardSkeleton'
const RulesScreen = lazy(() => import('./components/RulesScreen'))
import type { GameConfig } from './lib/types'
import { loadSettings, saveSettings, type AppSettings } from './lib/settings'
import {
  applyThemeToDom,
  runThemeTransition,
  type SettingsChangeMeta,
} from './lib/themeTransition'
import { ui } from './lib/i18n'

function RulesLoadingFallback({ language }: { language: AppSettings['language'] }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-0 px-4">
      <BoardSkeleton />
      <span className="text-sm text-neutral-600">{ui(language).loadingRules}</span>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game' | 'rules'>('menu')
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null)
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const reduceMotion = useReducedMotion()

  const { language } = settings

  useEffect(() => {
    applyThemeToDom(settings.theme)
  }, [])

  useEffect(() => {
    const modeLabel = gameConfig?.gameMode === 'quantum'
      ? language === 'es' ? ' | Modo Cuántico' : ' | Quantum Mode'
      : ''
    document.title = `Gambito de Dama Cuántico${modeLabel}`
  }, [gameConfig, language])

  const handleSettingsChange = useCallback(
    (partial: Partial<AppSettings>, meta?: SettingsChangeMeta) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial }
        if (partial.theme !== undefined && partial.theme !== prev.theme) {
          runThemeTransition(
            partial.theme,
            () => {
              flushSync(() => {
                setSettings(saveSettings(next))
              })
            },
            {
              reducedMotion: !!reduceMotion,
              origin: meta?.themeOrigin,
            },
          )
          return prev
        }
        return saveSettings(next)
      })
    },
    [reduceMotion],
  )

  const handlePlay = useCallback((config: GameConfig) => {
    setGameConfig(config)
    setScreen('game')
  }, [])

  const handleNewGame = useCallback(() => {
    setGameConfig(null)
    setScreen('menu')
  }, [])

  const transition = reduceMotion
    ? { duration: 0.01 }
    : { duration: 0.25, ease: 'easeOut' as const }

  return (
    <>
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={handleSettingsChange}
        language={language}
      />

      <AnimatePresence mode="wait">
        {screen === 'menu' ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            <StartMenu
              onPlay={handlePlay}
              onRules={() => setScreen('rules')}
              language={language}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </motion.div>
        ) : screen === 'rules' ? (
          <motion.div
            key="rules"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            <Suspense fallback={<RulesLoadingFallback language={language} />}>
              <RulesScreen onBack={() => setScreen('menu')} language={language} />
            </Suspense>
          </motion.div>
        ) : gameConfig ? (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            {gameConfig.gameMode === 'quantum' ? (
              <QuantumGameScreen
                config={gameConfig}
                onNewGame={handleNewGame}
                language={language}
                settings={settings}
                onOpenSettings={() => setSettingsOpen(true)}
                onSettingsChange={handleSettingsChange}
              />
            ) : (
              <GameScreen
                config={gameConfig}
                onNewGame={handleNewGame}
                language={language}
                settings={settings}
                onOpenSettings={() => setSettingsOpen(true)}
                onSettingsChange={handleSettingsChange}
              />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
