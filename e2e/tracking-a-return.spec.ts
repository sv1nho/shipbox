import { test, expect } from '@playwright/test'

const TRACKING = '323200000000000000004050'

test('tracks a return, then records its drop-off', async ({ page }) => {
  await page.goto('/shipments')

  await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible()
  await expect(page.getByText('You are not tracking any shipment yet.')).toBeVisible()

  await page.getByRole('button', { name: 'Track a return' }).first().click()

  const dialog = page.getByRole('dialog')

  await dialog.getByLabel('Tracking number').fill(TRACKING)
  await dialog.getByLabel('Store', { exact: true }).fill('Zalando')
  await dialog.getByLabel('Amount').fill('49.99')
  await dialog.getByLabel('Postal code').fill('2000')
  await dialog.getByLabel('Order number').fill('ZAL-2026-0001')
  await dialog.getByRole('button', { name: 'Track it' }).click()

  const row = page.locator('.shipment-row').filter({ hasText: TRACKING })

  await expect(row).toBeVisible()
  await expect(row.getByText('Zalando')).toBeVisible()
  await expect(row.getByText('€49.99')).toBeVisible()

  await row.getByRole('button', { name: 'Drop off' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()

  await expect(page.getByText('Recorded: Dropped off')).toBeVisible()
  await expect(row.locator('.status-pill')).toHaveText('Dropped off')
})

test('keeps the return after a reload, since the server holds it', async ({ page }) => {
  await page.goto('/shipments')

  await expect(page.locator('.shipment-row').filter({ hasText: TRACKING })).toBeVisible()
})
