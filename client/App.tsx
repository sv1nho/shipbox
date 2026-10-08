import { RouterProvider } from 'react-router/dom'
import { createBrowserRouter } from 'react-router'
import type { RouteObject } from 'react-router'

import { Layout } from './components/Layout'
import { RequireAuth } from './auth/RequireAuth'
import { LocaleProvider } from './i18n/context.js'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      {
        path: '/',
        lazy: async () => ({ Component: (await import('./pages/Home.js')).Home }),
      },
      {
        path: '/form',
        lazy: async () => ({ Component: (await import('./pages/Form.js')).Form }),
      },
      {
        path: '/login',
        lazy: async () => ({ Component: (await import('./pages/Login.js')).Login }),
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/shipments',
            lazy: async () => ({ Component: (await import('./pages/Shipments.js')).Shipments }),
          },
          {
            path: '/dashboard',
            lazy: async () => ({ Component: (await import('./pages/Dashboard.js')).Dashboard }),
          },
          {
            path: '/account',
            lazy: async () => ({ Component: (await import('./pages/Account.js')).Account }),
          },
        ],
      },
    ],
  },
]

const router = createBrowserRouter(routes)

export function App () {
  return (
    <LocaleProvider>
      <RouterProvider router={router} />
    </LocaleProvider>
  )
}
