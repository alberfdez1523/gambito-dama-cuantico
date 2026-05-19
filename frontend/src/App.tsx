import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { flushSync } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import StartMenu from './components/StartMenu'
import OnlineLobby from './components/OnlineLobby'
import { abandonOnlineRoom, parseRoomCodeFromUrl } from './lib/onlineRoom'
import GameScreen from './components/GameScreen'
import QuantumGameScreen from './components/QuantumGameScreen'
import SettingsPanel from './components/SettingsPanel'
import BoardSkeleton from './components/BoardSkeleton'
const RulesScreen = lazy(() => import('./components/RulesScreen'))
import type { GameConfig, PlayerColorChoice } from './lib/types'
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
  const [screen, setScreen] = useState<'menu' | 'lobby' | 'game' | 'rules'>('menu')
  const [lobbyPrefs, setLobbyPrefs] = useState<{
    gameMode: GameConfig['gameMode']
    color: PlayerColorChoice
    useTimer: boolean
    timerMinutes: number
    difficulty: GameConfig['difficulty']
  } | null>(null)
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null)
  const gameConfigRef = useRef<GameConfig | null>(null)
  gameConfigRef.current = gameConfig
  const lobbyRoomIdRef = useRef<string | null>(null)
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
    if (config.online?.roomId) {
      lobbyRoomIdRef.current = config.online.roomId
    }
    setGameConfig(config)
    setScreen('game')
  }, [])

  const handleOpenOnlineLobby = useCallback(
    (prefs: {
      gameMode: GameConfig['gameMode']
      color: PlayerColorChoice
      useTimer: boolean
      timerMinutes: number
      difficulty: GameConfig['difficulty']
    }) => {
      setLobbyPrefs(prefs)
      setScreen('lobby')
    },
    [],
  )

  const handleNewGame = useCallback(async () => {
    const cfg = gameConfigRef.current
    const roomId = cfg?.online?.roomId ?? lobbyRoomIdRef.current
    if (roomId) {
      try {
        await abandonOnlineRoom(roomId)
      } catch (e) {
        console.error('[online] abandon on menu failed:', e)
      }
      lobbyRoomIdRef.current = null
    }
    setGameConfig(null)
    setLobbyPrefs(null)
    setScreen('menu')
    if (typeof window !== 'undefined' && window.location.search.includes('room=')) {
      const url = new URL(window.location.href)
      url.searchParams.delete('room')
      window.history.replaceState({}, '', url.pathname + url.hash)
    }
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
              onOpenOnlineLobby={handleOpenOnlineLobby}
              onRules={() => setScreen('rules')}
              language={language}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </motion.div>
        ) : screen === 'lobby' && lobbyPrefs ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            <OnlineLobby
              language={language}
              initialGameMode={lobbyPrefs.gameMode}
              initialColor={lobbyPrefs.color}
              useTimer={lobbyPrefs.useTimer}
              timerMinutes={lobbyPrefs.timerMinutes}
              difficulty={lobbyPrefs.difficulty}
              initialJoinCode={parseRoomCodeFromUrl()}
              onBack={() => void handleNewGame()}
              onRoomActive={(roomId) => {
                lobbyRoomIdRef.current = roomId
              }}
              onStart={handlePlay}
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
