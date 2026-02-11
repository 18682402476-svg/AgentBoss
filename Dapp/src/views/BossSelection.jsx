import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// 导入suiService
import { suiService } from '../services/sui.js'
import '../assets/boss-selection.css'

function BossSelection() {
  const navigate = useNavigate()
  
  // 状态管理
  const [selectedBoss, setSelectedBoss] = useState(null)
  const [bosses, setBosses] = useState([])
  const [showAlive, setShowAlive] = useState(true) // 默认显示存活的

  // 初始化获取Boss数据
  useEffect(() => {
    const fetchBosses = async () => {
      try {
        // 从Sui链获取Boss数据
        const bossData = await suiService.getBosses()
        setBosses(bossData)
      } catch (error) {
        console.error('获取Boss数据失败:', error)
      }
    }

    fetchBosses()
    // 设置定时刷新，以便及时看到 Boss 状态变化
    const timer = setInterval(fetchBosses, 5000)
    return () => clearInterval(timer)
  }, [])

  // 过滤后的 Boss 列表
  const filteredBosses = bosses.filter(boss => boss.isAlive === showAlive)

  // Boss选择
  const selectBoss = (bossId) => {
    setSelectedBoss(bossId)
  }

  // 开始战斗
  const startBattle = () => {
    if (!selectedBoss) {
      return
    }
    
    // 跳转到战斗页面
    navigate({ pathname: '/battle', search: `?bossId=${selectedBoss}` })
  }

  return (
    <section className="boss-selection">
      <div className="selection-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: '10px' }}>
            <img style={{ width: '40px', height: '40px' }} src="/plugins/icon.svg" alt="" />
            Choose Your Challenge
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Select a Boss to challenge. Each Boss has different difficulty, health points, and skills.
          </p>
        </div>
        
        {/* 状态切换按钮 */}
        <div className="status-toggle" style={{ 
          display: 'flex', 
          background: 'rgba(255, 255, 255, 0.05)', 
          padding: '5px', 
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <button 
            onClick={() => { setShowAlive(true); setSelectedBoss(null); }}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.3s',
              background: showAlive ? 'var(--primary-gradient)' : 'transparent',
              color: showAlive ? 'white' : 'var(--text-secondary)'
            }}
          >
            Active
          </button>
          <button 
            onClick={() => { setShowAlive(false); setSelectedBoss(null); }}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.3s',
              background: !showAlive ? 'var(--primary-gradient)' : 'transparent',
              color: !showAlive ? 'white' : 'var(--text-secondary)'
            }}
          >
            Defeated
          </button>
        </div>
      </div>
      
      <div className="boss-cards">
        {filteredBosses.map((boss) => (
          <div
            key={boss.id}
            className={`boss-card ${selectedBoss === boss.id ? 'selected' : ''} ${!boss.isAlive ? 'defeated-card' : ''}`}
            onClick={() => selectBoss(boss.id)}
            style={!boss.isAlive ? { opacity: 0.8, filter: 'grayscale(0.5)' } : {}}
          >
            {!boss.isAlive && (
              <div className="defeated-badge" style={{
                position: 'absolute',
                top: '20px',
                right: '-30px',
                background: '#ff4d4d',
                color: 'white',
                padding: '5px 40px',
                transform: 'rotate(45deg)',
                fontSize: '12px',
                fontWeight: 'bold',
                zIndex: 1
              }}>
                DEFEATED
              </div>
            )}
            <div className="boss-image">
              <img src={boss.imageUrl} alt={boss.name} />
            </div>
            <div className="boss-header">
              <div className="boss-icon" style={{backgroundColor:'#298DFF'}}>
                <img style={{ height: '40px',borderRadius:'5px' }} src={boss.goldNftUrl} alt={boss.name + ' icon'} />
              </div>
              <div className="boss-info">
                <h3>{boss.name}</h3>
                <span className={`boss-difficulty ${boss.colorClass}`}>{boss.difficulty}</span>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '15px', fontSize: '14px' }}>
              {boss.description}
            </p>
            <div className="boss-stats">
              <div className="stat">
                <div className="stat-value">{boss.hp} / {boss.maxHp}</div>
                <div className="stat-label">HP</div>
              </div>
              <div className="stat">
                <div className="stat-value">{boss.pool} SUI</div>
                <div className="stat-label">Reward Pool</div>
              </div>
              <div className="stat">
                <div className="stat-value">{boss.attackCost} SUI</div>
                <div className="stat-label">Cost</div>
              </div>
            </div>
          </div>
        ))}
        {filteredBosses.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
            <i className="fas fa-ghost" style={{ fontSize: '48px', marginBottom: '20px', display: 'block' }}></i>
            <p>No {showAlive ? 'active' : 'defeated'} bosses found at the moment.</p>
          </div>
        )}
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button 
          className="btn btn-primary" 
          onClick={startBattle} 
          disabled={!selectedBoss}
        >
          <i className="fas fa-fist-raised"></i> Start Challenge
        </button>
      </div>
    </section>
  )
}

export default BossSelection