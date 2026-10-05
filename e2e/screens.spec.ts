import { test } from '@playwright/test'

const WIDTHS = [
  ['phone', 390],
  ['tablet', 768],
  ['laptop', 1280],
  ['desktop', 1920],
] as const

const PAGES = [
  ['home', '/', 'ShipBox'],
  ['form', '/form', 'Sender'],
  ['shipments', '/shipments', 'Shipments'],
  ['dashboard', '/dashboard', 'Dashboard'],
] as const

test.describe('how every page looks', () => {
  test.skip(process.env.SHOTS !== 'true', 'Run with SHOTS=true to collect the screenshots')

  for (const [screen, width] of WIDTHS) {
    for (const [name, path, waitFor] of PAGES) {
      test(`${name} on a ${screen}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(path)
        await page.getByText(waitFor).first().waitFor()
        await page.waitForTimeout(400)

        await page.screenshot({ path: `e2e/.shots/${screen}-${name}.png`, fullPage: true })
      })
    }
  }
})
