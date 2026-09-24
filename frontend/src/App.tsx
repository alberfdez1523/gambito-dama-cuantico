import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import StartMenu from './components/StartMenu'
import PrimaryNavigation, { type PrimaryDestination } from './components/PrimaryNavigation'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'
import {
  clearOnlineSession,
  installOnlineUnloadHandlers,
  registerOnlineSession,
  abandonSessionBestEffort,
} from './lib/onlineSessionLifecycle'
import BoardSkeleton from './components/BoardSkeleton'
import { isSupabaseConfigured as isOnlineAvailable, parseRoomCodeFromUrl } from './lib/onlineConfig'
const RulesScreen = lazy(() => import('./components/RulesScreen'))
const OnlineLobby = lazy(() => import('./components/OnlineLobby'))
const GameScreen = lazy(() => import('./components/GameScreen'))
const QuantumGameScreen = lazy(() => import('./components/QuantumGameScreen'))
const AcademyScreen = lazy(() => import('./components/academy/AcademyScreen'))
const LessonScreen = lazy(() => import('./components/academy/LessonScreen'))
const PuzzleSprintScreen = lazy(() => import('./components/academy/PuzzleSprintScreen'))
const ProfileScreen = lazy(() => import('./components/ProfileScreen'))
const SettingsPanel = lazy(() => import('./components/SettingsPanel'))
import type { GameConfig, PlayerColorChoice } from './lib/types'
import { loadSettings, saveSettings, type AppSettings } from './lib/settings'
import {
  applyThemeToDom,
  applyDisplaySettingsToDom,
  runThemeTransition,
  type SettingsChangeMeta,
} from './lib/themeTransition'
import { ui } from './lib/i18n'
import { gameAutosave, type GameAutosave } from './lib/gameAutosave'
import { useAcademyProgress } from './hooks/useAcademyProgress'
import { ACADEMY_LESSON_BY_ID } from './lib/academyContent'
import { FEATURES } from './lib/featureFlags'
import { saveSettingsSnapshot } from './lib/academyStore'

type AppScreen = 'menu' | 'lobby' | 'game' | 'rules' | 'academy' | 'lesson' | 'sprint' | 'profile'

function screenFromPath(pathname: string): AppScreen {
  if (!FEATURES.academy && pathname.startsWith('/learn')) return 'menu'
  if (!FEATURES.dailyAndSprint && /^\/learn\/sprint\//.test(pathname)) return 'academy'
  if (/^\/learn\/sprint\/(3|5|10)\/?$/.test(pathname)) return 'sprint'
  if (pathname.startsWith('/learn/')) return 'lesson'
  if (pathname === '/learn' || pathname === '/learn/') return 'academy'
  if (pathname === '/profile' || pathname === '/profile/') return 'profile'
  if (pathname === '/rules' || pathname === '/rules/') return 'rules'
  if (pathname === '/online' || pathname.startsWith('/join/')) return 'lobby'
  if (pathname === '/play' || pathname === '/play/') return 'game'
  return 'menu'
}

interface ResolvedRoute {
  screen: AppScreen
  /** Ruta canónica a la que hay que redirigir cuando la actual no es válida. */
  redirect?: string
}

/** La URL es la única fuente de verdad de la pantalla activa. */
function resolveRoute(pathname: string, hasActiveGame: boolean): ResolvedRoute {
  if (!FEATURES.academy && pathname.startsWith('/learn')) return { screen: 'menu', redirect: '/' }
  if (!FEATURES.dailyAndSprint && pathname.startsWith('/learn/sprint/')) return { screen: 'academy', redirect: '/learn' }
  const screen = screenFromPath(pathname)
  if (screen === 'game' && !hasActiveGame) return { screen: 'menu', redirect: '/' }
  if (screen === 'lesson') {
    const lessonId = lessonIdFromPath(pathname)
    if (!lessonId || !ACADEMY_LESSON_BY_ID.has(lessonId)) return { screen: 'academy', redirect: '/learn' }
  }
  return { screen }
}

const DEFAULT_LOBBY_PREFS = {
  gameMode: 'classic',
  color: 'w',
  useTimer: false,
  timerMinutes: 10,
  difficulty: 'medium',
} as const satisfies {
  gameMode: GameConfig['gameMode']
  color: PlayerColorChoice
  useTimer: boolean
  timerMinutes: number
  difficulty: GameConfig['difficulty']
}

function lessonIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/learn\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : null
}

function sprintMinutesFromPath(pathname: string): 3 | 5 | 10 {
  const value = Number(pathname.match(/^\/learn\/sprint\/(3|5|10)\/?$/)?.[1])
  return value === 5 || value === 10 ? value : 3
}

function joinCodeFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/join\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]).trim().toUpperCase() : null
}

function ScreenLoadingFallback({
  label,
}: {
  label: string
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-0 px-4">
      <BoardSkeleton />
      <span className="text-sm text-neutral-600">{label}</span>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [rulesInitialTab, setRulesInitialTab] = useState<'quantum' | 'tutorial'>('quantum')
  const [lessonSource, setLessonSource] = useState<'route' | 'review' | 'daily' | 'error'>('route')
  const [lobbyPrefs, setLobbyPrefs] = useState<{
    gameMode: GameConfig['gameMode']
    color: PlayerColorChoice
    useTimer: boolean
    timerMinutes: number
    difficulty: GameConfig['difficulty']
  } | null>(null)
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null)
  const [resumeAutosave, setResumeAutosave] = useState<GameAutosave | null>(null)
  const [gameInstance, setGameInstance] = useState(0)
  const gameConfigRef = useRef<GameConfig | null>(null)
  gameConfigRef.current = gameConfig
  const lobbyRoomIdRef = useRef<string | null>(null)
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [systemReduceMotion, setSystemReduceMotion] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ))
  const reduceMotion = settings.motionPreference === 'reduced'
    || (settings.motionPreference === 'system' && !!systemReduceMotion)
  const academy = useAcademyProgress()

  const { language } = settings

  const route = resolveRoute(location.pathname, gameConfig !== null)
  const screen = route.screen

  useEffect(() => {
    if (route.redirect) navigate(route.redirect, { replace: true })
  }, [navigate, route.redirect])

  useEffect(() => {
    if (screen === 'lobby' && !lobbyPrefs) setLobbyPrefs(DEFAULT_LOBBY_PREFS)
  }, [lobbyPrefs, screen])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    installOnlineUnloadHandlers()
    void gameAutosave.hydrateFromIndexedDb()
  }, [])

  useEffect(() => {
    applyThemeToDom(settings.theme)
    applyDisplaySettingsToDom(settings)
    void saveSettingsSnapshot(settings)
  }, [settings])

  useEffect(() => {
    if (settings.theme !== 'system' && settings.motionPreference !== 'system') return undefined
    const colorQuery = window.matchMedia('(prefers-color-scheme: light)')
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const refresh = () => {
      setSystemReduceMotion(motionQuery.matches)
      applyThemeToDom(settings.theme)
      applyDisplaySettingsToDom(settings)
    }
    colorQuery.addEventListener('change', refresh)
    motionQuery.addEventListener('change', refresh)
    return () => {
      colorQuery.removeEventListener('change', refresh)
      motionQuery.removeEventListener('change', refresh)
    }
  }, [settings])

  useEffect(() => {
    if (screen !== 'menu' || !isOnlineAvailable()) return
    void import('./lib/onlineRoom').then(({ cleanupStaleRooms }) => cleanupStaleRooms(15))
  }, [screen])

  useEffect(() => {
    const roomCode = parseRoomCodeFromUrl()
    if (!roomCode) return

    setLobbyPrefs(DEFAULT_LOBBY_PREFS)
    navigate(`/join/${encodeURIComponent(roomCode)}`, { replace: true })
  }, [navigate])

  useEffect(() => {
    const modeLabel = gameConfig?.gameMode === 'quantum'
      ? ui(language).quantumMode
      : ''
    document.title = `Gambito de Dama Cuántico${modeLabel}`
  }, [gameConfig, language])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen, location.pathname])

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
    gameAutosave.clear()
    if (config.online?.roomId) {
      lobbyRoomIdRef.current = config.online.roomId
      registerOnlineSession(config.online.roomId)
    }
    setResumeAutosave(null)
    setGameInstance((value) => value + 1)
    setGameConfig(config)
    navigate('/play')
  }, [navigate])

  const handleContinue = useCallback((autosave: GameAutosave) => {
    setResumeAutosave(autosave)
    setGameInstance((value) => value + 1)
    setGameConfig({
      playerColor: autosave.config.playerColor,
      difficulty: autosave.config.difficulty,
      opponentMode: autosave.config.opponentMode,
      useTimer: autosave.config.useTimer,
      timerMinutes: autosave.config.timerMinutes,
      gameMode: autosave.type,
      rulesetId: autosave.config.rulesetId ?? (autosave.type === 'classic' ? 'classic' : 'quantum-standard'),
      timeControl: autosave.config.timeControl,
      options: autosave.config.options,
    })
    navigate('/play')
  }, [navigate])

  const handleRematch = useCallback(() => {
    setResumeAutosave(null)
    setGameInstance((value) => value + 1)
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
      navigate('/online')
    },
    [navigate],
  )

  const handleNewGame = useCallback(async () => {
    const cfg = gameConfigRef.current
    const roomId = cfg?.online?.roomId ?? lobbyRoomIdRef.current
    if (roomId) {
      await abandonSessionBestEffort(roomId)
      lobbyRoomIdRef.current = null
      clearOnlineSession()
    }
    setGameConfig(null)
    setResumeAutosave(null)
    setLobbyPrefs(null)
    navigate('/')
  }, [navigate])

  const handlePrimaryNavigation = useCallback((destination: PrimaryDestination) => {
    if (destination === 'home' || destination === 'play') {
      navigate('/')
      if (destination === 'play') {
        window.setTimeout(() => document.getElementById('game-setup')?.scrollIntoView({
          behavior: document.documentElement.dataset.motion === 'reduced' ? 'auto' : 'smooth',
        }), 0)
      }
      return
    }
    if (destination === 'learn') {
      navigate('/learn')
      return
    }
    navigate('/profile')
  }, [navigate])

  const activeLessonId = lessonIdFromPath(location.pathname)
  const activeLesson = activeLessonId ? ACADEMY_LESSON_BY_ID.get(activeLessonId) : undefined
  const showPrimaryNavigation = screen === 'menu' || screen === 'academy' || screen === 'profile'
  const primaryActive: PrimaryDestination = screen === 'academy'
    ? 'learn'
    : screen === 'profile' ? 'profile' : 'home'

  return (
    <>
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel
            open
            onClose={() => setSettingsOpen(false)}
            settings={settings}
            onChange={handleSettingsChange}
            language={language}
          />
        </Suspense>
      )}

      <div>
        {screen === 'menu' ? (
          <div key="menu" className="screen-enter">
            <StartMenu
              onPlay={handlePlay}
              onContinue={handleContinue}
              onOpenOnlineLobby={handleOpenOnlineLobby}
              onRules={() => {
                setRulesInitialTab('quantum')
                navigate('/rules')
              }}
              onQuantumTutorial={() => {
                navigate('/learn')
              }}
              academyProgress={academy.progress}
              language={language}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        ) : screen === 'lobby' && lobbyPrefs ? (
          <div key="lobby" className="screen-enter">
            <Suspense
              fallback={
                <ScreenLoadingFallback
                  label={ui(language).openingRoom}
                />
              }
            >
              <OnlineLobby
                language={language}
                initialGameMode={lobbyPrefs.gameMode}
                initialColor={lobbyPrefs.color}
                useTimer={lobbyPrefs.useTimer}
                timerMinutes={lobbyPrefs.timerMinutes}
                difficulty={lobbyPrefs.difficulty}
                initialJoinCode={joinCodeFromPath(location.pathname) ?? parseRoomCodeFromUrl()}
                onBack={() => void handleNewGame()}
                onRoomActive={(roomId) => {
                  lobbyRoomIdRef.current = roomId
                  registerOnlineSession(roomId)
                }}
                onStart={handlePlay}
              />
            </Suspense>
          </div>
        ) : screen === 'rules' ? (
          <div key="rules" className="screen-enter">
            <Suspense fallback={<ScreenLoadingFallback label={ui(language).loadingRules} />}>
              <RulesScreen
                onBack={() => { navigate('/') }}
                language={language}
                initialTab={rulesInitialTab}
              />
            </Suspense>
          </div>
        ) : screen === 'academy' ? (
          <div key="academy" className="screen-enter">
            <Suspense fallback={<ScreenLoadingFallback label={ui(language).openingAcademy} />}>
              <AcademyScreen
                language={language}
                academy={academy}
                onBack={() => { navigate('/') }}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenLesson={(lessonId, source = 'route') => {
                  setLessonSource(source)
                  navigate(`/learn/${encodeURIComponent(lessonId)}`)
                }}
                onOpenSprint={(minutes) => {
                  navigate(`/learn/sprint/${minutes}`)
                }}
              />
            </Suspense>
          </div>
        ) : screen === 'lesson' && activeLesson ? (
          <div key={`lesson-${activeLesson.id}`} className="screen-enter">
            <Suspense fallback={<ScreenLoadingFallback label={ui(language).preparingActivity} />}>
              <LessonScreen
                lesson={activeLesson}
                language={language}
                academy={academy}
                source={lessonSource}
                onBack={() => { navigate('/learn') }}
                onOpenLesson={(lessonId) => {
                  setLessonSource('route')
                  navigate(`/learn/${encodeURIComponent(lessonId)}`)
                }}
              />
            </Suspense>
          </div>
        ) : screen === 'sprint' ? (
          <div key={`sprint-${location.pathname}`} className="screen-enter">
            <Suspense fallback={<ScreenLoadingFallback label="Puzzle Sprint..." />}>
              <PuzzleSprintScreen
                minutes={sprintMinutesFromPath(location.pathname)}
                course={academy.progress.selectedCourse}
                language={language}
                academy={academy}
                onBack={() => { navigate('/learn') }}
              />
            </Suspense>
          </div>
        ) : screen === 'profile' ? (
          <div key="profile" className="screen-enter">
            <Suspense fallback={<ScreenLoadingFallback label={ui(language).loadingProfile} />}>
              <ProfileScreen
                language={language}
                academy={academy}
                onBack={() => { navigate('/') }}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            </Suspense>
          </div>
        ) : gameConfig ? (
          <div key={`game-${gameInstance}`} className="screen-enter">
            <Suspense
              fallback={
                <ScreenLoadingFallback
                  label={ui(language).loadingGame}
                />
              }
            >
              {gameConfig.gameMode === 'quantum' ? (
                <QuantumGameScreen
                  config={gameConfig}
                  onNewGame={handleNewGame}
                  language={language}
                  settings={settings}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onSettingsChange={handleSettingsChange}
                  resumeAutosave={resumeAutosave}
                  onRematch={gameConfig.opponentMode === 'online' ? undefined : handleRematch}
                />
              ) : (
                <GameScreen
                  config={gameConfig}
                  onNewGame={handleNewGame}
                  language={language}
                  settings={settings}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onSettingsChange={handleSettingsChange}
                  resumeAutosave={resumeAutosave}
                  onRematch={gameConfig.opponentMode === 'online' ? undefined : handleRematch}
                />
              )}
            </Suspense>
          </div>
        ) : null}
      </div>

      {showPrimaryNavigation && (
        <PrimaryNavigation
          language={language}
          active={primaryActive}
          onNavigate={handlePrimaryNavigation}
        />
      )}
      <PwaUpdatePrompt
        language={language}
        canApplyUpdate={screen !== 'game' && screen !== 'lobby'}
      />
    </>
  )
}
