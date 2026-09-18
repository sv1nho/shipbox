export type StoreStats = {
  store: string
  returns: number
  decided: number
  refunded: number
  measured: number
  averageDecisionDays: number | null
}

export type DashboardSummary = {
  decided: number
  refunded: number
  successRate: number | null
  open: number
  attention: number
  recoveredCents: number
  lostCents: number
  awaitingCents: number
  measuredDecisions: number
  byStore: StoreStats[]
}
