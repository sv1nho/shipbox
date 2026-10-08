import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { trackReturn } from './track-a-return.js'

const TRACKING = '323200000000000000004052'
const REIMPORTED = '323200000000000000004053'
const FORMULA = '=1+1'

test('exports a row a spreadsheet cannot run, and takes it back on import', async ({ page }) => {
  await page.goto('/shipments')

  const row = await trackReturn(page, {
    tracking: TRACKING,
    store: 'Coolblue',
    amount: '19.95',
    postalCode: '1000',
    orderNumber: FORMULA,
  })

  await expect(row).toBeVisible()

  await page.getByRole('searchbox').fill(TRACKING)
  await page.getByRole('searchbox').press('Enter')

  await expect(page.locator('.shipment-row')).toHaveCount(1)

  const download = page.waitForEvent('download')

  await page.getByRole('link', { name: 'Export CSV' }).click()

  const exported = readFileSync(await (await download).path(), 'utf8')
  const [header, ...rows] = exported.split('\r\n').filter((line) => line !== '')

  expect(header.split(',')[0]).toBe('trackingNumber')
  expect(rows).toHaveLength(1)
  expect(rows[0]).toContain(`'${FORMULA}`)
  expect(rows[0]).not.toContain(`,${FORMULA},`)

  const again = test.info().outputPath('again.csv')

  writeFileSync(again, [header, rows[0].replace(TRACKING, REIMPORTED)].join('\r\n'))

  await page.getByRole('button', { name: 'Import' }).click()

  const dialog = page.getByRole('dialog')

  await dialog.getByLabel('File').setInputFiles(again)
  await dialog.getByRole('button', { name: 'Import' }).click()

  await expect(dialog.getByText('Imported 1 of 1.')).toBeVisible()

  await dialog.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('searchbox').fill(REIMPORTED)
  await page.getByRole('searchbox').press('Enter')

  await expect(page.locator('.shipment-row').filter({ hasText: REIMPORTED })).toBeVisible()
})
