import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import type { AcademyProgressController } from '../../hooks/useAcademyProgress'
import {
  ACADEMY_LESSONS,
  ACADEMY_MODULE_BY_ID,
  getModuleLessons,
} from '../../lib/academyContent'
import { getActivityKindLabel, lessonCopy } from '../../lib/academyCopy'
import { isLessonUnlocked } from '../../lib/academyProgress'
import { textFor, type AttemptEvent, type LessonDefinition } from '../../lib/academyTypes'
import type { Language } from '../../lib/types'
import GameIcon from '../GameIcon'

interface LessonScreenProps {
  lesson: LessonDefinition
  language: Language
  academy: AcademyProgressController
  source?: 'route' | 'review' | 'daily' | 'error'
  onBack: () => void
  onOpenLesson: (lessonId: string) => void
}

export default function LessonScreen({
  lesson,
  language,
  academy,
  source = 'route',
  onBack,
  onOpenLesson,
}: LessonScreenProps) {
  const copy = lessonCopy(language)
  const reduceMotion = useReducedMotion()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [hintsVisible, setHintsVisible] = useState(0)
  const [attempt, setAttempt] = useState<AttemptEvent | null>(null)
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString())
  const [validationMessage, setValidationMessage] = useState('')
  const [laboratoryOpen, setLaboratoryOpen] = useState(false)

  useEffect(() => {
    setSelectedIndex(null)
    setHintsVisible(0)
    setAttempt(null)
    setStartedAt(new Date().toISOString())
    setValidationMessage('')
    setLaboratoryOpen(false)
  }, [lesson.id])

  const module = ACADEMY_MODULE_BY_ID.get(lesson.moduleId)
  const moduleLessons = getModuleLessons(lesson.moduleId)
  const moduleCompleted = moduleLessons.filter((item) => academy.progress.completedLessonIds.includes(item.id)).length
  const courseLessons = ACADEMY_LESSONS.filter((item) => item.course === lesson.course)
  const lessonIndex = courseLessons.findIndex((item) => item.id === lesson.id)
  const nextLesson = lessonIndex >= 0 ? courseLessons[lessonIndex + 1] : undefined
  const nextUnlocked = nextLesson ? isLessonUnlocked(nextLesson, academy.progress) : false
  const isExam = lesson.kind === 'exam'

  const handleConfirm = () => {
    if (selectedIndex === null) {
      setValidationMessage(copy.answerRequired)
      return
    }

    const event = academy.submitAttempt({
      lesson,
      answerIndex: selectedIndex,
      hintsUsed: hintsVisible,
      actionsTaken: 1,
      startedAt,
    })
    setAttempt(event)
    setValidationMessage('')
  }

  const handleRetry = () => {
    setSelectedIndex(null)
    setHintsVisible(0)
    setAttempt(null)
    setStartedAt(new Date().toISOString())
    setValidationMessage('')
    setLaboratoryOpen(false)
  }

  const progressPercent = Math.round((moduleCompleted / moduleLessons.length) * 100)

  return (
    <main className="min-h-screen bg-surface-0 text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface-0/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-7 lg:px-10">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-secondary hover:text-ink"
          >
            <GameIcon name="chevron" className="rotate-180" />
            <span className="hidden sm:inline">{copy.back}</span>
          </button>
          <div className="min-w-0 text-center">
            <p className={`text-[0.65rem] font-semibold uppercase tracking-[0.16em] ${lesson.course === 'quantum' ? 'text-quantum' : 'text-accent'}`}>
              {getActivityKindLabel(lesson.kind, language)}
            </p>
            <p className="max-w-[42vw] truncate text-sm font-semibold">{textFor(lesson.title, language)}</p>
          </div>
          <span className="min-w-11 text-right font-mono text-xs text-ink-muted">
            {lesson.activityOrder + 1}/4
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[minmax(380px,0.92fr)_minmax(470px,1.08fr)]">
        <section className="relative flex min-h-[42vh] flex-col justify-between overflow-hidden border-b border-line bg-surface-1 p-5 sm:p-8 lg:min-h-0 lg:border-b-0 lg:border-r lg:p-10">
          <div className={`pointer-events-none absolute -right-48 -top-48 h-[32rem] w-[32rem] rounded-full blur-3xl ${lesson.course === 'quantum' ? 'bg-quantum/[0.09]' : 'bg-accent/[0.06]'}`} aria-hidden="true" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{copy.objective}</p>
            <h1 className="mt-4 max-w-[19ch] text-3xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-4xl lg:text-5xl">
              {textFor(lesson.title, language)}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-ink-secondary">
              {textFor(lesson.concept, language)}
            </p>
          </div>

          <div className="relative z-10 my-8 flex justify-center lg:my-10">
            <AcademyBoardPreview lesson={lesson} language={language} />
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="font-semibold text-ink-secondary">{copy.progress}</span>
              <span className="font-mono text-ink-muted">{moduleCompleted}/4</span>
            </div>
            <div className="mt-3 h-1 bg-surface-3">
              <div
                className={lesson.course === 'quantum' ? 'h-full bg-quantum' : 'h-full bg-accent'}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {module && (
              <p className="mt-3 text-xs text-ink-muted">{textFor(module.title, language)}</p>
            )}
          </div>
        </section>

        <section className="relative flex flex-col bg-surface-0 px-4 py-6 sm:px-8 sm:py-9 lg:px-10 lg:py-12">
          <div className="mx-auto w-full max-w-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{copy.activity}</p>
                <h2 className="mt-3 text-xl font-semibold leading-7 sm:text-2xl">
                  {textFor(lesson.challenge.prompt, language)}
                </h2>
              </div>
              <span className="shrink-0 border border-line px-3 py-2 font-mono text-xs text-ink-secondary">
                {lesson.estimatedMinutes} min
              </span>
            </div>

            {(source === 'review' || source === 'error') && (
              <p className="mt-4 border-l-2 border-quantum bg-quantum/[0.06] px-4 py-3 text-xs leading-5 text-ink-secondary">
                {copy.reviewMode}
              </p>
            )}

            {!attempt && (
              <>
                <fieldset className="mt-7">
                  <legend className="mb-3 text-xs font-semibold text-ink-secondary">{copy.choose}</legend>
                  <div className="grid gap-2">
                    {lesson.challenge.options.map((option, optionIndex) => (
                      <button
                        key={optionIndex}
                        type="button"
                        role="radio"
                        aria-checked={selectedIndex === optionIndex}
                        onClick={() => { setSelectedIndex(optionIndex); setValidationMessage('') }}
                        className={`group flex min-h-[58px] items-start gap-4 border px-4 py-4 text-left text-sm leading-5 transition-colors ${
                          selectedIndex === optionIndex
                            ? lesson.course === 'quantum' ? 'border-quantum bg-quantum/[0.09] text-ink' : 'border-accent bg-accent/[0.07] text-ink'
                            : 'border-line bg-surface-1 text-ink-secondary hover:bg-surface-2 hover:text-ink'
                        }`}
                      >
                        <span className={`grid h-6 w-6 shrink-0 place-items-center border font-mono text-[0.68rem] font-semibold ${selectedIndex === optionIndex ? 'border-current' : 'border-line text-ink-muted'}`}>
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span>{textFor(option, language)}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-6 border-y border-line py-4">
                  {isExam ? (
                    <p className="flex min-h-11 items-center gap-3 text-sm text-ink-secondary">
                      <GameIcon name="lock" />
                      {copy.noHintsExam}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setHintsVisible((count) => Math.min(4, count + 1))}
                      disabled={hintsVisible >= 4}
                      className="inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-ink-secondary transition-colors hover:text-quantum disabled:cursor-default disabled:opacity-50"
                    >
                      <GameIcon name="target" />
                      {copy.hint} <span className="font-mono text-xs">{hintsVisible}/4</span>
                    </button>
                  )}

                  <AnimatePresence initial={false}>
                    {hintsVisible > 0 && (
                      <m.ol
                        initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 space-y-2 overflow-hidden"
                        aria-label={copy.hints}
                      >
                        {lesson.hintLadder.slice(0, hintsVisible).map((hint, hintIndex) => (
                          <li key={hintIndex} className="flex gap-3 bg-surface-1 px-4 py-3 text-xs leading-5 text-ink-secondary">
                            <span className="font-mono text-quantum">{hintIndex + 1}</span>
                            <span>{textFor(hint, language)}</span>
                          </li>
                        ))}
                      </m.ol>
                    )}
                  </AnimatePresence>
                </div>

                {validationMessage && <p className="mt-4 text-sm text-red-400" role="alert">{validationMessage}</p>}

                <button
                  type="button"
                  onClick={handleConfirm}
                  className={`mt-6 flex min-h-[54px] w-full items-center justify-between px-5 text-sm font-semibold ${lesson.course === 'quantum' ? 'bg-quantum text-on-quantum hover:bg-quantum-light' : 'bg-accent text-surface-0 hover:bg-accent-hover'}`}
                >
                  {copy.confirm}
                  <GameIcon name="chevron" className="h-5 w-5" />
                </button>
              </>
            )}

            {attempt && (
              <ResultPanel
                attempt={attempt}
                lesson={lesson}
                language={language}
                laboratoryOpen={laboratoryOpen}
                onToggleLaboratory={() => setLaboratoryOpen((open) => !open)}
                onRetry={handleRetry}
                onBack={onBack}
                onNext={nextLesson && nextUnlocked ? () => onOpenLesson(nextLesson.id) : undefined}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function ResultPanel({
  attempt,
  lesson,
  language,
  laboratoryOpen,
  onToggleLaboratory,
  onRetry,
  onBack,
  onNext,
}: {
  attempt: AttemptEvent
  lesson: LessonDefinition
  language: Language
  laboratoryOpen: boolean
  onToggleLaboratory: () => void
  onRetry: () => void
  onBack: () => void
  onNext?: () => void
}) {
  const copy = lessonCopy(language)

  return (
    <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-7" aria-live="polite">
      <div className={`border-l-4 p-5 sm:p-6 ${attempt.correct ? 'border-emerald-400 bg-emerald-500/[0.07]' : 'border-red-400 bg-red-500/[0.07]'}`}>
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${attempt.correct ? 'text-emerald-400' : 'text-red-400'}`}>
              {attempt.correct ? copy.correct : copy.incorrect}
            </p>
            <h3 className="mt-3 text-xl font-semibold">{copy.explanation}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">{textFor(lesson.challenge.explanation, language)}</p>
          </div>
          <div className="grid h-20 w-20 shrink-0 place-items-center border border-line bg-surface-0 text-center">
            <div>
              <span className="block font-mono text-2xl font-semibold">{attempt.score}</span>
              <span className="text-[0.62rem] uppercase tracking-wider text-ink-muted">/100</span>
            </div>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-secondary">
          <GameIcon name={attempt.hintsUsed === 0 ? 'check' : 'target'} className={attempt.hintsUsed === 0 ? 'text-emerald-400' : 'text-quantum'} />
          {attempt.hintsUsed === 0 ? copy.independent : `${copy.assisted} · ${attempt.hintsUsed}/4`}
        </p>
      </div>

      <div className="mt-4 border border-line bg-surface-1">
        <button
          type="button"
          onClick={onToggleLaboratory}
          className="flex min-h-[58px] w-full items-center justify-between gap-4 px-5 text-left text-sm font-semibold text-ink hover:bg-surface-2"
          aria-expanded={laboratoryOpen}
        >
          <span>
            {laboratoryOpen ? copy.closeLab : copy.laboratory}
            <span className="mt-1 block text-xs font-normal text-ink-secondary">{copy.laboratoryDetail}</span>
          </span>
          <GameIcon name="chevron" className={`transition-transform ${laboratoryOpen ? 'rotate-90' : ''}`} />
        </button>
        <AnimatePresence initial={false}>
          {laboratoryOpen && (
            <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-line">
              {lesson.challenge.options.map((option, index) => (
                <div key={index} className="grid gap-2 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_180px]">
                  <p className="text-sm text-ink">{textFor(option, language)}</p>
                  <p className={`text-xs leading-5 ${index === lesson.challenge.correctIndex ? 'text-emerald-400' : 'text-ink-secondary'}`}>
                    {index === lesson.challenge.correctIndex ? copy.outcomeCorrect : copy.outcomeWrong}
                  </p>
                </div>
              ))}
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {!attempt.correct ? (
          <button type="button" onClick={onRetry} className="min-h-12 border border-line px-5 text-sm font-semibold text-ink hover:border-quantum hover:text-quantum">
            {copy.retry}
          </button>
        ) : onNext ? (
          <button type="button" onClick={onNext} className={`flex min-h-12 items-center justify-between px-5 text-sm font-semibold ${lesson.course === 'quantum' ? 'bg-quantum text-on-quantum' : 'bg-accent text-surface-0'}`}>
            {copy.next}
            <GameIcon name="chevron" />
          </button>
        ) : null}
        <button type="button" onClick={onBack} className="min-h-12 border border-line px-5 text-sm font-semibold text-ink-secondary hover:text-ink">
          {copy.map}
        </button>
      </div>
    </m.div>
  )
}

function AcademyBoardPreview({ lesson, language }: { lesson: LessonDefinition; language: Language }) {
  const position = useMemo(() => buildPreviewPosition(lesson), [lesson])
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1]
  const description = language === 'es'
    ? `Tablero ilustrativo para ${textFor(lesson.title, language)}. Las ramas cuánticas muestran su porcentaje y un contorno discontinuo.`
    : `Illustrative board for ${textFor(lesson.title, language)}. Quantum branches show a percentage and dashed outline.`

  return (
    <figure className="w-full max-w-[320px]" aria-label={description}>
      <div className="academy-board grid aspect-square grid-cols-8 overflow-hidden border border-line shadow-board">
        {ranks.flatMap((rank, rankIndex) => files.map((file, fileIndex) => {
          const square = `${file}${rank}`
          const item = position[square]
          const light = (rankIndex + fileIndex) % 2 === 0
          return (
            <div
              key={square}
              className={`relative grid place-items-center ${light ? 'sq-light' : 'sq-dark'} ${item?.quantum ? 'academy-board-quantum' : ''} ${item?.highlight === 'merge' ? 'academy-board-merge' : item?.highlight === 'target' ? 'academy-board-target' : ''}`}
            >
              {item?.piece && <span className={`chess-piece-inline !h-auto !w-auto text-[clamp(1.1rem,5.8vw,2.05rem)] ${item.color === 'w' ? 'piece-white' : 'piece-black'}`}>{item.piece}</span>}
              {item?.label && <span className="absolute bottom-0.5 right-0.5 bg-surface-0/90 px-0.5 font-mono text-[0.48rem] font-bold text-quantum">{item.label}</span>}
              {fileIndex === 0 && <span className="absolute left-0.5 top-0.5 font-mono text-[0.42rem] text-ink/55">{rank}</span>}
              {rankIndex === 7 && <span className="absolute bottom-0 left-0.5 font-mono text-[0.42rem] text-ink/55">{file}</span>}
            </div>
          )
        }))}
      </div>
      <figcaption className="sr-only">{description}</figcaption>
    </figure>
  )
}

interface PreviewPiece {
  piece?: string
  color?: 'w' | 'b'
  quantum?: boolean
  label?: string
  highlight?: 'target' | 'merge'
}

function buildPreviewPosition(lesson: LessonDefinition): Record<string, PreviewPiece> {
  if (lesson.course === 'classic') {
    const base: Record<string, PreviewPiece> = {
      e1: { piece: '♔', color: 'w' }, d1: { piece: '♕', color: 'w' },
      c1: { piece: '♗', color: 'w' }, f1: { piece: '♗', color: 'w' },
      b1: { piece: '♘', color: 'w' }, g1: { piece: '♘', color: 'w' },
      d4: { piece: '♙', color: 'w', highlight: 'target' }, e4: { piece: '♙', color: 'w', highlight: 'target' },
      e8: { piece: '♚', color: 'b' }, d8: { piece: '♛', color: 'b' },
      c8: { piece: '♝', color: 'b' }, f8: { piece: '♝', color: 'b' },
      b8: { piece: '♞', color: 'b' }, g8: { piece: '♞', color: 'b' },
      d5: { piece: '♟', color: 'b' }, e5: { piece: '♟', color: 'b' },
    }
    return base
  }

  const isMerge = lesson.moduleId.includes('merge')
  const isTunnel = lesson.moduleId.includes('tunnel')
  return {
    e1: { piece: '♔', color: 'w' }, e8: { piece: '♚', color: 'b' },
    d1: { piece: '♕', color: 'w' }, d8: { piece: '♛', color: 'b' },
    a3: { piece: '♘', color: 'w', quantum: true, label: '50%' },
    c3: { piece: '♘', color: 'w', quantum: true, label: '50%' },
    d4: { highlight: isMerge ? 'merge' : 'target' },
    b6: { piece: '♟', color: 'b', quantum: isTunnel, label: isTunnel ? '40%' : undefined },
    g6: { piece: '♟', color: 'b', quantum: true, label: '60%' },
    h1: { piece: '♖', color: 'w' }, h8: { piece: '♜', color: 'b' },
  }
}

