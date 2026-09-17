import { describe, it, expect, vi, afterEach } from 'vitest'
import * as api from '../../api/shipments.js'
import { TRANSITIONS, TRANSITION_ACTIONS } from '../../../shared/transitions.js'

const fetchMock = () =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ stores: ['Zalando'] }),
  } as unknown as Response)

const calledWith = (mock: ReturnType<typeof fetchMock>) => ({
  url: mock.mock.calls[0][0] as string,
  init: mock.mock.calls[0][1] as { method?: string; body?: string },
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the urls each call builds', () => {
  it('lists with no query when nothing is filtered', async () => {
    const mock = fetchMock()
    await api.listShipments()

    expect(calledWith(mock).url).toBe('/api/shipments')
  })

  it('carries every list filter', async () => {
    const mock = fetchMock()
    await api.listShipments({
      carrier: 'bpost',
      status: 'received',
      store: 'Zalando',
      search: 'zal',
      archived: 'only',
      sort: 'waitingDays',
      direction: 'asc',
      page: 2,
      pageSize: 10,
    })

    const url = new URL(calledWith(mock).url, 'http://localhost')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      carrier: 'bpost',
      status: 'received',
      store: 'Zalando',
      search: 'zal',
      archived: 'only',
      sort: 'waitingDays',
      direction: 'asc',
      page: '2',
      pageSize: '10',
    })
  })

  it.each([
    ['revertShipment', () => api.revertShipment('abc'), 'POST', '/api/shipments/abc/revert'],
    ['archiveShipment', () => api.archiveShipment('abc'), 'POST', '/api/shipments/abc/archive'],
    ['unarchiveShipment', () => api.unarchiveShipment('abc'), 'POST', '/api/shipments/abc/unarchive'],
    ['deleteShipment', () => api.deleteShipment('abc'), 'DELETE', '/api/shipments/abc'],
    ['getLabelPayload', () => api.getLabelPayload('abc'), 'GET', '/api/shipments/abc/label'],
    ['updateShipment', () => api.updateShipment('abc', { store: 'Zalando' }), 'PATCH', '/api/shipments/abc'],
    ['importShipments', () => api.importShipments([{ store: 'Zalando' }]), 'POST', '/api/shipments/import'],
  ])('%s calls %s %s', async (_name, run, method, url) => {
    const mock = fetchMock()
    await run()

    expect(calledWith(mock).url).toBe(url)
    expect(calledWith(mock).init.method).toBe(method)
  })

  it('wraps the imported rows in a shipments list', async () => {
    const mock = fetchMock()
    await api.importShipments([{ store: 'Zalando' }])

    expect(calledWith(mock).init.body).toBe('{"shipments":[{"store":"Zalando"}]}')
  })

  it('sends the patch as the body', async () => {
    const mock = fetchMock()
    await api.updateShipment('abc', { requestedDate: '2026-06-01', receivedDate: '2026-06-05' })

    expect(calledWith(mock).init.body).toBe('{"requestedDate":"2026-06-01","receivedDate":"2026-06-05"}')
  })

  it('asks the exists route with both parameters', async () => {
    const mock = fetchMock()
    await api.shipmentExists('postnl', '3SDDRL000000409')

    expect(calledWith(mock).url)
      .toBe('/api/shipments/exists?carrier=postnl&trackingNumber=3SDDRL000000409')
  })

  it('unwraps the store suggestions', async () => {
    fetchMock()

    expect(await api.searchStores('zal')).toEqual(['Zalando'])
  })
})

describe('the writes', () => {
  it('posts a creation to the collection', async () => {
    const mock = fetchMock()
    const input = {
      trackingNumber: '323200000000000000000001',
      carrier: 'bpost',
      recipientPostalCode: '2000',
      recipientCountry: 'BE',
      amountCents: 4999,
      store: 'Zalando',
    } as const

    await api.createShipment(input)

    const { url, init } = calledWith(mock)
    expect(url).toBe('/api/shipments')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body ?? '{}')).toEqual(input)
  })

})

describe('applyTransition', () => {
  it.each(TRANSITION_ACTIONS)('sends %s to its own route with its own date field', async (action) => {
    const mock = fetchMock()
    await api.applyTransition('abc', action, '2026-06-10')

    const { url, init } = calledWith(mock)
    expect(url).toBe(`/api/shipments/abc/${TRANSITIONS[action].path}`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body ?? '{}')).toEqual({ [TRANSITIONS[action].dateField]: '2026-06-10' })
  })

  it('adds the refusal reason only when there is one', async () => {
    const mock = fetchMock()
    await api.applyTransition('abc', 'reject', '2026-06-10', 'Worn item')

    expect(JSON.parse(calledWith(mock).init.body ?? '{}'))
      .toEqual({ decisionDate: '2026-06-10', rejectionReason: 'Worn item' })
  })

  it('uses the url segment from the shared table, never a hand written one', () => {
    expect(TRANSITIONS.drop_off.path).toBe('drop-off')
  })
})

describe('exportUrl', () => {
  it('keeps the filters of the view being exported', () => {
    const url = new URL(api.exportUrl({ status: 'refunded', store: 'Zalando' }, 'csv'), 'http://localhost')

    expect(Object.fromEntries(url.searchParams)).toEqual({
      format: 'csv',
      status: 'refunded',
      store: 'Zalando',
    })
  })

  it('drops the pagination, since an export is never a page', () => {
    const url = new URL(api.exportUrl({ page: 3, pageSize: 10 }, 'json'), 'http://localhost')

    expect(url.searchParams.get('page')).toBeNull()
    expect(url.searchParams.get('pageSize')).toBeNull()
  })

  it.each(['json', 'csv'] as const)('asks for the %s format', (format) => {
    expect(api.exportUrl({}, format)).toBe(`/api/shipments/export?format=${format}`)
  })
})
