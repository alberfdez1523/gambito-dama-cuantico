import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { m, useReducedMotion } from 'framer-motion'
import type {
  GameChromeModel,
  GameNotice,
  GameTone,
} from '../lib/gamePresentation'
import GameIcon from './GameIcon'
import GameMobileStatsSheet from './GameMobileStatsSheet'
import GameViewportShell from './GameViewportShell'
import PlayerBar from './PlayerBar'
import QuantumLogo from './QuantumLogo'

export type GameInspectorTab = 'game' | 'history' | 'analysis'

export interface GameInspectorSlots {
  game: ReactNode
  history: ReactNode
  analysis: ReactNode
}

interface GameScaffoldProps {
  model: GameChromeModel
  board: ReactNode
  inspector: GameInspectorSlots
  onOpenSettings: () => void
  onLeave: () => void | Promise<void>
  contextRail?: ReactNode
  boardControls?: ReactNode
  mobileActions?: ReactNode
  mobileAccessory?: ReactNode
  overlays?: ReactNode
  hasCastleButtons?: boolean
}

const priorityOrder: Record<NonNullable<GameNotice['priority']>, number> = {
  high: 0,
  normal: 1,
  low: 2,
}

const noticeClasses: Record<GameNotice['tone'], string> = {
  neutral: 'border-surface-4 bg-surface-2 text-neutral-300',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  danger: 'border-red-500/25 bg-red-500/10 text-red-200',
}

const connectionClasses: Record<GameTone, string> = {
  neutral: 'border-surface-4 text-neutral-500',
  accent: 'border-current/25 text-accent',
  success: 'border-emerald-400/30 text-emerald-300',
  warning: 'border-amber-400/30 text-amber-300',
  danger: 'border-red-400/30 text-red-300',
}

const statusDotClasses: Record<GameTone, string> = {
  neutral: 'bg-neutral-600',
  accent: 'bg-accent',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-red-400',
}

function useFittedBoardSize() {
  const workspaceRef = useRef<HTMLElement>(null)
  const [size, setSize] = useState<number | null>(null)

  useLayoutEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return

    const update = () => {
      const { width, height } = workspace.getBoundingClientRect()
      const computed = window.getComputedStyle(workspace)
      const horizontalPadding = Number.parseFloat(computed.paddingLeft) + Number.parseFloat(computed.paddingRight)
      const chromeHeight = [...workspace.querySelectorAll<HTMLElement>('[data-game-board-chrome]')]
        .reduce((total, element) => total + element.getBoundingClientRect().height, 0)
      const next = Math.floor(Math.min(width - horizontalPadding, height - chromeHeight))
      if (next > 0) setSize((current) => (current === next ? current : next))
    }

    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }

    const observer = new ResizeObserver(update)
    observer.observe(workspace)
    workspace.querySelectorAll<HTMLElement>('[data-game-board-chrome]').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  return { workspaceRef, size }
}

interface InspectorTabsProps {
  idPrefix: string
  active: GameInspectorTab
  onChange: (tab: GameInspectorTab) => void
  labels: GameChromeModel['labels']['tabs']
  slots: GameInspectorSlots
}

function InspectorTabs({ idPrefix, active, onChange, labels, slots }: InspectorTabsProps) {
  const tabs: GameInspectorTab[] = ['game', 'history', 'analysis']
  const selectByIndex = (index: number) => {
    const next = tabs[(index + tabs.length) % tabs.length]
    onChange(next)
    requestAnimationFrame(() => document.getElementById(`${idPrefix}-game-inspector-tab-${next}`)?.focus())
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="grid shrink-0 grid-cols-3 border-b border-surface-4"
        role="tablist"
        aria-label={labels.game}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            id={`${idPrefix}-game-inspector-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={active === tab}
            aria-controls={`${idPrefix}-game-inspector-panel-${tab}`}
            tabIndex={active === tab ? 0 : -1}
            onClick={() => onChange(tab)}
            onKeyDown={(event) => {
              const index = tabs.indexOf(tab)
              if (event.key === 'ArrowRight') {
                event.preventDefault()
                selectByIndex(index + 1)
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault()
                selectByIndex(index - 1)
              } else if (event.key === 'Home') {
                event.preventDefault()
                selectByIndex(0)
              } else if (event.key === 'End') {
                event.preventDefault()
                selectByIndex(tabs.length - 1)
              }
            }}
            className={`relative min-h-[44px] px-2 text-ui-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current/70 ${
              active === tab
                ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-current'
                : 'text-neutral-600 hover:bg-surface-2 hover:text-neutral-300'
            }`}
          >
            {labels[tab]}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab}
          id={`${idPrefix}-game-inspector-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-game-inspector-tab-${tab}`}
          hidden={active !== tab}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
        >
          {slots[tab]}
        </div>
      ))}
    </div>
  )
}

function GameNotices({ notices }: { notices: GameNotice[] }) {
  if (notices.length === 0) return null

  return (
    <div className="divide-y divide-surface-4" aria-label="Game notices">
      {notices.map((notice) => (
        <div
          key={notice.id}
          role={notice.tone === 'danger' ? 'alert' : 'status'}
          className={`flex min-h-[40px] flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-3 py-2 text-center text-ui-xs lg:px-5 lg:text-ui-sm ${noticeClasses[notice.tone]}`}
        >
          <span>{notice.message}</span>
          {notice.action ? (
            <button
              type="button"
              onClick={notice.action.onSelect}
              className="min-h-[36px] rounded border border-current/35 px-3 py-1 font-semibold transition-colors hover:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              {notice.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export default function GameScaffold({
  model,
  board,
  inspector,
  onOpenSettings,
  onLeave,
  contextRail,
  boardControls,
  mobileActions,
  mobileAccessory,
  overlays,
  hasCastleButtons = false,
}: GameScaffoldProps) {
  const reduceMotion = useReducedMotion()
  const [activeInspectorTab, setActiveInspectorTab] = useState<GameInspectorTab>('game')
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false)
  const { workspaceRef, size } = useFittedBoardSize()
  const notices = [...model.notices].sort(
    (a, b) => priorityOrder[a.priority ?? 'normal'] - priorityOrder[b.priority ?? 'normal'],
  )
  const bannerCount = Math.min(notices.length, 3) as 0 | 1 | 2 | 3
  const isQuantum = model.variant === 'quantum'
  const accent = isQuantum ? 'quantum' : 'gold'
  const fittedStyle = size
    ? ({ '--board-size': `${size}px` } as CSSProperties)
    : undefined

  const header = (
    <header className="flex min-h-12 items-center justify-between border-b border-surface-4 px-3 lg:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <QuantumLogo className="h-7 w-[2.95rem] shrink-0 sm:w-[3.3rem]" />
        <span className="hidden text-ui-sm font-semibold tracking-[-0.02em] text-ink sm:inline">Gambito de Dama</span>
        <span className="truncate text-ui-sm font-medium text-neutral-400">{model.modeLabel}</span>
        {model.roomCode ? (
          <span className="hidden border-l border-surface-4 pl-2 font-mono text-ui-xs text-neutral-500 md:inline">
            {model.roomCode}
          </span>
        ) : null}
        {model.connection ? (
          <span
            className={`hidden rounded-sm border px-1.5 py-0.5 text-ui-xs font-medium sm:inline ${connectionClasses[model.connection.tone]}`}
          >
            {model.connection.label}
          </span>
        ) : null}
      </div>

      <nav className="flex shrink-0 items-center gap-1" aria-label={model.modeLabel}>
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded px-2 text-ui-sm font-medium text-neutral-500 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 sm:px-3"
          aria-label={model.labels.settings}
        >
          <GameIcon name="settings" />
          <span className="hidden md:inline">{model.labels.settings}</span>
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded px-2 text-ui-sm font-medium text-neutral-500 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 sm:px-3"
          aria-label={model.labels.menu}
        >
          <GameIcon name="menu" />
          <span className="hidden md:inline">{model.labels.menu}</span>
        </button>
      </nav>
    </header>
  )

  const mobileFooter = (
    <div
      className="flex items-center gap-2 border-t border-surface-4 bg-surface-0/95 px-2 py-1.5 backdrop-blur"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        onClick={() => setMobileInspectorOpen(true)}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 ${
          isQuantum
            ? 'border-quantum/25 text-quantum hover:bg-quantum/10 focus-visible:ring-quantum/70'
            : 'border-accent/25 text-accent hover:bg-accent/10 focus-visible:ring-accent/70'
        }`}
        aria-label={model.labels.openInspector}
      >
        <GameIcon name="chart" />
      </button>
      {mobileActions ? <div className="flex min-w-0 flex-1 justify-center overflow-hidden">{mobileActions}</div> : null}
      {mobileAccessory}
    </div>
  )

  return (
    <GameViewportShell
      variant={isQuantum ? 'quantum' : 'gold'}
      bannerCount={bannerCount}
      hasCastleButtons={hasCastleButtons}
      header={header}
      banners={notices.length > 0 ? <GameNotices notices={notices} /> : undefined}
      footer={mobileFooter}
    >
      <div
        className={`flex h-full min-h-0 w-full max-w-[96rem] flex-1 overflow-hidden lg:grid ${
          contextRail
            ? 'lg:grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)_minmax(18rem,21rem)]'
            : 'lg:grid-cols-[minmax(0,1fr)_minmax(18rem,21rem)]'
        }`}
      >
        {contextRail ? (
          <m.aside
            className="hidden min-h-0 overflow-y-auto border-r border-surface-4 pr-4 lg:block"
            aria-label={isQuantum ? 'Quantum controls' : 'Game controls'}
            initial={reduceMotion ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
          >
            {contextRail}
          </m.aside>
        ) : null}

        <main
          ref={workspaceRef}
          className="flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-hidden lg:px-5"
          style={fittedStyle}
        >
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden">
            <div className="shrink-0" data-game-board-chrome>
              <PlayerBar {...model.players.top} accent={accent} />
            </div>

            <m.div
              className="shrink-0"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
            >
              {board}
            </m.div>

            <div className="shrink-0" data-game-board-chrome>
              <PlayerBar {...model.players.bottom} accent={accent} />
            </div>

            <div
              className="game-status-row flex w-full shrink-0 items-center justify-center gap-2 py-1"
              style={{ maxWidth: 'var(--board-size)' }}
              aria-live="polite"
              aria-atomic="true"
              data-game-board-chrome
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClasses[model.status.tone]}`} />
              <span className="truncate text-ui-xs text-neutral-500 lg:text-ui-sm">{model.status.message}</span>
            </div>

            {boardControls ? (
              <div
                className="w-full shrink-0"
                style={{ maxWidth: 'var(--board-size)' }}
                data-game-board-chrome
              >
                {boardControls}
              </div>
            ) : null}
          </div>
        </main>

        <m.aside
          className="hidden min-h-0 flex-col overflow-hidden border-l border-surface-4 bg-surface-1/45 lg:flex"
          aria-label={model.labels.inspectorTitle}
          initial={reduceMotion ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, delay: 0.05 }}
        >
          <InspectorTabs
            idPrefix="desktop"
            active={activeInspectorTab}
            onChange={setActiveInspectorTab}
            labels={model.labels.tabs}
            slots={inspector}
          />
        </m.aside>
      </div>

      <GameMobileStatsSheet
        open={mobileInspectorOpen}
        onClose={() => setMobileInspectorOpen(false)}
        language={model.language}
        title={model.labels.inspectorTitle}
      >
        <InspectorTabs
          idPrefix="mobile"
          active={activeInspectorTab}
          onChange={setActiveInspectorTab}
          labels={model.labels.tabs}
          slots={inspector}
        />
      </GameMobileStatsSheet>

      {overlays}
    </GameViewportShell>
  )
}
