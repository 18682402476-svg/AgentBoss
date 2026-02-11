import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from './App.jsx'
import LoginPage from './views/LoginPage.jsx'
import BossSelection from './views/BossSelection.jsx'
import BattlePage from './views/BattlePage.jsx'
import AgentList from './views/AgentList.jsx'
import AgentDetail from './views/AgentDetail.jsx'
import ApiDocumentation from './views/ApiDocumentation.jsx'

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      {
        path: '/',
        element: <LoginPage />
      },
      {
        path: '/boss-selection',
        element: <BossSelection />
      },
      {
        path: '/battle',
        element: <BattlePage />
      },
      {
        path: '/agent-list',
        element: <AgentList />
      },
      {
        path: '/agent/:address',
        element: <AgentDetail />
      },
      {
        path: '/api-documentation',
        element: <ApiDocumentation />
      },
      {
        path: '*',
        element: <Navigate to="/" />
      }
    ]
  }
])

export default router