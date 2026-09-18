import { request } from './client.js'
import type { DashboardSummary } from '../../shared/dashboard.js'

export const getDashboard = (signal?: AbortSignal): Promise<DashboardSummary> =>
  request<DashboardSummary>('/api/dashboard', { signal })
