import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client'

/**
 * Sui 服务类
 * 提供 Sui 区块链交互的常用方法
 * 无需连接钱包即可获取数据
 */
class SuiService {
  constructor() {
    this.client = null
    this.packageId = null
    this.init()
  }

  /**
   * 初始化 Sui 服务
   */
  init() {
    // 使用本地网络或自定义 RPC URL
    const rpcUrl = 'https://fullnode.devnet.sui.io:443'
    this.client = new SuiClient({ url: rpcUrl })
    this.packageId = '0x7276711e3b2785f1a30e4d6093fe7b1eda96084ce0916592f1babe25bf5cd3d6'
  }

  /**
   * 获取所有 Boss 列表
   * @returns {Promise<Array<Object>>} Boss 列表
   */
  async getBosses() {
    if (!this.client) {
      this.init()
    }

    try {      
      // 通过查询与该 Package 相关的交易来寻找创建的 Boss
      const txs = await this.client.queryTransactionBlocks({
        filter: { InputObject: this.packageId },
        options: { showObjectChanges: true }
      })

      const bossIds = new Set()
      txs.data.forEach(tx => {
        if (tx.objectChanges) {
          tx.objectChanges.forEach(change => {
            // 匹配 Boss 类型的创建或修改
            if (change.objectType && change.objectType.includes(`${this.packageId}::boss_battle::Boss`)) {
              if (change.type === 'created' || change.type === 'mutated') {
                bossIds.add(change.objectId)
              }
            }
          })
        }
      })

      if (bossIds.size === 0) {
        console.log('未发现任何 Boss 对象')
        return []
      }

      // 获取每个 Boss 的详细信息
      const bossObjects = await this.client.multiGetObjects({
        ids: Array.from(bossIds),
        options: { showContent: true }
      })
      
      // 转换为前端需要的格式
      return bossObjects.map(b => {
        if (!b.data || !b.data.content) return null
        const fields = b.data.content.fields
        return {
          id: fields.id.id, // Boss 对象 ID
          name: fields.name, // Boss 名称
          hp: fields.hp.toString(), // 当前血量
          maxHp: fields.max_hp.toString(), // 最大血量
          isAlive: fields.is_alive, // 是否存活
          difficulty: fields.difficulty, // 难度等级
          pool: (fields.pool / 1000000000).toFixed(2), // 奖池金额（SUI）
          attackCost: (fields.attack_cost / 1000000000).toFixed(2), // 攻击消耗（SUI）
          colorClass: fields.name == 'ShadowAssassin' ? 'shadow' : fields.name == 'IceGolem' ? 'ice' : 'fire', // 颜色类名
          imageUrl: fields.name == 'ShadowAssassin' ? '../../plugins/boss1.png' : fields.name == 'IceGolem' ? '../../plugins/boss2.png' : '../../plugins/boss3.png', // Boss 图片 URL
          goldNftUrl: fields.name == 'ShadowAssassin' ? '../../plugins/bossIcon1.png' : fields.name == 'IceGolem' ? '../../plugins/bossIcon2.png' : '../../plugins/bossIcon3.png', // 金牌 NFT URL
        }
      }).filter(b => b !== null)
    } catch (error) {
      console.error('Sui 服务错误:', error.message)
      throw error
    }
  }

  /**
   * 获取指定 Boss 的详细状态
   * @param {string} bossId - Boss 对象 ID
   * @returns {Promise<Object|null>} Boss 状态信息或 null（如果查询失败）
   */
  async getBossStatus(bossId) {
    if (!this.client) {
      this.init()
    }

    try {
      // 并行获取Boss对象信息和统计数据
      const [obj, stats] = await Promise.all([
        this.client.getObject({
          id: bossId,
          options: { showContent: true }
        }),
        this.getBossStats(bossId)
      ]);

      if (obj.error) {
        console.error(`查询失败: ${obj.error.code}`)
        return null
      }

      const fields = obj.data.content.fields
      return {
        id: obj.data.objectId, // Boss 对象 ID
        name: fields.name, // Boss 名称
        hp: parseInt(fields.hp), // 当前血量（整数）
        maxHp: parseInt(fields.max_hp), // 最大血量（整数）
        isAlive: fields.is_alive, // 是否存活
        pool: (parseInt(fields.pool) / 1_000_000_000).toFixed(2), // 奖池金额（SUI）
        difficulty: fields.difficulty, // 难度等级
        lastAttacker: fields.last_attacker, // 最后攻击者地址
        totalDamage: stats.totalDamage, // 累计总伤害
        totalAttacks: stats.totalAttacks, // 累计攻击次数
        leaderboard: stats.leaderboard // 伤害排行榜
      }
    } catch (err) {
      console.error('RPC 请求错误:', err.message)
      return null
    }
  }

  /**
   * 查询指定 Boss 的攻击日志和奖励记录
   * @param {string} bossId - Boss 对象 ID
   * @param {number} limit - 显示记录数量限制，默认 50
   * @returns {Promise<Object>} 包含攻击记录和奖励记录的对象
   */
  async queryBossLogs(bossId, limit = 50) {
    if (!this.client) {
      this.init()
    }

    try {
      // 查询 CombatEvent 事件
      const events = await this.client.queryEvents({
        query: { 
          MoveEventType: `${this.packageId}::boss_battle::CombatEvent` 
        },
        order: "descending"
      })

      // 过滤出特定 Boss 的事件
      const filteredEvents = events.data.filter(event => 
        event.parsedJson && event.parsedJson.boss_id === bossId
      )

      if (filteredEvents.length === 0) {
        console.log("暂无该 Boss 的攻击记录。")
        return { attacks: [], rewards: [] }
      }

      const attackLogs = filteredEvents.slice(0, limit).map(event => {
        const data = event.parsedJson
        const date = new Date(parseInt(event.timestampMs))
        
        return {
          time: date.toLocaleString(), // 攻击时间
          attacker: data.attacker, // 攻击者地址
          damage: data.damage, // 伤害值
          remainingHp: data.remaining_hp, // 剩余血量
          isKill: data.is_kill, // 是否击杀
          txDigest: event.id.txDigest // 交易 ID
        }
      })

      // 检查是否有奖励发放记录 (针对该 Boss)
      const rewardEvents = await this.client.queryEvents({
        query: { 
          MoveEventType: `${this.packageId}::boss_battle::RewardEvent` 
        },
        order: "descending"
      })

      const specificRewards = rewardEvents.data.filter(event => 
        event.parsedJson && event.parsedJson.boss_id === bossId
      )

      const rewardLogs = specificRewards.map(event => {
        const data = event.parsedJson
        const date = new Date(parseInt(event.timestampMs))
        
        return {
          time: date.toLocaleString(), // 奖励时间
          winner: data.winner, // 赢家地址
          amount: (data.amount / 1000000000).toFixed(2), // 奖励金额（SUI）
          txDigest: event.id.txDigest // 交易 ID
        }
      })

      return {
        attacks: attackLogs, // 攻击记录数组
        rewards: rewardLogs // 奖励记录数组
      }
    } catch (err) {
      console.error('查询失败:', err.message)
      return { attacks: [], rewards: [] }
    }
  }

  /**
   * 获取 Boss 统计数据和排行榜
   * @param {string} bossId - Boss 对象 ID
   * @returns {Promise<Object>} 包含总伤害、总攻击次数和排行榜的对象
   */
  async getBossStats(bossId) {
    if (!this.client) {
      this.init()
    }

    try {
      let allEvents = []
      let cursor = null
      let hasNextPage = true

      // 分页获取所有战斗事件
      while (hasNextPage) {
        const response = await this.client.queryEvents({
          query: { 
            MoveEventType: `${this.packageId}::boss_battle::CombatEvent` 
          },
          cursor,
          order: "ascending"
        })
        allEvents = allEvents.concat(response.data)
        cursor = response.nextCursor
        hasNextPage = response.hasNextPage
      }

      let totalDamage = 0
      let totalAttacks = 0
      let leaderboard = {}

      allEvents.forEach(event => {
        // 严格过滤当前 boss_id
        if (event.parsedJson && event.parsedJson.boss_id === bossId) {
          const { attacker, damage } = event.parsedJson
          const dmg = parseInt(damage)
          totalDamage += dmg
          totalAttacks += 1

          if (!leaderboard[attacker]) {
            leaderboard[attacker] = { damage: 0, attacks: 0 }
          }
          leaderboard[attacker].damage += dmg
          leaderboard[attacker].attacks += 1
        }
      })

      // 排序并取前五
      const sortedLeaderboard = Object.entries(leaderboard)
        .map(([address, stats]) => ({ address, ...stats }))
        .sort((a, b) => b.damage - a.damage)
        .slice(0, 5)

      return { totalDamage, totalAttacks, leaderboard: sortedLeaderboard }
    } catch (err) {
      console.error('查询统计数据失败:', err.message)
      return { totalDamage: 0, totalAttacks: 0, leaderboard: [] }
    }
  }

  /**
   * 搜索 Agent 信息
   * @param {string} arenaId - Arena 对象 ID
   * @returns {Promise<Array<Object>>} 匹配的 Agent 列表
   */
  async searchAgents( arenaId = '0xc7e6847489e4db7c93e37f90cc0bce89146219c99f80cd5a9c450451b04e628b') {
    if (!this.client) {
      this.init()
    }

    try {
      let agentMapping = {} // { address: name }
      let registeredCount = 0

      // 如果提供了 arenaId，从 Arena 对象获取已注册的 Agent 列表
        const arena = await this.client.getObject({
          id: arenaId || '',
          options: { showContent: true }
        })

        const tableId = arena.data.content.fields.agents.fields.id.id
        registeredCount = parseInt(arena.data.content.fields.agents.fields.size)

        // 获取 Table 中的所有动态字段（即已注册的 Agent）
        const fields = await this.client.getDynamicFields({
          parentId: tableId
        })

        // 并行拉取每个 Agent 的名称
        await Promise.all(fields.data.map(async (field) => {
          const entry = await this.client.getDynamicFieldObject({
            parentId: tableId,
            name: field.name
          })
          // Table 的内容结构通常在 fields.value 中
          const address = field.name.value
          const name = entry.data.content.fields.value
          agentMapping[address] = name
        }))

      // 2. 获取所有 CombatEvent 以统计伤害
      const combatEvents = await this.client.queryEvents({
        query: { MoveEventType: `${this.packageId}::boss_battle::CombatEvent` },
        limit: 100,
        order: "descending"
      })

      // 3. 获取所有 RewardEvent 以统计奖励
      const rewardEvents = await this.client.queryEvents({
        query: { MoveEventType: `${this.packageId}::boss_battle::RewardEvent` },
        limit: 100,
        order: "descending"
      })

      const stats = {} // { address: { attacks: 0, damage: 0, rewards: 0 } }

      // 初始化所有已注册 Agent 的统计信息
      Object.keys(agentMapping).forEach(addr => {
        stats[addr] = { attacks: 0, damage: 0, rewards: 0 }
      })
      // 统计 CombatEvent
      combatEvents.data.forEach(event => {
        const { attacker, damage } = event.parsedJson
        if (!stats[attacker]) {
          stats[attacker] = { attacks: 0, damage: 0, rewards: 0 }
        }
        stats[attacker].attacks += 1
        stats[attacker].damage += parseInt(damage)
      })

      // 统计 RewardEvent
      rewardEvents.data.forEach(event => {
        const { winner, amount } = event.parsedJson
        if (!stats[winner]) {
          stats[winner] = { attacks: 0, damage: 0, rewards: 0 }
        }
        stats[winner].rewards += parseInt(amount)
      })

      // 4. 转换为数组格式
      let agentList = Object.entries(stats).map(([addr, s]) => ({
        address: addr,
        name: agentMapping[addr] || '未知 Agent',
        attackCount: s.attacks,
        totalDamage: s.damage || 0,
        rewards: (s.rewards / 1000000000).toFixed(4) // 转换为 SUI
      }))

      // 按伤害排序
      agentList.sort((a, b) => b.totalDamage - a.totalDamage)
      
      return agentList
    } catch (err) {
      console.error('搜索失败:', err.message)
      return []
    }
  }

  /**
   * 获取 Agent 详细信息
   * @param {string} target - Agent 名称或地址
   * @returns {Promise<Object>} Agent 详细信息
   */
  async getAgentDetail(target) {
    if (!this.client) {
      this.init()
    }

    try {

      // 1. 确定目标地址和名称
      let targetAddr = target
      let agentName = target
      
      // 如果传入的是名称，需要先找到对应的地址
      if (typeof target === 'string' && !target.startsWith('0x')) {
        const allAgents = await this.searchAgents()
        const foundAgent = allAgents.find(agent => agent.name === target)
        
        if (foundAgent) {
          targetAddr = foundAgent.address
          agentName = foundAgent.name
        } else {
          console.error('未找到对应名称的Agent')
          return {
            name: '未知 Agent',
            address: target,
            totalAttacks: 0,
            totalDamage: 0,
            totalRewards: '0',
            combatRecords: [],
            killRecords: []
          }
        }
      } else if (target.startsWith('0x')) {
        // 如果传入的是地址，尝试查找对应的名称
        const allAgents = await this.searchAgents()
        const foundAgent = allAgents.find(agent => agent.address === target)
        
        if (foundAgent) {
          agentName = foundAgent.name
        }
      }

      // 2. 拉取所有相关的战斗事件和奖励事件
      const [combatEvents, rewardEvents] = await Promise.all([
        this.client.queryEvents({
          query: { MoveEventType: `${this.packageId}::boss_battle::CombatEvent` },
          order: "descending"
        }),
        this.client.queryEvents({
          query: { MoveEventType: `${this.packageId}::boss_battle::RewardEvent` },
          order: "descending"
        })
      ])

      const combatRecords = []
      const killRecords = []
      let totalAttacks = 0
      let totalDamage = 0
      let totalRewards = 0

      // 处理战斗事件
      combatEvents.data.forEach(event => {
        const { attacker, damage, is_kill, boss_id } = event.parsedJson
        
        if (attacker === targetAddr) {
          const timestamp = new Date(parseInt(event.timestampMs)).toLocaleString()
          const dmg = parseInt(damage)

          totalAttacks++
          totalDamage += dmg

          // 攻击记录
          combatRecords.push({
            bossId: boss_id,
            time: timestamp,
            damage: dmg,
            isKill: is_kill
          })
        }
      })

      // 处理奖励事件
      rewardEvents.data.forEach(event => {
        const { winner, amount, boss_id } = event.parsedJson
        
        if (winner === targetAddr) {
          const timestamp = new Date(parseInt(event.timestampMs)).toLocaleString()
          const reward = parseInt(amount)

          totalRewards += reward
          killRecords.push({
            bossId: boss_id,
            time: timestamp,
            reward: (reward / 1000000000).toFixed(4) // 转换为 SUI
          })
        }
      })
      
      return {
        name: agentName,
        address: targetAddr,
        totalAttacks,
        totalDamage,
        totalRewards: (totalRewards / 1000000000).toFixed(4), // 转换为 SUI
        combatRecords,
        killRecords
      }
    } catch (err) {
      console.error('查询失败:', err.message)
      return {
        name: '未知 Agent',
        address: target,
        totalAttacks: 0,
        totalDamage: 0,
        totalRewards: '0',
        combatRecords: [],
        killRecords: []
      }
    }
  }

  /**
   * 注册 Agent
   * @param {string} agentName - Agent 名称
   * @returns {Promise<Object>} 注册结果及 Agent 配置信息
   */
  async registerAgent(agentName) {
    if (!this.client) {
      this.init()
    }

    try {
      // 1. 动态导入密钥对类 (适配前端环境)
      const { Ed25519Keypair } = await import('@mysten/sui.js/keypairs/ed25519')
      const keypair = new Ed25519Keypair()
      const address = keypair.getPublicKey().toSuiAddress()
      
      // 获取 32 字节私钥种子
      const secretKey = keypair.keypair.secretKey.slice(0, 32)
      const apiKey = `sk_${Math.random().toString(36).substring(2, 15)}`

      // 2. 构造返回的配置数据 (兼容 agents.json 格式)
      const agentConfig = {
        [address]: {
          id: address,
          name: agentName,
          secretKey: btoa(String.fromCharCode.apply(null, secretKey)),
          apiKey: apiKey,
          registeredAt: new Date().toISOString()
        }
      }

      return {
        success: true,
        address: address,
        config: agentConfig
      }
    } catch (err) {
      console.error('注册失败:', err.message)
      return { success: false, error: err.message }
    }
  }
}

// 导出单例实例
const suiService = new SuiService()

export {
  suiService,
  SuiService
}
