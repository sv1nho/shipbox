import { shipmentsRouter } from '../routes/shipments.js'
import { storesRouter } from '../routes/stores.js'
import { dashboardRouter } from '../routes/dashboard.js'

type Layer = { route?: { path: string; methods: Record<string, boolean> } }

export const ROUTERS = [
  { router: shipmentsRouter, base: '/api/shipments' },
  { router: storesRouter, base: '/api/stores' },
  { router: dashboardRouter, base: '/api/dashboard' },
]

const routesOf = (router: { stack: unknown[] }, base: string) =>
  (router.stack as Layer[]).flatMap(({ route }) =>
    route === undefined
      ? []
      : [
          {
            path: `${base}${route.path === '/' ? '' : route.path}`.replace(/:(\w+)/g, '{$1}'),
            method: Object.keys(route.methods)[0],
          },
        ]
  )

export const REGISTERED = ROUTERS.flatMap(({ router, base }) => routesOf(router, base))
