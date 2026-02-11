const { SuiClient, getFullnodeUrl } = require("@mysten/sui.js/client");
const dotenv = require("dotenv");

dotenv.config();

const client = new SuiClient({ url: process.env.SUI_RPC_URL || getFullnodeUrl("localnet") });
const PACKAGE_ID = process.env.PACKAGE_ID;

async function watchEvents() {
    console.log(`正在监听合约事件: ${PACKAGE_ID}...`);
    
    // 定时轮询 (本地网络可能不支持 WebSocket 订阅)
    let cursor = null;

    setInterval(async () => {
        try {
            const events = await client.queryEvents({
                query: { MoveModule: { package: PACKAGE_ID, module: "boss_battle" } },
                cursor,
                order: "ascending"
            });

            for (const event of events.data) {
                const type = event.type.split("::").pop();
                const data = event.parsedJson;

                if (type === "CombatEvent") {
                    console.log(`[战斗日志] Boss: ${data.boss_id.substring(0, 10)}... | 攻击者: ${data.attacker.substring(0, 10)}... | 伤害: ${data.damage} | 剩余血量: ${data.remaining_hp} ${data.is_kill ? "🔥 击杀！" : ""}`);
                } else if (type === "RewardEvent") {
                    console.log(`[奖励日志] Boss: ${data.boss_id.substring(0, 10)}... | 赢家: ${data.winner.substring(0, 10)}... | 获得奖金: ${data.amount / 1000000000} SUI`);
                }
                
                cursor = event.id;
            }
        } catch (e) {
            console.error("监听事件出错:", e.message);
        }
    }, 2000);
}

watchEvents();
