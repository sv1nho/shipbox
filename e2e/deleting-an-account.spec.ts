import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { trackReturn } from './track-a-return.js'

const LEAVING = {
  name: 'Leaving Test',
  email: 'leaving-test@shipbox.test',
  password: 'a-password-only-the-browser-tests-use',
}

const TRACKING = '323200000000000000004054'

test.use({ storageState: { cookies: [], origins: [] } })

const signUp = async (request: APIRequestContext): Promise<void> => {
  const created = await request.post('/api/auth/sign-up/email', { data: LEAVING })

  expect(created.ok(), await created.text()).toBe(true)
}

test('deletes the account, and everything it held goes with it', async ({ page }) => {
  await signUp(page.request)

  await page.goto('/shipments')

  await expect(await trackReturn(page, {
    tracking: TRACKING,
    store: 'Bol',
    amount: '12.00',
    postalCode: '3000',
    orderNumber: 'BOL-2026-0054',
  })).toBeVisible()

  await page.goto('/account')

  await expect(page.getByText(LEAVING.email)).toBeVisible()

  await page.getByRole('button', { name: 'Delete my account' }).click()

  const dialog = page.getByRole('dialog')

  await expect(dialog).toContainText(`Delete the account of ${LEAVING.email}?`)
  await dialog.getByRole('button', { name: 'Delete my account' }).click()

  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()

  await signUp(page.request)
  await page.goto('/shipments')

  await expect(page.locator('.shipment-row')).toHaveCount(0)
})
