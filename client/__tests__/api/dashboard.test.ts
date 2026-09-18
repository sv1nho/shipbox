import { describe, it, expect, vi, afterEach } from 'vitest'
import * as api from '../../api/dashboard.js'

const fetchMock = () =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ decided: 4 }),
  } as unknown as Response)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getDashboard', () => {
  it('asks the summary route and hands back what it answered', async () => {
    const mock = fetchMock()

    expect(await api.getDashboard()).toEqual({ decided: 4 })
    expect(mock.mock.calls[0][0]).toBe('/api/dashboard')
  })

  it('carries the abort signal, so leaving the page cancels the request', async () => {
    const mock = fetchMock()
    const controller = new AbortController()

    await api.getDashboard(controller.signal)

    expect((mock.mock.calls[0][1] as { signal?: AbortSignal }).signal).toBe(controller.signal)
  })
})
