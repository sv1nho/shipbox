import { RouterProvider, createBrowserRouter } from 'react-router-dom'

import { Form } from './pages/Form'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'

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
    ],
  },
])

export function App () {
  return <RouterProvider router={router} />
}
