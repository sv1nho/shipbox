import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('../../api/shipments.js', () => ({ listShipments: vi.fn() }))

import { useShipmentList } from '../../shipments/useShipmentList.js'
import { listShipments } from '../../api/shipments.js'
import { makeShipment } from '../fixtures.js'
import type { ListResult } from '../../../shared/shipment.js'

type Pending = {
  signal: AbortSignal | undefined
  resolve: (result: ListResult) => void
  reject: (cause: unknown) => void
}

const listed = (store: string): ListResult => ({
  items: [makeShipment({ store })],
  total: 1,
  page: 1,
  pageSize: 20,
})

let pending: Pending[] = []

const flush = async () => { await act(async () => { await Promise.resolve() }) }

beforeEach(() => {
  pending = []
  vi.mocked(listShipments).mockImplementation(
    (_params, signal) => new Promise<ListResult>((resolve, reject) => {
      pending.push({ signal, resolve, reject })
    })
  )
})

describe('useShipmentList', () => {
  it('asks again when the filters change, and aborts the request it no longer needs', async () => {
    const { rerender } = renderHook(({ search }) => useShipmentList(search), {
      initialProps: { search: '' },
    })

    await waitFor(() => { expect(pending).toHaveLength(1) })

    rerender({ search: 'status=received' })

    expect(pending[0].signal?.aborted).toBe(true)
    expect(pending).toHaveLength(2)
  })

  it('ignores a stale answer that lands after the filters moved on', async () => {
    const { result, rerender } = renderHook(({ search }) => useShipmentList(search), {
      initialProps: { search: '' },
    })

    await waitFor(() => { expect(pending).toHaveLength(1) })
    rerender({ search: 'status=received' })

    pending[1].resolve(listed('Decathlon'))
    pending[0].resolve(listed('Zalando'))
    await flush()

    expect(result.current.result?.items[0].store).toBe('Decathlon')
  })

  it('never reports the failure of a request it abandoned on purpose', async () => {
    const { result, rerender } = renderHook(({ search }) => useShipmentList(search), {
      initialProps: { search: '' },
    })

    await waitFor(() => { expect(pending).toHaveLength(1) })
    rerender({ search: 'status=received' })

    pending[0].reject(new DOMException('Aborted', 'AbortError'))
    await flush()

    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('fetches again on demand without touching the filters', async () => {
    const { result } = renderHook(() => useShipmentList('status=received'))

    await waitFor(() => { expect(pending).toHaveLength(1) })
    pending[0].resolve(listed('Zalando'))
    await flush()

    act(() => { result.current.reload() })

    await waitFor(() => { expect(pending).toHaveLength(2) })
    expect(vi.mocked(listShipments).mock.calls[1][0]).toMatchObject({ status: 'received' })
  })
})
