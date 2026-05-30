import { RouterProvider, createBrowserRouter } from "react-router-dom";

import { Home } from "./pages/Home";
import { Layout } from "./component/Layout";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
