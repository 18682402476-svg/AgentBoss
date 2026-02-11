import { useNavigate } from 'react-router-dom'

// 假设walletService已经在项目中定义
import '../assets/login.css'

function LoginPage() {
  const navigate = useNavigate()

  // 开始演示
  const startDemo = () => {
    navigate('/boss-selection')
  }

  return (
    <div className="login-container">
      <div className="login-section">
        <div style={{ marginBottom: '20px' }}>
          <img style={{ width: '80px', height: '80px' }} src="/plugins/icon.svg" alt="" />
        </div>
        <h1>Welcome to SUI CHAIN Boss Challenge Platform</h1>
        <p className="login-section__description">
          This is a gamified demo showcasing SUI blockchain's parallel execution capabilities. Experience SUI chain's high TPS, low latency, and low cost features by challenging powerful Bosses.
        </p>
        
        <div className="login-features">
          <div className="feature-item">
            <img src="/plugins/icon1.svg" alt="" />
            <h3>Parallel Execution</h3>
            <p>Supports large-scale concurrent attacks</p>
          </div>
          <div className="feature-item">
            <img src="/plugins/icon2.svg" alt="" />
            <h3>Gamified Experience</h3>
            <p>Immersive Boss battles</p>
          </div>
          <div className="feature-item">
            <img src="/plugins/icon3.svg" alt="" />
            <h3>NFT Rewards</h3>
            <p>Earn exclusive NFTs by defeating Bosses</p>
          </div>
        </div>
        
        <button 
          className="btn btn-primary" 
          onClick={startDemo} 
        >
          <i className="fas fa-play"></i> Fighting
        </button>
      </div>
    </div>
  )
}

export default LoginPage