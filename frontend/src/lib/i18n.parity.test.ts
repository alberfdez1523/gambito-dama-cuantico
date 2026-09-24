import { describe, expect, it } from 'vitest'
import { UI_STRINGS } from './i18n'

describe('UI strings', () => {
  it('define the same keys in Spanish and English', () => {
    expect(Object.keys(UI_STRINGS.en).sort()).toEqual(Object.keys(UI_STRINGS.es).sort())
  })
})
