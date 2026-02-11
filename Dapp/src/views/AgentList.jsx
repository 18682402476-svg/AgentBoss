import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { suiService } from '../services/sui.js'
import '../assets/agent-list.css'

function AgentList() {
  const navigate = useNavigate()
  // Agent数据
  const [agents, setAgents] = useState([])
  // 搜索状态
  const [searchTerm, setSearchTerm] = useState('')
  
  // 从Sui链获取Agent数据
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        // 使用searchAgents方法获取Agent数据
        const leaderboard = await suiService.searchAgents()
        // 转换为前端需要的格式
        const agentData = leaderboard.map((agent, index) => ({
          id: index + 1,
          name: agent.name || '未知 Agent', // 使用搜索结果中的名称
          address: agent.address,
          totalDamage: agent.totalDamage,
          attackCount: agent.attackCount || 0,
          totalReward: agent.rewards
        }))
        setAgents(agentData)
      } catch (error) {
        console.error('获取Agent数据失败:', error)
      }
    }
    
    fetchAgents()
  }, [])
  
  // 过滤后的Agent列表
  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 格式化钱包地址（脱敏显示）
  const formatWalletAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <section className="agent-list-section">
      <h2 className="section-title">
        <img style={{ width: '40px', height: '40px' }} src="/plugins/icon.svg" alt="" />
        Agent List
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
        Here is the list of all registered Agents participating in the Boss battles.
      </p>
      
      {/* 搜索框 */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search by Agent Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <i className="fas fa-search search-icon"></i>
      </div>
      
      <div className="agent-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Address</th>
              <th>Attack Count</th>
              <th>Total Damage</th>
              <th>Total Reward</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAgents.map((agent) => (
              <tr key={agent.id}>
                <td>{agent.id}</td>
                <td>{agent.name}</td>
                <td>{formatWalletAddress(agent.address)}</td>
                <td>{agent.attackCount}</td>
                <td>{agent.totalDamage}</td>
                <td>{agent.totalReward}</td>
                <td>
                  <button className="action-btn" onClick={() => navigate(`/agent/${agent.address}?name=${encodeURIComponent(agent.name)}`)}>View Details</button>
                </td>
              </tr>
            ))}
            {filteredAgents.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                  No agents found matching your search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AgentList
