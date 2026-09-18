import { today } from '../services/shipments/dates.js'

export const daysAgo = (days: number): string => {
  const date = new Date(`${today()}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - days)

  return date.toISOString().slice(0, 10)
}
