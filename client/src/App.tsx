import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./page/Home";
import Posts from "./page/Posts";
import Login from "./page/Login";
import Register from "./page/Register";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "posts",
    element: <Posts />,
  },
  {

    path: "login",
    element: <Login />,
  },
  {
    path: "register",
    element: <Register />,
  },
  
]);
function App() {
  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

export default App;
