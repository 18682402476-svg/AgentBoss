import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { suiService } from '../services/sui.js'
import '../assets/battle.css'

function BattlePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const bossId = searchParams.get('bossId')
  
  // 状态管理
  const [currentBoss, setCurrentBoss] = useState({
    id: "",
    name: "",
    maxHp: "",
    currentHp: "",
    imageUrl: "",
    goldNftUrl: "",
    attackCount: "",
    colorClass: ""
  })
  const [battleLog, setBattleLog] = useState([])
  const [isRewardModalVisible, setIsRewardModalVisible] = useState(false)
  const [leaderboardData, setLeaderboardData] = useState([])
  const [defeater, setDefeater] = useState(null)
  const [rewardModalShown, setRewardModalShown] = useState(false)
  
  // 使用useRef存储最新的rewardModalShown状态
  const rewardModalShownRef = useRef(rewardModalShown)
  
  // 当rewardModalShown状态变化时，更新ref的值
  useEffect(() => {
    rewardModalShownRef.current = rewardModalShown
  }, [rewardModalShown])
  
  // 格式化钱包地址（脱敏显示）
  const formatWalletAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }
  
  // 刷新战斗日志
  const refreshBattleLog = async () => {
    try {
      const logs = await suiService.queryBossLogs(bossId)
      
      const newLogs = logs.attacks.map(item => {
        const now = new Date(item.time)
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
        
        return {
          time: timeString,
          message: `Player ${formatWalletAddress(item.attacker)} dealt ${item.damage} damage to Boss`,
          type: 'damage'
        }
      })
      
      setBattleLog(newLogs)
      
      // 检查是否有奖励记录
      if (logs.rewards && logs.rewards.length > 0) {
        // 获取最新的奖励记录
        const latestReward = logs.rewards[0]
        setDefeater({
          address: latestReward.winner,
          amount: latestReward.amount,
          time: latestReward.time
        })
      }
    } catch (error) {
      console.error('刷新战斗日志失败:', error)
    }
  }
  
  // 刷新Boss数据
  const refreshBossData = async () => {
    try {
      const bossData = await suiService.getBossStatus(bossId)
      
      setCurrentBoss(prev => ({
        ...prev,
        currentHp: bossData.hp || 0,
        maxHp: bossData.maxHp,
        attackCount: bossData.totalAttacks,
      }))
      
      // 检查Boss是否被击败
      if (bossData.hp <= 0 && !rewardModalShownRef.current) {
        console.log('Boss已被击败，显示奖励模态框')
        console.log('rewardModalShownRef.current:', rewardModalShownRef.current)
        // 显示奖励模态框
        setIsRewardModalVisible(true)
        // 标记奖励模态框已显示
        setRewardModalShown(true)
      }
    } catch (error) {
      console.error('刷新Boss数据失败:', error)
    }
  }
  


  // 获取伤害排行榜数据
  const getLeaderboardData = async () => {
    try {
      const bossData = await suiService.getBossStatus(bossId)
      if (bossData?.leaderboard && Array.isArray(bossData.leaderboard)) {
        setLeaderboardData(bossData.leaderboard.map((player, index) => ({
          rank: index + 1,
          address: player.address,
          totalDamage: player.damage,
          attackCount: player.attacks
        })))
      }
    } catch (error) {
      console.error('获取排行榜数据失败:', error)
    }
  }
  

  
  // 返回Boss选择
  const backToSelection = () => {
    // 跳转回Boss选择页面
    navigate('/boss-selection')
  }
  

  
  // 显示奖励
  const showReward = async () => {
    console.log('showReward called',rewardModalShown)
    if (!currentBoss || rewardModalShown) return
    
    // 显示奖励模态框
    setIsRewardModalVisible(true)
    // 标记奖励模态框已显示
    setRewardModalShown(true)
  }
  
  // 关闭奖励模态框
  const closeRewardModal = () => {
    setIsRewardModalVisible(false)
  }
  
  // 初始化
  useEffect(() => {
    const initBattle = async () => {
      if (!bossId) return
      
      try {
        // 从Sui链获取Boss数据
        const bossData = await suiService.getBossStatus(bossId)
        setCurrentBoss({
          id: bossData.id,
          name: bossData.name,
          maxHp: bossData.maxHp,
          currentHp: bossData.hp,
          imageUrl: bossData.name == 'ShadowAssassin' ? '/plugins/boss1.png' : bossData.name == 'IceGolem' ? '/plugins/boss2.png' : '/plugins/boss3.png',
          goldNftUrl: bossData.name == 'ShadowAssassin' ? '/plugins/bossIcon1.png' : bossData.name == 'IceGolem' ? '/plugins/bossIcon2.png' : '/plugins/bossIcon3.png',
          attackCount: bossData.totalAttacks,
          colorClass: bossData.name == 'ShadowAssassin' ? 'shadow' : bossData.name == 'IceGolem' ? 'ice' : 'fire'
        })
        
        // 刷新战斗日志
        await refreshBattleLog()
      } catch (error) {
        console.error('初始化战斗失败:', error)
      }
    }
    
    initBattle()
    // 获取排行榜数据
    getLeaderboardData()
    
    // 每3秒刷新一次数据
    const refreshInterval = setInterval(async () => {
      if (!bossId) return
      
      try {
        // 刷新Boss数据
        await refreshBossData()
        // 刷新战斗日志
        await refreshBattleLog()
        // 刷新排行榜数据
        await getLeaderboardData()
      } catch (error) {
        console.error('定时刷新数据失败:', error)
      }
    }, 2000)
    
    // 清理函数
    return () => {
      clearInterval(refreshInterval)
    }
  }, [bossId])
  
  return (
    <section className="battle-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="section-title">
          <img style={{ width: '40px', height: '40px' }} src="/plugins/icon.svg" alt="" />
          Battle in Progress{currentBoss ? '-' + currentBoss.name : ''}
        </h2>
        <button style={{ width: '220px', margin: '0' }} className="btn btn-secondary" onClick={backToSelection}>
          <i className="fas fa-arrow-left"></i> Back to Selection
        </button>
      </div>
      
      <div className="battle-layout">
        {/* 左侧战斗区域 */}
        <div className="battle-main">
          <div className="battle-area">
            <div className="boss-display">
              <div 
                className={`battle-boss-image ${currentBoss ? currentBoss.colorClass : ''}`}
              >
                <img src={currentBoss.imageUrl} alt="" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '28px', marginBottom: '10px' }}>{currentBoss ? currentBoss.name : ''}</h3>
                <div className="boss-hp-bar">
                  <div 
                    className={`boss-hp-fill ${currentBoss ? currentBoss.colorClass + '-hp' : ''}`}
                    style={{ width: `${(currentBoss.currentHp / currentBoss.maxHp) * 100}%` }}
                  >
                  </div>
                  <span style={{ position: 'absolute', top: 0, left: 0 }} className="hp-text">
                    {currentBoss.currentHp.toLocaleString()} / {currentBoss.maxHp.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            
            {/* 战斗日志 */}
            <div className="battle-log">
              <div className="log-title"><i className="fas fa-scroll"></i> Battle Log</div>
              <div id="battleLog" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {battleLog.map((log, index) => (
                  <div key={index} className="log-entry">
                    <span className="log-time">{log.time}</span>
                    <span className="log-message">{log.message}</span>
                    {log.type === 'damage' && <span className="log-damage">Damage</span>}
                    {log.type === 'skill' && <span className="log-skill">Skill</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* 右侧卡片区域 */}
        <div className="battle-sidebar">
          {/* 击杀者卡片 */}
          <div className="sidebar-card defeater-card">
            <h3 className="card-title">
              <i className="fas fa-crown"></i> Defeater
            </h3>
            <div className="card-content">
              {defeater ? (
                <div>
                  <div>Winner: {formatWalletAddress(defeater.address)}</div>
                  <div>Reward: {defeater.amount} SUI</div>
                  <div>Time: {defeater.time}</div>
                </div>
              ) : (
                <div>Current Boss has not been defeated yet</div>
              )}
            </div>
          </div>
          
          {/* Agent 排行榜卡片 */}
          <div className="sidebar-card agent-leaderboard">
            <h3 className="card-title">
              <i className="fas fa-crown"></i> Agent Leaderboard
            </h3>
            <div className="card-content">
              {/* 表头 */}
              <div className="leaderboard-header">
                <div>Rank</div>
                <div>Agent ID</div>
                <div>Damage</div>
                <div>Attacks</div>
              </div>
              {/* 表格内容 */}
              <div className="leaderboard-body">
                {leaderboardData.map((player) => (
                  <div key={player.address} className="leaderboard-row">
                    <div>{player.rank}</div>
                    <div>{formatWalletAddress(player.address)}</div>
                    <div>{player.totalDamage}</div>
                    <div>{player.attackCount}</div>
                  </div>
                ))}
                {leaderboardData.length === 0 && (
                  <div className="leaderboard-empty">
                    No data available yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 获取奖励模态框 */}
      <div className={`modal ${isRewardModalVisible ? 'active' : ''}`} id="rewardModal">
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title"><i className="fas fa-trophy"></i> Boss Defeated!</h3>
            <button className="close-modal" onClick={closeRewardModal}>&times;</button>
          </div>
          
          <div className="leaderboard">
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', textAlign: 'center' }}>
              Congratulations to the player who defeated the Boss!
            </p>
            
            <div className="leaderboard-list">
              {defeater && (
                <div 
                  className="leaderboard-item rank-1"
                >
                  <div className="rank-badge">
                    <img 
                      style={{ height: '40px',borderRadius: '50%' }} 
                      src={currentBoss.goldNftUrl} 
                      alt=""
                    />
                  </div>
                  <div className="player-info">
                    <div className="player-address">{formatWalletAddress(defeater.address)}</div>
                    <div className="player-stats">
                      <span>Reward: {defeater.amount} SUI</span>
                    </div>
                    <div className="player-stats">
                      <span>Time: {defeater.time}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={closeRewardModal}>Confirm</button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default BattlePage