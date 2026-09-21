import { RouterProvider } from 'react-router/dom'
import { createBrowserRouter } from 'react-router'
import type { RouteObject } from 'react-router'

import { Dashboard } from './pages/Dashboard'
import { Form } from './pages/Form'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Shipments } from './pages/Shipments'
import { RequireAuth } from './auth/RequireAuth'
import { LocaleProvider } from './i18n/context.js'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      {
        path: '/',
        element: <Home />,
      },
      {
        path: '/form',
        element: <Form />,
      },
      {
        path: '/login',
        element: <Login />,
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/shipments',
            element: <Shipments />,
          },
          {
            path: '/dashboard',
            element: <Dashboard />,
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
