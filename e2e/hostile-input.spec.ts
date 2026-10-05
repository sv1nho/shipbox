import { test, expect } from '@playwright/test'

const HOSTILE = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "'; DROP TABLE shipments; --",
  '{{7*7}}',
  '../../etc/passwd',
  'a'.repeat(3000),
  '𝕏'.repeat(200),
  'line\nbreak\ttab',
  '%00%0d%0a',
  '&amp;&lt;&gt;&quot;',
]

test.describe('what the forms do with hostile text', () => {
  test.skip(process.env.FUZZ_UI !== 'true', 'Run with FUZZ_UI=true to throw text at the forms')

  for (const [index, text] of HOSTILE.entries()) {
    test(`the label form survives payload ${String(index + 1)}`, async ({ page }) => {
      const broken: string[] = []

      page.on('pageerror', (error) => broken.push(error.message))

      await page.goto('/form')

      const sender = page.locator('.card').filter({ hasText: 'SENDER' })

      await sender.getByLabel('First name').fill(text)
      await sender.getByLabel('Last name').fill(text)
      await sender.getByLabel('Address').fill(text)
      await sender.getByLabel('City').fill(text)
      await page.getByLabel('Tracking Number').fill(text)
      await page.getByRole('button', { name: 'Generate Label' }).click()

      await expect(page.getByRole('button', { name: 'Generate Label' })).toBeVisible()
      expect(broken).toEqual([])
    })

    test(`the tracking dialog survives payload ${String(index + 1)}`, async ({ page }) => {
      const broken: string[] = []

      page.on('pageerror', (error) => broken.push(error.message))

      await page.goto('/shipments')
      await page.getByRole('button', { name: 'Track a return' }).first().click()

      const dialog = page.getByRole('dialog')

      await dialog.getByLabel('Tracking number').fill(text)
      await dialog.getByLabel('Store', { exact: true }).fill(text)
      await dialog.getByLabel('Amount').fill(text)
      await dialog.getByLabel('Postal code').fill(text)
      await dialog.getByLabel('Order number').fill(text)
      await dialog.getByRole('button', { name: 'Track it' }).click()

      await expect(dialog).toBeVisible()
      expect(broken).toEqual([])
    })

    test(`a crafted link survives payload ${String(index + 1)}`, async ({ page }) => {
      const broken: string[] = []

      page.on('pageerror', (error) => broken.push(error.message))

      const query = new URLSearchParams({
        page: text,
        sort: text,
        status: text,
        store: text,
        search: text,
      })

      await page.goto(`/shipments?${query.toString()}`)

      await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible()
      expect(broken).toEqual([])
    })
  }
})
