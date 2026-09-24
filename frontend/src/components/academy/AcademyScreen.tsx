import { useMemo, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import type { AcademyProgressController } from '../../hooks/useAcademyProgress'
import {
  ACADEMY_LESSON_BY_ID,
  getCourseModules,
  getModuleLessons,
} from '../../lib/academyContent'
import {
  getAcademyRecommendation,
  getCourseCompletion,
  getDueLessons,
  isLessonUnlocked,
  selectDailyLesson,
} from '../../lib/academyProgress'
import { academyCopy, getActivityKindLabel, getCourseLabel } from '../../lib/academyCopy'
import { textFor, type CourseId, type LessonDefinition } from '../../lib/academyTypes'
import type { Language } from '../../lib/types'
import { FEATURES } from '../../lib/featureFlags'
import GameIcon from '../GameIcon'
import QuantumLogo from '../QuantumLogo'

interface AcademyScreenProps {
  language: Language
  academy: AcademyProgressController
  onBack: () => void
  onOpenSettings: () => void
  onOpenLesson: (lessonId: string, source?: 'route' | 'review' | 'daily' | 'error') => void
  onOpenSprint: (minutes: 3 | 5 | 10) => void
}

export default function AcademyScreen({
  language,
  academy,
  onBack,
  onOpenSettings,
  onOpenLesson,
  onOpenSprint,
}: AcademyScreenProps) {
  const { progress, loading, selectCourse, completeDiagnostic } = academy
  const [diagnosticOpen, setDiagnosticOpen] = useState(false)
  const [diagnosticNotice, setDiagnosticNotice] = useState(false)
  const reduceMotion = useReducedMotion()
  const copy = academyCopy(language)
  const course = progress.selectedCourse
  const modules = useMemo(() => getCourseModules(course), [course])
  const lessons = useMemo(() => modules.flatMap((module) => getModuleLessons(module.id)), [modules])
  const recommendation = getAcademyRecommendation(progress, course)
  const dueLessons = getDueLessons(progress, new Date(), course)
  const completion = getCourseCompletion(progress, course)
  const averageMastery = Math.round(
    modules.reduce((total, module) => total + (progress.mastery[module.skillId]?.mastery ?? 0), 0)
      / modules.length,
  )
  const wrongAttempts = progress.attempts.filter((attempt) => {
    const lesson = ACADEMY_LESSON_BY_ID.get(attempt.lessonId)
    return !attempt.correct && lesson?.course === course
  })
  const latestWrong = wrongAttempts[wrongAttempts.length - 1]
  const today = new Date().toISOString().slice(0, 10)
  const dailyLesson = selectDailyLesson(today, course)

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface-0 px-6 text-ink">
        <div className="w-full max-w-xl border border-line bg-surface-1 p-8" role="status">
          <div className="h-2 w-24 animate-pulse bg-quantum/50" />
          <div className="mt-6 h-10 w-4/5 animate-pulse bg-surface-3" />
          <div className="mt-4 h-4 w-full animate-pulse bg-surface-2" />
          <p className="mt-8 text-sm text-ink-secondary">{copy.loading}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-surface-0 pb-24 text-ink md:pb-12">
      <header className="sticky top-0 z-30 border-b border-line bg-surface-0/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-7 lg:px-10">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-3 text-left text-sm font-semibold text-ink-secondary transition-colors hover:text-ink"
          >
            <GameIcon name="chevron" className="rotate-180" />
            <span className="hidden sm:inline">{copy.back}</span>
          </button>
          <div className="flex min-w-0 items-center gap-3">
            <QuantumLogo className="h-8 w-14 shrink-0" title={copy.product} />
            <span className="truncate text-sm font-semibold tracking-[-0.01em]">{copy.product}</span>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="grid min-h-11 min-w-11 place-items-center border border-transparent text-ink-secondary transition-colors hover:border-line hover:bg-surface-1 hover:text-ink"
            aria-label={copy.settings}
          >
            <GameIcon name="settings" className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-7 lg:px-10 lg:py-12">
        <section className="grid gap-8 border-b border-line pb-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-quantum">{copy.eyebrow}</p>
            <h1 className="mt-4 max-w-[17ch] text-[2.25rem] font-semibold leading-[1.03] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              {copy.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink-secondary">{copy.intro}</p>
          </div>
          <div className="border-l-2 border-accent bg-accent/[0.05] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">{copy.streak}</p>
                <p className="mt-2 font-mono text-4xl font-semibold text-ink">{progress.currentStreak}</p>
                <p className="text-sm text-ink-secondary">{copy.days}</p>
              </div>
              <GameIcon name="flame" className="h-8 w-8 text-accent" />
            </div>
          </div>
        </section>

        <section className="mt-8" aria-label={language === 'es' ? 'Selector de ruta' : 'Route selector'}>
          <div className="grid max-w-xl grid-cols-2 border border-line bg-line" role="radiogroup">
            {(['classic', 'quantum'] as CourseId[]).map((candidate) => (
              <button
                key={candidate}
                type="button"
                role="radio"
                aria-checked={course === candidate}
                onClick={() => selectCourse(candidate)}
                className={`min-h-12 bg-surface-0 px-4 text-sm font-semibold transition-colors ${
                  course === candidate
                    ? candidate === 'quantum' ? 'bg-quantum text-on-quantum' : 'bg-accent text-surface-0'
                    : 'text-ink-secondary hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {getCourseLabel(candidate, language)}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-px border border-line bg-line md:grid-cols-[1.3fr_0.7fr_0.7fr]">
          <div className="bg-surface-1 p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{copy.routeProgress}</p>
                <p className="mt-3 font-mono text-4xl font-semibold">{completion}%</p>
              </div>
              <span className="text-sm text-ink-secondary">
                {progress.completedLessonIds.filter((id) => lessons.some((lesson) => lesson.id === id)).length}/32 {copy.completed}
              </span>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden bg-surface-3" aria-hidden="true">
              <m.div
                className={course === 'quantum' ? 'h-full bg-quantum' : 'h-full bg-accent'}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${completion}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.5 }}
              />
            </div>
          </div>
          <div className="bg-surface-1 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{copy.mastery}</p>
            <p className="mt-3 font-mono text-4xl font-semibold">{averageMastery}</p>
            <p className="mt-1 text-sm text-ink-secondary">/ 100</p>
          </div>
          <div className="bg-surface-1 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{copy.reviewQueue}</p>
            <p className="mt-3 font-mono text-4xl font-semibold">{dueLessons.length}</p>
            <p className="mt-1 text-sm text-ink-secondary">{copy.dueReviews}</p>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
          <div className={`relative overflow-hidden border p-6 sm:p-8 ${course === 'quantum' ? 'border-quantum/40 bg-quantum/[0.06]' : 'border-accent/40 bg-accent/[0.05]'}`}>
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-current opacity-[0.08]" aria-hidden="true" />
            <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${course === 'quantum' ? 'text-quantum' : 'text-accent'}`}>
              {copy.next}
            </p>
            {recommendation.lesson ? (
              <>
                <h2 className="mt-4 max-w-[24ch] text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                  {textFor(recommendation.lesson.title, language)}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary">
                  {textFor(recommendation.lesson.summary, language)}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenLesson(
                      recommendation.lesson!.id,
                      recommendation.reason === 'review' ? 'review' : 'route',
                    )}
                    className={`inline-flex min-h-12 items-center gap-3 px-5 text-sm font-semibold ${course === 'quantum' ? 'bg-quantum text-on-quantum hover:bg-quantum-light' : 'bg-accent text-surface-0 hover:bg-accent-hover'}`}
                  >
                    <GameIcon name={recommendation.reason === 'review' ? 'history' : 'play'} />
                    {recommendation.reason === 'review'
                      ? copy.review
                      : recommendation.reason === 'start' ? copy.start : copy.continue}
                  </button>
                  <span className="font-mono text-xs text-ink-secondary">
                    {recommendation.lesson.estimatedMinutes} {copy.minutes} · {getActivityKindLabel(recommendation.lesson.kind, language)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-4 text-2xl font-semibold">{copy.routeComplete}</h2>
                <p className="mt-3 text-sm leading-6 text-ink-secondary">{copy.routeCompleteDetail}</p>
              </>
            )}
          </div>

          <div className="border border-line bg-surface-1 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{copy.diagnostic}</p>
                <p className="mt-3 text-sm leading-6 text-ink-secondary">{copy.diagnosticDetail}</p>
              </div>
              <GameIcon name="target" className="h-6 w-6 text-quantum" />
            </div>
            <button
              type="button"
              onClick={() => { setDiagnosticOpen(true); setDiagnosticNotice(false) }}
              className="mt-5 min-h-11 w-full border border-line px-4 text-sm font-semibold text-ink transition-colors hover:border-quantum hover:text-quantum"
            >
              {progress.diagnosticComplete ? copy.retakeDiagnostic : copy.takeDiagnostic}
            </button>
            {diagnosticNotice && (
              <p className="mt-3 text-xs leading-5 text-emerald-400" role="status">{copy.diagnosticResult}</p>
            )}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="study-modes-title">
          <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{copy.studyModes}</p>
              <h2 id="study-modes-title" className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
                {FEATURES.dailyAndSprint ? `${copy.daily} · ${copy.sprint}` : copy.errorBook}
              </h2>
            </div>
          </div>
          <div className={`grid gap-px border-x border-b border-line bg-line ${FEATURES.dailyAndSprint ? 'md:grid-cols-3' : ''}`}>
            {FEATURES.dailyAndSprint && <ModePanel
              icon="target"
              title={copy.daily}
              detail={copy.dailyDetail}
              action={copy.dailyAction}
              onClick={() => onOpenLesson(dailyLesson.id, 'daily')}
              accent="quantum"
            />}
            {FEATURES.dailyAndSprint && <div className="bg-surface-1 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <GameIcon name="clock" className="h-5 w-5 text-accent" />
                <h3 className="font-semibold">{copy.sprint}</h3>
              </div>
              <p className="mt-3 min-h-10 text-sm leading-5 text-ink-secondary">{copy.sprintDetail}</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {([3, 5, 10] as const).map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => onOpenSprint(minutes)}
                    className="min-h-11 border border-line font-mono text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                  >
                    {minutes === 3 ? copy.sprint3 : minutes === 5 ? copy.sprint5 : copy.sprint10}
                  </button>
                ))}
              </div>
            </div>}
            <ModePanel
              icon="history"
              title={copy.errorBook}
              detail={latestWrong ? textFor(ACADEMY_LESSON_BY_ID.get(latestWrong.lessonId)!.title, language) : copy.errorBookEmpty}
              action={copy.errorBookAction}
              onClick={latestWrong ? () => onOpenLesson(latestWrong.lessonId, 'error') : undefined}
              accent="neutral"
            />
          </div>
        </section>

        <section className="mt-14" aria-labelledby="skill-map-title">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{getCourseLabel(course, language)}</p>
          <h2 id="skill-map-title" className="mt-2 text-3xl font-semibold tracking-[-0.03em]">{copy.skillMap}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">{copy.skillMapIntro}</p>

          <div className="mt-8 space-y-4">
            {modules.map((module, moduleIndex) => {
              const moduleLessons = getModuleLessons(module.id)
              const mastery = progress.mastery[module.skillId]
              const completed = moduleLessons.filter((lesson) => progress.completedLessonIds.includes(lesson.id)).length
              return (
                <m.article
                  key={module.id}
                  data-testid="academy-module"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: reduceMotion ? 0 : 0.25, delay: Math.min(moduleIndex * 0.025, 0.15) }}
                  className="grid border border-line bg-surface-1 lg:grid-cols-[minmax(230px,0.72fr)_minmax(0,1.28fr)]"
                >
                  <div className="border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-r">
                    <div className="flex items-start gap-4">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center border font-mono text-xs font-semibold ${module.accent === 'quantum' ? 'border-quantum/50 text-quantum' : module.accent === 'merge' ? 'border-merge/50 text-merge' : 'border-accent/50 text-accent'}`}>
                        {String(module.order + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-semibold tracking-[-0.015em]">{textFor(module.title, language)}</h3>
                        <p className="mt-2 text-xs leading-5 text-ink-secondary">{textFor(module.summary, language)}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-4 text-xs">
                      <span className="text-ink-secondary">{completed}/4 {copy.completed}</span>
                      <span className="font-mono text-ink">{Math.round(mastery?.mastery ?? 0)} {copy.mastery}</span>
                    </div>
                    {mastery && (
                      <p className="mt-2 text-[0.68rem] text-ink-muted">
                        {mastery.independentPasses} {copy.independent}
                      </p>
                    )}
                  </div>
                  <div className="relative grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
                    {moduleLessons.map((lesson) => (
                      <ActivityButton
                        key={lesson.id}
                        lesson={lesson}
                        language={language}
                        unlocked={isLessonUnlocked(lesson, progress)}
                        completed={progress.completedLessonIds.includes(lesson.id)}
                        latestScore={[...progress.attempts].reverse().find((attempt) => attempt.lessonId === lesson.id)?.score}
                        lockedLabel={copy.locked}
                        minutesLabel={copy.minutes}
                        onClick={() => onOpenLesson(lesson.id, 'route')}
                      />
                    ))}
                  </div>
                </m.article>
              )
            })}
          </div>
        </section>
      </div>

      {diagnosticOpen && (
        <DiagnosticPanel
          key={course}
          course={course}
          language={language}
          onCancel={() => setDiagnosticOpen(false)}
          onComplete={(percentage) => {
            completeDiagnostic(course, percentage)
            setDiagnosticOpen(false)
            setDiagnosticNotice(true)
          }}
        />
      )}
    </main>
  )
}

function ActivityButton({
  lesson,
  language,
  unlocked,
  completed,
  latestScore,
  lockedLabel,
  minutesLabel,
  onClick,
}: {
  lesson: LessonDefinition
  language: Language
  unlocked: boolean
  completed: boolean
  latestScore?: number
  lockedLabel: string
  minutesLabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-testid="academy-activity"
      data-lesson-id={lesson.id}
      onClick={onClick}
      disabled={!unlocked}
      title={!unlocked ? lockedLabel : undefined}
      className={`group relative min-h-[150px] bg-surface-0 p-5 text-left transition-colors ${
        unlocked ? 'hover:bg-surface-2' : 'cursor-not-allowed opacity-55'
      }`}
      aria-label={`${getActivityKindLabel(lesson.kind, language)}: ${textFor(lesson.title, language)}${!unlocked ? `. ${lockedLabel}` : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {getActivityKindLabel(lesson.kind, language)}
        </span>
        <span className={`grid h-7 w-7 place-items-center border ${completed ? 'border-emerald-400/50 text-emerald-400' : unlocked ? 'border-line text-ink-secondary' : 'border-line text-ink-muted'}`}>
          <GameIcon name={completed ? 'check' : unlocked ? 'chevron' : 'lock'} className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-4 line-clamp-2 text-sm font-semibold leading-5 text-ink">{textFor(lesson.title, language)}</p>
      <div className="absolute inset-x-5 bottom-4 flex items-center justify-between gap-3 font-mono text-[0.67rem] text-ink-muted">
        <span>{lesson.estimatedMinutes} {minutesLabel}</span>
        {latestScore !== undefined && <span>{latestScore}/100</span>}
      </div>
    </button>
  )
}

function ModePanel({
  icon,
  title,
  detail,
  action,
  onClick,
  accent,
}: {
  icon: 'target' | 'history'
  title: string
  detail: string
  action: string
  onClick?: () => void
  accent: 'quantum' | 'neutral'
}) {
  return (
    <div className="bg-surface-1 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <GameIcon name={icon} className={`h-5 w-5 ${accent === 'quantum' ? 'text-quantum' : 'text-ink-secondary'}`} />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-3 min-h-10 text-sm leading-5 text-ink-secondary">{detail}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="mt-5 inline-flex min-h-11 items-center gap-2 border-b border-current text-sm font-semibold text-ink transition-colors hover:text-quantum disabled:cursor-not-allowed disabled:opacity-40"
      >
        {action}
        <GameIcon name="chevron" />
      </button>
    </div>
  )
}

function DiagnosticPanel({
  course,
  language,
  onCancel,
  onComplete,
}: {
  course: CourseId
  language: Language
  onCancel: () => void
  onComplete: (percentage: number) => void
}) {
  const copy = academyCopy(language)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const questions = useMemo(() => (
    getCourseModules(course)
      .filter((module) => module.order % 2 === 0)
      .map((module) => getModuleLessons(module.id).find((lesson) => lesson.kind === 'exam')!)
  ), [course])
  const allAnswered = questions.every((question) => answers[question.id] !== undefined)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface-0/90 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="diagnostic-title">
      <div className="mx-auto max-w-3xl border border-line bg-surface-1">
        <div className="flex items-start justify-between gap-4 border-b border-line p-5 sm:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-quantum">{getCourseLabel(course, language)}</p>
            <h2 id="diagnostic-title" className="mt-3 text-2xl font-semibold">{copy.diagnosticTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">{copy.diagnosticIntro}</p>
          </div>
          <button type="button" onClick={onCancel} className="grid min-h-11 min-w-11 place-items-center border border-line text-ink-secondary hover:text-ink" aria-label={copy.cancel}>
            <GameIcon name="close" />
          </button>
        </div>

        <div className="space-y-px bg-line">
          {questions.map((question, questionIndex) => (
            <fieldset key={question.id} className="bg-surface-0 p-5 sm:p-7">
              <legend className="w-full">
                <span className="font-mono text-xs text-ink-muted">{copy.diagnosticQuestion} {questionIndex + 1}/4</span>
                <span className="mt-2 block text-base font-semibold leading-6">{textFor(question.challenge.prompt, language)}</span>
              </legend>
              <div className="mt-4 grid gap-2">
                {question.challenge.options.map((option, optionIndex) => (
                  <button
                    key={optionIndex}
                    type="button"
                    role="radio"
                    aria-checked={answers[question.id] === optionIndex}
                    onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                    className={`min-h-12 border px-4 py-3 text-left text-sm leading-5 transition-colors ${answers[question.id] === optionIndex ? 'border-quantum bg-quantum/10 text-ink' : 'border-line bg-surface-1 text-ink-secondary hover:text-ink'}`}
                  >
                    <span className="mr-3 font-mono text-xs text-ink-muted">{String.fromCharCode(65 + optionIndex)}</span>
                    {textFor(option, language)}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <button type="button" onClick={onCancel} className="min-h-11 px-4 text-sm font-semibold text-ink-secondary hover:text-ink">{copy.cancel}</button>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-ink-muted">{Object.keys(answers).length}/4 {copy.answered}</span>
            <button
              type="button"
              disabled={!allAnswered}
              onClick={() => {
                const correct = questions.filter((question) => answers[question.id] === question.challenge.correctIndex).length
                onComplete((correct / questions.length) * 100)
              }}
              className="min-h-12 bg-quantum px-5 text-sm font-semibold text-on-quantum transition-colors hover:bg-quantum-light disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-muted"
            >
              {copy.finishDiagnostic}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
