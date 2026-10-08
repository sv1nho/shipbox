import { test, expect } from '@playwright/test'
import { trackReturn } from './track-a-return.js'

const TRACKING = '323200000000000000004050'

test('tracks a return, then records its drop-off', async ({ page }) => {
  await page.goto('/shipments')

  await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible()

  const row = await trackReturn(page, {
    tracking: TRACKING,
    store: 'Zalando',
    amount: '49.99',
    postalCode: '2000',
    orderNumber: 'ZAL-2026-0001',
  })

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
