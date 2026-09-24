import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
})

test('invalid deep links redirect to their canonical screen', async ({ page }) => {
  await page.goto('/play')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('home-learn-primary')).toBeVisible()

  await page.goto('/learn/does-not-exist')
  await expect(page).toHaveURL(/\/learn$/)
  await expect(page.getByTestId('academy-module').first()).toBeVisible()
})

test('browser history moves between screens driven by the URL', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('home-learn-primary').click()
  await expect(page).toHaveURL(/\/learn$/)

  await page.locator('[data-lesson-id="classic-board-lesson"]').click()
  await expect(page).toHaveURL(/\/learn\/classic-board-lesson$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/learn$/)
  await expect(page.getByTestId('academy-module').first()).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('home-learn-primary')).toBeVisible()
})
