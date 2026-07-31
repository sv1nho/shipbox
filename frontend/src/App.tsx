import { RouterProvider } from 'react-router/dom'
import { createBrowserRouter } from 'react-router'

import { Form } from './pages/Form'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Buy } from './pages/Buy'
import { Success } from './pages/Success'

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
        path: '/buy',
        element: <Buy />,
      },
      {
        path: '/success',
        element: <Success />,
      },
    ],
  },
])

export function App () {
  return <RouterProvider router={router} />
}
