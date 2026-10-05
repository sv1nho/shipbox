import { test, expect } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { today } from '../shared/time.js'

const fillParty = async (card: Locator) => {
  await card.getByLabel('First name').fill('Marie')
  await card.getByLabel('Last name').fill('Martin')
  await card.getByLabel('Address').fill('Avenue Centrale 45')
  await card.getByLabel('Postal code').fill('4000')
  await card.getByLabel('City').fill('Liège')
}

test('makes a label, previews it, and downloads it under a dated name', async ({ page }) => {
  await page.goto('/form')

  await fillParty(page.locator('.card').filter({ hasText: 'SENDER' }))
  await fillParty(page.locator('.card').filter({ hasText: 'RECIPIENT' }))
  await page.getByLabel('Tracking Number').fill('323200000000000000004050')

  await page.getByRole('button', { name: 'Generate Label' }).click()

  const preview = page.getByRole('dialog')

  await expect(preview.getByRole('heading', { name: 'Label Preview' })).toBeVisible()
  await expect(preview.getByText(/Tracking: 3232[0-9]{20}/)).toBeVisible()

  const download = page.waitForEvent('download')

  await preview.getByRole('button', { name: 'Download PDF' }).click()

  expect((await download).suggestedFilename()).toBe(`label-bpost-${today()}.pdf`)
})

test('refuses to make a label out of nothing, and says which field is missing', async ({ page }) => {
  await page.goto('/form')

  await page.getByRole('button', { name: 'Generate Label' }).click()

  await expect(page.getByText('A first name is required.').first()).toBeVisible()
  await expect(page.locator('.card').filter({ hasText: 'SENDER' }).getByLabel('First name'))
    .toBeFocused()
})
