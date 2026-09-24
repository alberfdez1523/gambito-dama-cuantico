import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { translateGameOverInfo, ui } from '../lib/i18n'
import type { GameOverInfo, Language } from '../lib/types'
import GameIcon from './GameIcon'

interface GameOverModalProps {
  info: GameOverInfo | null
  onNewGame: () => void
  /** Reinicia la misma configuración; se omite en partidas online hasta que ambos acepten. */
  onRematch?: () => void
  onReplay?: () => void
  rematchPending?: boolean
  opponentRequestedRematch?: boolean
  language: Language
}

const RESULT_COLOR: Record<GameOverInfo['result'], string> = {
  win: 'text-emerald-300',
  lose: 'text-red-300',
  draw: 'text-ink-secondary',
}

export default function GameOverModal({
  info,
  onNewGame,
  onRematch,
  onReplay,
  rematchPending = false,
  opponentRequestedRematch = false,
  language,
}: GameOverModalProps) {
  const translatedInfo = info ? translateGameOverInfo(info, language) : null
  const t = ui(language)
  const reduceMotion = useReducedMotion()
  const [collapsed, setCollapsed] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const es = language === 'es'

  useEffect(() => {
    if (!info) return
    setCollapsed(false)
    setShareState('idle')
  }, [info])

  const share = async () => {
    if (!translatedInfo) return
    const appName = 'Gambito de Dama Cuántico'
    const text = `${appName} — ${translatedInfo.title}: ${translatedInfo.message}`
    try {
      if (navigator.share) {
        await navigator.share({ title: appName, text, url: window.location.href })
      } else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`)
      }
      setShareState('copied')
    } catch {
      setShareState('failed')
    }
  }

  return (
    <AnimatePresence>
      {translatedInfo && (
        collapsed ? (
          <m.button
            key="result-chip"
            type="button"
            onClick={() => setCollapsed(false)}
            className="fixed bottom-16 right-3 z-[70] flex min-h-11 items-center gap-3 border border-line bg-surface-1 px-4 text-sm font-semibold text-ink shadow-card lg:bottom-6 lg:right-6"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            aria-label={es ? 'Ver resultado de la partida' : 'View game result'}
          >
            <span className={`h-2 w-2 rounded-full ${translatedInfo.result === 'win' ? 'bg-emerald-400' : translatedInfo.result === 'lose' ? 'bg-red-400' : 'bg-ink-secondary'}`} />
            {translatedInfo.title}
            <GameIcon name="chevron" />
          </m.button>
        ) : (
          <m.section
            key="result-panel"
            role="region"
            aria-live="assertive"
            aria-labelledby="game-over-title"
            className="fixed inset-x-0 bottom-0 z-[70] border-t border-line bg-surface-1/95 p-5 shadow-board backdrop-blur-md sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[25rem] sm:border"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-ink-muted">
                  {es ? 'Partida finalizada' : 'Game finished'}
                </p>
                <h2 id="game-over-title" className={`mt-2 font-serif text-3xl ${RESULT_COLOR[translatedInfo.result]}`}>
                  {translatedInfo.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-secondary">{translatedInfo.message}</p>
              </div>
              <span className={`grid h-10 w-10 shrink-0 place-items-center border border-current/30 ${RESULT_COLOR[translatedInfo.result]}`} aria-hidden="true">
                <GameIcon name={translatedInfo.result === 'draw' ? 'history' : 'flag'} className="h-5 w-5" />
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {onRematch && (
                <button
                  type="button"
                  onClick={onRematch}
                  disabled={rematchPending}
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-quantum bg-quantum text-sm font-semibold text-on-quantum transition-colors hover:bg-quantum-light disabled:cursor-wait disabled:border-line disabled:bg-surface-2 disabled:text-ink-muted"
                >
                  <GameIcon name="retry" />
                  {rematchPending
                    ? (es ? 'Esperando al rival' : 'Waiting for opponent')
                    : opponentRequestedRematch
                      ? (es ? 'Aceptar revancha' : 'Accept rematch')
                      : (es ? 'Revancha' : 'Rematch')}
                </button>
              )}
              <button
                type="button"
                onClick={() => void share()}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-line bg-surface-0 text-sm font-semibold text-ink transition-colors hover:border-ink"
              >
                <GameIcon name="share" />
                {shareState === 'copied'
                  ? (es ? 'Copiado' : 'Copied')
                  : shareState === 'failed'
                    ? (es ? 'No disponible' : 'Unavailable')
                    : (es ? 'Compartir' : 'Share')}
              </button>
              {onReplay && (
                <button
                  type="button"
                  onClick={onReplay}
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-line bg-surface-0 text-sm font-semibold text-ink transition-colors hover:border-ink"
                >
                  <GameIcon name="history" />
                  {es ? 'Repetición' : 'Replay'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="min-h-11 border border-line bg-surface-0 px-3 text-sm font-semibold text-ink-secondary transition-colors hover:text-ink"
              >
                {t.viewBoard}
              </button>
              <button
                type="button"
                onClick={onNewGame}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-line bg-surface-0 px-3 text-sm font-semibold text-ink-secondary transition-colors hover:text-ink"
              >
                <GameIcon name="menu" />
                {es ? 'Volver al inicio' : 'Back to home'}
              </button>
            </div>
          </m.section>
        )
      )}
    </AnimatePresence>
  )
}
