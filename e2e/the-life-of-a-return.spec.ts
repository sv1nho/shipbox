import { test, expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { trackReturn } from './track-a-return.js'

const TRACKING = '323200000000000000004051'

const rowFor = (page: Page): Locator =>
  page.locator('.shipment-row').filter({ hasText: TRACKING })

const menu = async (page: Page, item: string) => {
  await rowFor(page).getByRole('button', { name: `More actions for ${TRACKING}` }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

test('walks a return from tracked to refunded, one step at a time', async ({ page }) => {
  await page.goto('/shipments')

  const row = await trackReturn(page, {
    tracking: TRACKING,
    store: 'Decathlon',
    amount: '89.90',
    postalCode: '4000',
    orderNumber: 'DEC-2026-0051',
  })

  await expect(row).toBeVisible()

  const record = async (step: string) => {
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()

    await expect(page.getByText(`Recorded: ${step}`)).toBeVisible()
    await expect(row.locator('.status-pill')).toHaveText(step)
  }

  await row.getByRole('button', { name: 'Drop off' }).click()
  await record('Dropped off')

  await row.getByRole('button', { name: 'Receive' }).click()
  await record('Received')

  await row.getByRole('button', { name: 'Decide' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Refunded' }).click()
  await record('Refunded')
})

test('takes the decision back, leaving the reception in place', async ({ page }) => {
  await page.goto('/shipments')

  await expect(rowFor(page).locator('.status-pill')).toHaveText('Refunded')

  await menu(page, 'Undo the decision')

  await expect(rowFor(page).locator('.status-pill')).toHaveText('Received')
})

test('archives the return out of the list, then puts it back', async ({ page }) => {
  await page.goto('/shipments')

  await menu(page, 'Archive')

  await expect(page.getByText('Shipment archived.')).toBeVisible()
  await expect(rowFor(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Archived', exact: true }).click()

  await expect(rowFor(page)).toBeVisible()

  await menu(page, 'Put back in the list')

  await expect(page.getByText('Shipment put back in the list.')).toBeVisible()
})
