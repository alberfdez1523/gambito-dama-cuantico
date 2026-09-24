import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
})

const SCREENS = [
  { name: 'home', path: '/', ready: '[data-testid="home-learn-primary"]' },
  { name: 'academy', path: '/learn', ready: '[data-testid="academy-module"]' },
  { name: 'lesson', path: '/learn/classic-board-lesson', ready: '.academy-board' },
  { name: 'rules', path: '/rules', ready: 'h1' },
  { name: 'profile', path: '/profile', ready: 'h1' },
]

for (const screen of SCREENS) {
  test(`${screen.name} has no serious WCAG A/AA violations`, async ({ page }) => {
    await page.goto(screen.path)
    await page.locator(screen.ready).first().waitFor()
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = results.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.slice(0, 5).map((node) => node.target.join(' ')),
      }))
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })
}
