import { describe, expect, it } from 'vitest'
import { ACADEMY_CONTENT } from './academyContent'
import { academyContentSchema, lessonChallengeSchema } from './academyTypes'

describe('academy content schema', () => {
  it('accepts the shipped curriculum', () => {
    expect(academyContentSchema.safeParse(ACADEMY_CONTENT).success).toBe(true)
  })

  it('rejects a challenge whose correct index has no option', () => {
    const challenge = ACADEMY_CONTENT.lessons[0].challenge
    const result = lessonChallengeSchema.safeParse({ ...challenge, correctIndex: challenge.options.length })
    expect(result.success).toBe(false)
  })

  it('rejects hint ladders that do not have four steps', () => {
    const lesson = ACADEMY_CONTENT.lessons[0]
    const result = academyContentSchema.safeParse({
      ...ACADEMY_CONTENT,
      lessons: [{ ...lesson, hintLadder: lesson.hintLadder.slice(0, 3) }, ...ACADEMY_CONTENT.lessons.slice(1)],
    })
    expect(result.success).toBe(false)
  })
})
