import { createHashRouter, RouterProvider } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import BuildPage from './pages/BuildPage.jsx'
import StoryPage from './pages/StoryPage.jsx'

const router = createHashRouter([
  { path: '/', element: <HomePage /> },
  { path: '/build', element: <BuildPage /> },
  { path: '/story', element: <StoryPage /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
