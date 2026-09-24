import { useEffect, useMemo, useState } from 'react'
import { m } from 'framer-motion'
import type { AcademyProgressController } from '../../hooks/useAcademyProgress'
import { ACADEMY_LESSONS } from '../../lib/academyContent'
import { sprintCopy } from '../../lib/academyCopy'
import { textFor, type CourseId, type LessonDefinition } from '../../lib/academyTypes'
import type { Language } from '../../lib/types'
import GameIcon from '../GameIcon'

interface PuzzleSprintScreenProps {
  minutes: 3 | 5 | 10
  course: CourseId
  language: Language
  academy: AcademyProgressController
  onBack: () => void
}

export default function PuzzleSprintScreen({
  minutes,
  course,
  language,
  academy,
  onBack,
}: PuzzleSprintScreenProps) {
  const copy = sprintCopy(language)
  const [run, setRun] = useState(0)
  const queue = useMemo(() => buildQueue(course, academy.progress.guestId, minutes, run), [academy.progress.guestId, course, minutes, run])
  const [remaining, setRemaining] = useState(minutes * 60)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString())
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [chain, setChain] = useState(0)
  const [bestChain, setBestChain] = useState(0)
  const [finished, setFinished] = useState(false)
  const lesson = queue[questionIndex % queue.length]

  useEffect(() => {
    if (finished) return undefined
    const timer = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(timer)
          setFinished(true)
          return 0
        }
        return value - 1
      })
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [finished, run])

  const restart = () => {
    setRun((value) => value + 1)
    setRemaining(minutes * 60)
    setQuestionIndex(0)
    setStartedAt(new Date().toISOString())
    setScore(0)
    setCorrect(0)
    setChain(0)
    setBestChain(0)
    setFinished(false)
  }

  const answer = (answerIndex: number) => {
    if (finished) return
    const event = academy.submitAttempt({
      lesson,
      answerIndex,
      hintsUsed: 0,
      actionsTaken: 1,
      startedAt,
    })
    if (event.correct) {
      const nextChain = chain + 1
      setCorrect((value) => value + 1)
      setChain(nextChain)
      setBestChain((value) => Math.max(value, nextChain))
      setScore((value) => value + 100 + Math.min(100, nextChain * 10))
    } else {
      setChain(0)
    }
    setQuestionIndex((value) => value + 1)
    setStartedAt(new Date().toISOString())
  }

  const formattedTime = `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`
  const elapsed = minutes * 60 - remaining
  const progress = Math.min(100, (elapsed / (minutes * 60)) * 100)

  return (
    <main className="min-h-screen bg-surface-0 text-ink">
      <header className="border-b border-line bg-surface-1">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-7">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-secondary hover:text-ink">
            <GameIcon name="chevron" className="rotate-180" />
            <span className="hidden sm:inline">{copy.back}</span>
          </button>
          <div className="flex items-center gap-3">
            <GameIcon name="clock" className="text-accent" />
            <h1 className="font-semibold">{copy.title} · {minutes}</h1>
          </div>
          <span className="font-mono text-xs text-ink-muted">#{questionIndex + 1}</span>
        </div>
        <div className="h-1 bg-surface-3" aria-hidden="true">
          <div className="h-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-7 lg:py-12">
        <section className="grid gap-px border border-line bg-line sm:grid-cols-3">
          <SprintMetric label={copy.time} value={formattedTime} emphasized />
          <SprintMetric label={copy.score} value={score.toString()} />
          <SprintMetric label={copy.correct} value={correct.toString()} />
        </section>
        <p className="mt-3 text-center text-xs text-ink-muted">{copy.privateAttempt}</p>

        {!finished ? (
          <m.section
            key={`${run}-${questionIndex}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="mx-auto mt-9 max-w-3xl border border-line bg-surface-1"
          >
            <div className="border-b border-line p-5 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <p className={`text-xs font-semibold uppercase tracking-[0.15em] ${course === 'quantum' ? 'text-quantum' : 'text-accent'}`}>
                  {copy.question} {questionIndex + 1}
                </p>
                <span className="font-mono text-xs text-ink-muted">×{chain}</span>
              </div>
              <h2 className="mt-4 text-xl font-semibold leading-7 sm:text-2xl">{textFor(lesson.challenge.prompt, language)}</h2>
              <p className="mt-2 text-sm text-ink-secondary">{copy.choose}</p>
            </div>
            <div className="grid gap-px bg-line">
              {lesson.challenge.options.map((option, optionIndex) => (
                <button
                  key={optionIndex}
                  type="button"
                  onClick={() => answer(optionIndex)}
                  className="flex min-h-[64px] items-center gap-4 bg-surface-0 px-5 py-4 text-left text-sm text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink sm:px-7"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center border border-line font-mono text-xs text-ink-muted">
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  {textFor(option, language)}
                </button>
              ))}
            </div>
          </m.section>
        ) : (
          <m.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-10 max-w-2xl border border-line bg-surface-1 p-7 text-center sm:p-10">
            <span className="mx-auto grid h-14 w-14 place-items-center border border-accent/50 text-accent">
              <GameIcon name="check" className="h-7 w-7" />
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">{copy.finishTitle}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-secondary">{copy.finishDetail}</p>
            <div className="mt-7 grid grid-cols-3 gap-px border border-line bg-line">
              <SprintMetric label={copy.score} value={score.toString()} />
              <SprintMetric label={copy.correct} value={correct.toString()} />
              <SprintMetric label={copy.streak} value={bestChain.toString()} />
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={restart} className="min-h-12 bg-accent px-5 text-sm font-semibold text-surface-0 hover:bg-accent-hover">{copy.again}</button>
              <button type="button" onClick={onBack} className="min-h-12 border border-line px-5 text-sm font-semibold text-ink hover:border-ink">{copy.map}</button>
            </div>
          </m.section>
        )}
      </div>
    </main>
  )
}

function SprintMetric({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className="bg-surface-1 p-4 text-center sm:p-5">
      <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.13em] text-ink-muted">{label}</span>
      <span className={`mt-2 block font-mono text-2xl font-semibold ${emphasized ? 'text-accent' : 'text-ink'}`}>{value}</span>
    </div>
  )
}

function buildQueue(course: CourseId, guestId: string, minutes: number, run: number): LessonDefinition[] {
  const lessons = ACADEMY_LESSONS.filter((lesson) => lesson.course === course && lesson.kind === 'puzzle')
  const seedText = `${guestId}:${course}:${minutes}:${run}`
  let seed = Array.from(seedText).reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16_777_619), 2_166_136_261) >>> 0
  const shuffled = [...lessons]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0
    const target = seed % (index + 1)
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }

  return shuffled
}

