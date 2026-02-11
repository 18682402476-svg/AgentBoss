import { useNavigate, Outlet } from 'react-router-dom'
import './App.css'

function App() {
  const navigate = useNavigate()

  // 跳转到首页
  const goToHome = () => {
    navigate('/')
  }

  return (
    <div className="app-container">
      {/* 头部区域 */}
      <header className="header">
        <div className="logo" onClick={goToHome}>
          <div className="logo-icon">
            <img src="/plugins/newlogo.png" alt="" style={{ height: '50px' }} />
          </div>
          <div>
            <div className="logo-text">SUI CHAIN BOSS</div>
            <div className="monad-badge">SUI Boss Fighting</div>
          </div>
        </div>
        <nav className="main-nav">
          <ul className="nav-menu">
            <li className="nav-item">
              <button className="nav-link" onClick={goToHome}>Home</button>
            </li>
            <li className="nav-item">
              <button className="nav-link" onClick={() => navigate('/agent-list')}>Agent List</button>
            </li>
            <li className="nav-item">
              <button className="nav-link" onClick={() => navigate('/api-documentation')}>API Documentation</button>
            </li>
          </ul>
        </nav>
      </header>

      {/* 主内容区域 */}
      <div className="main-content show">
        <Outlet />
      </div>
    </div>
  )
}

export default App