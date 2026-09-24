import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Chess, type Square } from 'chess.js'
import { m, useReducedMotion } from 'framer-motion'
import type {
  CoherenceLimit,
  Language,
  MoveInfo,
  PieceColor,
  PieceType,
  QState,
  QuantumAction,
  RulesetId,
} from '../lib/types'
import { createSeededQuantumRng, hashQuantumState, QuantumChessEngine } from '../lib/quantumEngine'
import { actionKey, generateLegalQActions } from '../lib/quantumAi'
import { getPieceName } from '../lib/i18n'
import {
  describeQuantumAction,
  neutralQuantumStepFromRecord,
  type NeutralQuantumReplayStep,
} from '../lib/gameReplay'
import { useModalA11y } from '../hooks/useModalA11y'
import Board from './Board'
import QuantumBoard from './QuantumBoard'
import GameIcon from './GameIcon'
import ReplayAnalysisCard from './ReplayAnalysisCard'

type ReplayProps = {
  language: Language
  playerColor: PieceColor
  onClose: () => void
} & (
  | { variant: 'classic'; history: MoveInfo[] }
  | {
      variant: 'quantum'
      snapshots: QState[]
      actions?: NeutralQuantumReplayStep[]
      rulesetId?: Exclude<RulesetId, 'classic'>
      maxCoherence?: CoherenceLimit
    }
)

interface ClassicFrame {
  fen: string
  lastMove: { from: string; to: string } | null
}

function buildClassicFrames(history: MoveInfo[]): ClassicFrame[] {
  const game = new Chess()
  const frames: ClassicFrame[] = [{ fen: game.fen(), lastMove: null }]
  history.forEach((move) => {
    try {
      game.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' })
      frames.push({ fen: game.fen(), lastMove: { from: move.from, to: move.to } })
    } catch {
      // A damaged historical record must not block the rest of the post-game UI.
    }
  })
  return frames
}

export default function GameReplayPanel(props: ReplayProps) {
  const { language, playerColor, onClose, variant } = props
  const es = language === 'es'
  const reduceMotion = useReducedMotion()
  const classicHistory = variant === 'classic' ? props.history : undefined
  const quantumSnapshots = variant === 'quantum' ? props.snapshots : undefined
  const quantumRuleset = variant === 'quantum'
    ? props.rulesetId ?? 'quantum-standard'
    : 'quantum-standard'
  const maxCoherence = variant === 'quantum' ? props.maxCoherence : undefined
  const classicFrames = useMemo(
    () => classicHistory ? buildClassicFrames(classicHistory) : [],
    [classicHistory],
  )
  const quantumActions = useMemo(() => {
    if (variant !== 'quantum') return []
    if (props.actions?.length) return props.actions
    return props.snapshots.slice(1).flatMap((snapshot, frameIndex) => {
      const record = snapshot.history[frameIndex]
      return record ? [neutralQuantumStepFromRecord(record)] : []
    })
  }, [props, variant])
  const frames = variant === 'classic' ? classicFrames : quantumSnapshots ?? []
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [classicBranch, setClassicBranch] = useState<ClassicFrame | null>(null)
  const [quantumBranch, setQuantumBranch] = useState<QState | null>(null)
  const maxIndex = Math.max(0, frames.length - 1)
  const { containerRef, onBackdropClick } = useModalA11y(true, onClose, true)

  const selectedClassicFrame = classicFrames[index] ?? classicFrames[0]
  const selectedQuantumState = quantumSnapshots?.[index] ?? quantumSnapshots?.[0]
  const selectedQuantumAction = quantumActions[index - 1]

  const classicBranchMoves = useMemo(() => {
    if (!classicBranch) return []
    try {
      return new Chess(classicBranch.fen).moves({ verbose: true })
    } catch {
      return []
    }
  }, [classicBranch])

  const quantumBranchActions = useMemo(() => {
    if (!quantumBranch || quantumBranch.gameOver) return []
    try {
      const engine = new QuantumChessEngine(Math.random, {
        rulesetId: quantumRuleset,
        maxCoherence,
      })
      engine.loadState(quantumBranch)
      return generateLegalQActions(engine).slice(0, 32)
    } catch {
      return []
    }
  }, [maxCoherence, quantumBranch, quantumRuleset])

  useEffect(() => {
    setIndex((value) => Math.min(value, maxIndex))
  }, [maxIndex])

  useEffect(() => {
    setClassicBranch(null)
    setQuantumBranch(null)
  }, [index])

  useEffect(() => {
    if (!playing) return
    if (index >= maxIndex) {
      setPlaying(false)
      return
    }
    const id = window.setTimeout(() => setIndex((value) => Math.min(maxIndex, value + 1)), reduceMotion ? 120 : 900)
    return () => window.clearTimeout(id)
  }, [index, maxIndex, playing, reduceMotion])

  const go = (next: number) => {
    setPlaying(false)
    setIndex(Math.max(0, Math.min(maxIndex, next)))
  }

  const startBranch = () => {
    setPlaying(false)
    if (variant === 'classic' && selectedClassicFrame) {
      setClassicBranch({
        fen: selectedClassicFrame.fen,
        lastMove: selectedClassicFrame.lastMove ? { ...selectedClassicFrame.lastMove } : null,
      })
      return
    }
    if (variant === 'quantum' && selectedQuantumState) {
      setQuantumBranch(structuredClone(selectedQuantumState))
    }
  }

  const applyClassicBranchMove = (from: string, to: string, promotion?: string) => {
    if (!classicBranch) return
    try {
      const game = new Chess(classicBranch.fen)
      game.move({ from, to, promotion: promotion ?? 'q' })
      setClassicBranch({ fen: game.fen(), lastMove: { from, to } })
    } catch {
      // Candidate buttons are generated from this same immutable branch position.
    }
  }

  const applyQuantumBranchAction = (action: QuantumAction) => {
    if (!quantumBranch) return
    try {
      const engine = new QuantumChessEngine(Math.random, {
        rulesetId: quantumRuleset,
        maxCoherence,
      })
      engine.loadState(quantumBranch)
      const seed = `${hashQuantumState(quantumBranch)}:branch:${quantumBranch.history.length}`
      const result = engine.applyAction(
        action,
        createSeededQuantumRng(seed, quantumBranch.rngCounter),
      )
      setQuantumBranch(result.state)
    } catch {
      // A rejected candidate never changes the original replay or the branch.
    }
  }

  const boardStyle = {
    '--board-size': 'min(calc(100vw - 2rem), calc(100dvh - 16rem), 36rem)',
  } as CSSProperties

  const moveLabel = variant === 'classic'
    ? classicHistory?.[index - 1]?.san ?? (es ? 'Posición inicial' : 'Initial position')
    : selectedQuantumAction
      ? describeQuantumAction(selectedQuantumAction.action, language)
      : (es ? 'Estado inicial' : 'Initial state')

  const measurements = variant === 'quantum' && index > 0
    ? selectedQuantumAction?.measurements ?? []
    : []

  return (
    <m.div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onBackdropClick}
      role="presentation"
    >
      <m.section
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="replay-title"
        className="flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden border border-line bg-surface-1 shadow-board sm:max-h-[94dvh]"
        initial={reduceMotion ? false : { y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex min-h-14 items-center justify-between border-b border-line px-4 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-muted">{es ? 'Postpartida' : 'Post-game'}</p>
            <h2 id="replay-title" className="font-serif text-xl text-ink">{es ? 'Repetición de la partida' : 'Game replay'}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid min-h-11 min-w-11 place-items-center text-ink-secondary hover:text-ink" aria-label={es ? 'Cerrar repetición' : 'Close replay'}>
            <GameIcon name="close" className="h-5 w-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="flex min-h-0 items-center justify-center overflow-hidden p-3 sm:p-5" style={boardStyle}>
            {variant === 'classic' ? (
              <ClassicReplayBoard
                frame={classicBranch ?? selectedClassicFrame}
                language={language}
                flipped={playerColor === 'b'}
              />
            ) : (
              <QuantumReplayBoard
                state={quantumBranch ?? selectedQuantumState}
                language={language}
                flipped={playerColor === 'b'}
                statusText={quantumBranch ? (es ? 'Rama alternativa' : 'Alternative branch') : moveLabel}
              />
            )}
          </div>

          <aside className="border-t border-line bg-surface-0 p-4 lg:border-l lg:border-t-0 lg:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-quantum">{index} / {maxIndex}</p>
              {(classicBranch || quantumBranch) && (
                <span className="border border-fusion/40 bg-fusion/10 px-2 py-1 text-[10px] font-semibold text-fusion">
                  {es ? 'LABORATORIO' : 'LAB'}
                </span>
              )}
            </div>
            <p className="mt-3 min-h-12 text-sm leading-6 text-ink">{moveLabel}</p>

            {measurements.length > 0 && (
              <div className="mt-4 border-l-2 border-quantum bg-quantum/[0.06] p-3">
                <p className="text-xs font-semibold text-quantum">{es ? 'Traza de medición' : 'Measurement trace'}</p>
                <ol className="mt-2 space-y-2">
                  {measurements.map((event) => (
                    <li key={`${event.step}-${event.target}`} className="flex items-center justify-between gap-3 text-xs text-ink-secondary">
                      <span>{event.step}. {event.target === 'attacker' ? (es ? 'Atacante' : 'Attacker') : (es ? 'Defensor' : 'Defender')}</span>
                      <span className="font-mono text-ink">{event.result === 'alive' ? (es ? 'existe' : 'exists') : (es ? 'ausente' : 'absent')} · {Math.round(event.probability * 100)}%</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {variant === 'classic' ? (
              <ReplayAnalysisCard
                variant="classic"
                language={language}
                index={index}
                previousFen={classicFrames[index - 1]?.fen}
                action={classicHistory?.[index - 1]}
              />
            ) : (
              <ReplayAnalysisCard
                variant="quantum"
                language={language}
                index={index}
                previousState={quantumSnapshots?.[index - 1]}
                action={selectedQuantumAction}
                rulesetId={quantumRuleset}
                maxCoherence={maxCoherence}
              />
            )}

            <section className="mt-5 border-t border-line pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-ink">{es ? '¿Qué habría pasado si…?' : 'What if…?'}</p>
                  <p className="mt-1 text-[11px] leading-5 text-ink-secondary">
                    {es ? 'Crea una rama aislada desde este momento.' : 'Create an isolated branch from this point.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(classicBranch || quantumBranch) ? () => {
                    setClassicBranch(null)
                    setQuantumBranch(null)
                  } : startBranch}
                  className="min-h-11 shrink-0 border border-fusion px-3 text-[11px] font-semibold text-fusion hover:bg-fusion/10"
                >
                  {(classicBranch || quantumBranch)
                    ? (es ? 'Salir' : 'Exit')
                    : (es ? 'Explorar' : 'Explore')}
                </button>
              </div>

              {classicBranch && (
                <div className="mt-3 max-h-52 overflow-y-auto border border-line bg-surface-1 p-2">
                  {classicBranchMoves.length === 0 ? (
                    <p className="p-2 text-xs text-ink-secondary">{es ? 'La rama ha terminado.' : 'The branch has ended.'}</p>
                  ) : classicBranchMoves.map((move) => (
                    <button
                      key={`${move.from}-${move.to}-${move.promotion ?? ''}`}
                      type="button"
                      onClick={() => applyClassicBranchMove(move.from, move.to, move.promotion)}
                      className="mr-1 mt-1 min-h-11 border border-line px-3 font-mono text-xs text-ink hover:border-classic hover:text-classic"
                    >
                      {move.san}
                    </button>
                  ))}
                </div>
              )}

              {quantumBranch && (
                <div className="mt-3 max-h-52 overflow-y-auto border border-line bg-surface-1 p-2">
                  {quantumBranchActions.length === 0 ? (
                    <p className="p-2 text-xs text-ink-secondary">{es ? 'La rama ha terminado.' : 'The branch has ended.'}</p>
                  ) : quantumBranchActions.map((action) => (
                    <button
                      key={actionKey(action)}
                      type="button"
                      onClick={() => applyQuantumBranchAction(action)}
                      className="mb-1 w-full min-h-11 border border-line px-3 text-left text-[11px] text-ink hover:border-quantum hover:text-quantum"
                    >
                      {describeQuantumAction(action, language)}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>

        <footer className="border-t border-line bg-surface-1 px-4 py-3 sm:px-6">
          <input
            type="range"
            min={0}
            max={maxIndex}
            value={index}
            onChange={(event) => go(Number(event.target.value))}
            className="h-6 w-full accent-quantum"
            aria-label={es ? 'Posición de la repetición' : 'Replay position'}
          />
          <div className="mt-2 flex items-center justify-center gap-2">
            <ReplayButton icon="chevron" label={es ? 'Anterior' : 'Previous'} disabled={index === 0} onClick={() => go(index - 1)} iconClass="rotate-180" />
            <ReplayButton icon={playing ? 'pause' : 'play'} label={playing ? (es ? 'Pausar' : 'Pause') : (es ? 'Reproducir' : 'Play')} disabled={maxIndex === 0} onClick={() => { if (index >= maxIndex) setIndex(0); setPlaying((value) => !value) }} primary />
            <ReplayButton icon="chevron" label={es ? 'Siguiente' : 'Next'} disabled={index >= maxIndex} onClick={() => go(index + 1)} />
          </div>
        </footer>
      </m.section>
    </m.div>
  )
}

function ClassicReplayBoard({ frame, language, flipped }: { frame?: ClassicFrame; language: Language; flipped: boolean }) {
  const game = useMemo(() => new Chess(frame?.fen), [frame?.fen])
  const turn = game.turn() as PieceColor
  const passiveColor: PieceColor = turn === 'w' ? 'b' : 'w'
  const getPiece = (square: string) => {
    const piece = game.get(square as Square)
    return piece ? { type: piece.type as PieceType, color: piece.color as PieceColor } : null
  }
  return (
    <Board
      fen={frame?.fen ?? new Chess().fen()}
      selectedSquare={null}
      legalSquares={new Set()}
      lastMove={frame?.lastMove ?? null}
      boardFlipped={flipped}
      isThinking
      playerColor={passiveColor}
      checkSquare={null}
      getPiece={getPiece}
      onSquareClick={() => {}}
      onDrop={() => {}}
      language={language}
    />
  )
}

function QuantumReplayBoard({
  state,
  language,
  flipped,
  statusText,
}: {
  state?: QState
  language: Language
  flipped: boolean
  statusText?: string
}) {
  const engine = useMemo(() => {
    const replayEngine = new QuantumChessEngine()
    if (state) replayEngine.loadState(state)
    return replayEngine
  }, [state])
  const turn = engine.state.turn
  const passiveColor: PieceColor = turn === 'w' ? 'b' : 'w'
  return (
    <QuantumBoard
      board={engine.getBoard()}
      selectedPiece={null}
      legalTargets={new Set()}
      mergeTargets={new Set()}
      moveMode="classical"
      firstQuantumTarget={null}
      lastMove={state?.history.length ? {
        from: state.history[state.history.length - 1].from,
        to: state.history[state.history.length - 1].to,
      } : null}
      boardFlipped={flipped}
      isThinking
      playerColor={passiveColor}
      turnColor={turn}
      onSquareClick={() => {}}
      onDrop={() => {}}
      language={language}
      entanglements={state?.entanglements ?? []}
      statusText={statusText ?? (state?.history.length
        ? `${getPieceName(state.history[state.history.length - 1].pieceType, language)} ${state.history[state.history.length - 1].to}`
        : undefined)}
    />
  )
}

function ReplayButton({
  icon,
  iconClass = '',
  label,
  disabled,
  onClick,
  primary = false,
}: {
  icon: 'chevron' | 'play' | 'pause'
  iconClass?: string
  label: string
  disabled: boolean
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${primary ? 'border-quantum bg-quantum text-on-quantum' : 'border-line bg-surface-0 text-ink'}`}
      aria-label={label}
    >
      <GameIcon name={icon} className={iconClass} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
