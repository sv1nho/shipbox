import type { Locator, Page } from '@playwright/test'

type Return = {
  tracking: string
  store: string
  amount: string
  postalCode: string
  orderNumber: string
}

export const trackReturn = async (page: Page, shipment: Return): Promise<Locator> => {
  await page.getByRole('button', { name: 'Track a return' }).first().click()

  const form = page.getByRole('dialog')

  await form.getByLabel('Tracking number').fill(shipment.tracking)
  await form.getByLabel('Store', { exact: true }).fill(shipment.store)
  await form.getByLabel('Amount').fill(shipment.amount)
  await form.getByLabel('Postal code').fill(shipment.postalCode)
  await form.getByLabel('Order number').fill(shipment.orderNumber)
  await form.getByRole('button', { name: 'Track it' }).click()

  return page.locator('.shipment-row').filter({ hasText: shipment.tracking })
}
