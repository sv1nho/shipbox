import { AppError } from '../../errors.js'
import type { CreateShipmentInput, ImportOutcome } from '../../../shared/shipment.js'

export type ImportRow = { row: number; input: CreateShipmentInput }

type Creator = (userId: string, input: CreateShipmentInput) => Promise<unknown>

export async function importMany (
  create: Creator,
  userId: string,
  rows: ImportRow[]
): Promise<ImportOutcome> {
  const failures: ImportOutcome['failures'] = []
  let imported = 0

  for (const { row, input } of rows) {
    try {
      await create(userId, input)
      imported += 1
    } catch (cause) {
      if (!(cause instanceof AppError)) throw cause

      failures.push({ row, message: cause.message })
    }
  }

  return { imported, failures }
}
