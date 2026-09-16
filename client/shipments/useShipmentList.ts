import { useCallback, useEffect, useState } from 'react'
import { listShipments } from '../api/shipments.js'
import { errorMessage } from '../api/client.js'
import { filtersFromSearch } from './filters.js'
import type { ListResult } from '../../shared/shipment.js'

type ShipmentList = {
  result: ListResult | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useShipmentList (search: string): ShipmentList {
  const [result, setResult] = useState<ListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)

  const reload = useCallback(() => { setReloads((count) => count + 1) }, [])

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)

    listShipments(filtersFromSearch(new URLSearchParams(search)), controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setResult(data)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(errorMessage(cause))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => { controller.abort() }
  }, [search, reloads])

  return { result, loading, error, reload }
}
