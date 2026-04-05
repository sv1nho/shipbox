import { RouterProvider, createBrowserRouter } from "react-router-dom";
import "./App.css";

import { Home } from "./pages/Home";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
