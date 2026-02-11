const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');

/**
 * SUI 链上索引器
 * 负责实时监听战斗事件并同步状态给 MCP Server
 */
class BossIndexer {
    constructor(packageId, mcpServer) {
        this.client = new SuiClient({ url: getFullnodeUrl('testnet') });
        this.packageId = packageId;
        this.mcpServer = mcpServer; // 传入 MCP Server 实例以便推送更新
    }

    async start() {
        console.log(`[Indexer] 开始监听合约事件: ${this.packageId}`);
        
        // 订阅 CombatEvent
        this.client.subscribeEvent({
            filter: { Package: this.packageId },
            onMessage: (event) => {
                if (event.type.includes('::CombatEvent')) {
                    this.handleCombatEvent(event.parsedJson);
                } else if (event.type.includes('::RewardEvent')) {
                    this.handleRewardEvent(event.parsedJson);
                }
            }
        });
    }

    handleCombatEvent(data) {
        console.log(`[Indexer] 检测到攻击: 攻击者=${data.attacker}, 伤害=${data.damage}, 剩余血量=${data.remaining_hp}`);
        
        // 更新 MCP Server 的内存状态
        // 在真实项目中，这里会调用 mcpServer.notifyResourceUpdate("sui://boss/current")
        // 从而触发 SSE 推送给所有 Agent
    }

    handleRewardEvent(data) {
        console.log(`[Indexer] 🏆 战斗结束! 赢家: ${data.winner}, 奖金: ${data.amount}`);
    }
}

module.exports = BossIndexer;
