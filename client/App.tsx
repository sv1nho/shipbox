import { RouterProvider } from 'react-router/dom'
import { createBrowserRouter } from 'react-router'

import { Dashboard } from './pages/Dashboard'
import { Form } from './pages/Form'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Shipments } from './pages/Shipments'
import { RequireAuth } from './auth/RequireAuth'

const router = createBrowserRouter([
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
])

export function App () {
  return <RouterProvider router={router} />
}
