// zod/mini ofrece la misma validación con una API funcional que se puede
// eliminar por tree-shaking; la versión completa añadía ~60 kB gzip al arranque.
import * as z from 'zod/mini'

export const ACADEMY_CONTENT_VERSION = '2026.1'
export const ACADEMY_PROGRESS_VERSION = 1 as const

const nonEmpty = () => z.string().check(z.minLength(1))
const intRange = (min: number, max?: number) =>
  max === undefined ? z.int().check(z.minimum(min)) : z.int().check(z.minimum(min), z.maximum(max))

export const courseIdSchema = z.enum(['classic', 'quantum'])
export type CourseId = z.infer<typeof courseIdSchema>

export const activityKindSchema = z.enum(['lesson', 'guided', 'puzzle', 'exam'])
export type ActivityKind = z.infer<typeof activityKindSchema>

export const localizedTextSchema = z.object({
  es: nonEmpty(),
  en: nonEmpty(),
})
export type LocalizedText = z.infer<typeof localizedTextSchema>

export const academyModuleSchema = z.object({
  id: nonEmpty(),
  course: courseIdSchema,
  order: intRange(0),
  skillId: nonEmpty(),
  title: localizedTextSchema,
  summary: localizedTextSchema,
  accent: z.enum(['classic', 'quantum', 'merge', 'neutral']),
})
export type AcademyModule = z.infer<typeof academyModuleSchema>

export const lessonChallengeSchema = z.object({
  prompt: localizedTextSchema,
  options: z.array(localizedTextSchema).check(z.minLength(2), z.maxLength(4)),
  correctIndex: intRange(0),
  explanation: localizedTextSchema,
}).check(
  z.refine((challenge) => challenge.correctIndex < challenge.options.length, {
    message: 'correctIndex must reference an existing option',
    path: ['correctIndex'],
  }),
)

export const lessonDefinitionSchema = z.object({
  id: nonEmpty(),
  contentVersion: nonEmpty(),
  course: courseIdSchema,
  moduleId: nonEmpty(),
  moduleOrder: intRange(0),
  activityOrder: intRange(0, 3),
  kind: activityKindSchema,
  difficulty: intRange(1, 5),
  estimatedMinutes: intRange(1, 30),
  skillIds: z.array(nonEmpty()).check(z.minLength(1)),
  prerequisites: z.array(nonEmpty()),
  title: localizedTextSchema,
  summary: localizedTextSchema,
  concept: localizedTextSchema,
  hintLadder: z.array(localizedTextSchema).check(z.length(4)),
  challenge: lessonChallengeSchema,
})
export type LessonDefinition = z.infer<typeof lessonDefinitionSchema>

export const academyContentSchema = z.object({
  version: nonEmpty(),
  modules: z.array(academyModuleSchema).check(z.length(16)),
  lessons: z.array(lessonDefinitionSchema).check(z.length(64)),
})
export type AcademyContent = z.infer<typeof academyContentSchema>

export interface AttemptEvent {
  id: string
  guestId: string
  lessonId: string
  contentVersion: string
  startedAt: string
  completedAt: string
  answerIndex: number
  correct: boolean
  hintsUsed: number
  actionsTaken: number
  score: number
  validatedOnline: boolean
}

export interface SkillMastery {
  skillId: string
  mastery: number
  confidence: number
  attempts: number
  independentPasses: number
  intervalIndex: number
  lastPracticedAt: string
  nextReviewAt: string
}

export interface AcademyProgress {
  version: typeof ACADEMY_PROGRESS_VERSION
  guestId: string
  selectedCourse: CourseId
  diagnosticComplete: boolean
  completedLessonIds: string[]
  attempts: AttemptEvent[]
  mastery: Record<string, SkillMastery>
  currentStreak: number
  longestStreak: number
  lastStudyDate: string | null
  updatedAt: string
}

export interface AcademyRecommendation {
  lesson: LessonDefinition | null
  reason: 'review' | 'continue' | 'start' | 'complete'
  dueReviewCount: number
}

export interface AttemptScoreInput {
  correct: boolean
  hintsUsed: number
  actionsTaken: number
  idealActions?: number
}

export function textFor(value: LocalizedText, language: 'es' | 'en'): string {
  return value[language]
}
