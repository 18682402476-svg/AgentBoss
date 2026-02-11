import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { suiService } from '../services/sui.js'
import '../assets/agent-detail.css'

function AgentDetail() {
  const navigate = useNavigate()
  const { address } = useParams()
  const [searchParams] = useSearchParams()
  const name = searchParams.get('name')
  
  // Agent详情数据
  const [agent, setAgent] = useState({
    id: 1,
    name: name,
    address: '',
    totalAttacks: 0,
    totalDamage: 0,
    totalReward: 0,
    attackRecords: [],
    rewardRecords: []
  })
  // 加载状态
  const [loading, setLoading] = useState(true)
  // 错误状态
  const [error, setError] = useState(null)
  
  // 从Sui链获取Agent详情数据
  useEffect(() => {
    const fetchAgentDetail = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // 直接使用address参数调用getAgentDetail方法
        const detailData = await suiService.getAgentDetail(name)
        
        // 转换为前端需要的格式
        const formattedData = {
          id: 1,
          name: name || detailData.name,
          address: detailData.address,
          totalAttacks: detailData.totalAttacks,
          totalDamage: detailData.totalDamage,
          totalReward: detailData.totalRewards,
          attackRecords: detailData.combatRecords.map(record => ({
            bossName: `Boss ${record.bossId}`,
            date: record.time,
            damage: record.damage
          })),
          rewardRecords: detailData.killRecords.map(record => ({
            bossName: `Boss ${record.bossId}`,
            reward: `${record.reward} SUI`,
            date: record.time
          }))
        }
        
        setAgent(formattedData)
      } catch (err) {
        console.error('获取Agent详情失败:', err)
        setError('Failed to fetch agent details')
      } finally {
        setLoading(false)
      }
    }
    
    fetchAgentDetail()
  }, [address, name])

  // 格式化钱包地址（脱敏显示）
  const formatWalletAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // 返回Agent列表
  const backToList = () => {
    navigate('/agent-list')
  }

  return (
    <section className="agent-detail-section">
      <div className="detail-header">
        <h2 className="section-title">
          <img style={{ width: '40px', height: '40px' }} src="/plugins/icon.svg" alt="" />
          Agent Details
        </h2>
        <button className="back-btn" onClick={backToList}>
          <i className="fas fa-arrow-left"></i> Back to List
        </button>
      </div>
      
      {loading ? (
        <div className="loading-state">
          <p>Loading agent details...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <p>{error}</p>
          <button className="retry-btn" onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
            Detailed information about Agent {agent.name}
          </p>
          
          {/* 基本信息卡片 */}
          <div className="info-card">
            <div className="card-header">
              <i className="fas fa-info-circle"></i>
              <h3>Basic Information</h3>
            </div>
            <div className="agent-basic-info">
              <div className="info-row">
                <span className="info-label">Agent ID:</span>
                <span className="info-value">agent-{String(agent.id).padStart(3, '0')}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Address:</span>
                <span className="info-value">{formatWalletAddress(agent.address)}</span>
              </div>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total Attacks</div>
                <div className="stat-value">{agent.totalAttacks}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Damage</div>
                <div className="stat-value">{agent.totalDamage}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Reward</div>
                <div className="stat-value">{agent.totalReward} SUI</div>
              </div>
            </div>
          </div>
          
          {/* 攻击记录卡片 */}
          <div className="info-card attack-records">
            <div className="card-header">
              <i className="fas fa-history"></i>
              <h3>Attack Records</h3>
            </div>
            <div className="records-list">
              {agent.attackRecords.length > 0 ? (
                agent.attackRecords.map((record, index) => (
                  <div key={index} className="record-item">
                    <div className="record-info">
                      <div className="record-boss">{record.bossName}</div>
                      <div className="record-date">{record.date}</div>
                    </div>
                    <div className="record-damage">{record.damage}</div>
                  </div>
                ))
              ) : (
                <p className="no-records">No attack records found</p>
              )}
            </div>
          </div>
          
          {/* 击杀获奖记录卡片 */}
          <div className="info-card reward-records">
            <div className="card-header">
              <i className="fas fa-trophy"></i>
              <h3>Defeater Reward Records</h3>
            </div>
            <div className="rewards-list">
              {agent.rewardRecords.length > 0 ? (
                agent.rewardRecords.map((record, index) => (
                  <div key={index} className="reward-item">
                    <div className="reward-info">
                      <div className="reward-boss">{record.bossName}</div>
                      <div className="reward-date">{record.date}</div>
                    </div>
                    <div className="reward-value">{record.reward}</div>
                  </div>
                ))
              ) : (
                <p className="no-records">No reward records found</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default AgentDetail
