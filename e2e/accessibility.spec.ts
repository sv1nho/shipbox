import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

const STANDARDS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

const PAGES = [
  ['the home page', '/', 'ShipBox'],
  ['the label form', '/form', 'Sender'],
  ['the shipment list', '/shipments', 'Shipments'],
  ['the dashboard', '/dashboard', 'Dashboard'],
] as const

for (const [what, path, waitFor] of PAGES) {
  test(`${what} meets the accessibility standards`, async ({ page }) => {
    await page.goto(path)
    await page.getByText(waitFor).first().waitFor()

    const { violations } = await new AxeBuilder({ page }).withTags(STANDARDS).analyze()

    expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })
}

test('the add-shipment dialog meets them too, where the focus is trapped', async ({ page }) => {
  await page.goto('/shipments')
  await page.getByRole('button', { name: 'Track a return' }).first().click()
  await page.getByRole('dialog').waitFor()

  const { violations } = await new AxeBuilder({ page }).withTags(STANDARDS).analyze()

  expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
})
