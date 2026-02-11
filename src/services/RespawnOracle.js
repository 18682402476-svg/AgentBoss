const { SuiClient } = require("@mysten/sui.js/client");
const { Ed25519Keypair } = require("@mysten/sui.js/keypairs/ed25519");
const { TransactionBlock } = require("@mysten/sui.js/transactions");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

// 基础配置
const client = new SuiClient({ url: process.env.SUI_RPC_URL });
const PACKAGE_ID = process.env.PACKAGE_ID;
const ADMIN_CAP_ID = process.env.ADMIN_CAP_ID;

// 管理员密钥校验
if (!process.env.ADMIN_SECRET_KEY) {
    console.error("❌ 错误: 未在 .env 中发现 ADMIN_SECRET_KEY。Oracle 需要管理员权限来创建新 Boss。");
    process.exit(1);
}

let adminKeypair;
try {
    // 支持 Base64 或 Hex 格式
    const secret = process.env.ADMIN_SECRET_KEY;
    adminKeypair = Ed25519Keypair.fromSecretKey(
        secret.length === 44 ? Buffer.from(secret, "base64") : Buffer.from(secret.replace('0x', ''), "hex")
    );
} catch (e) {
    console.error("❌ 错误: ADMIN_SECRET_KEY 格式不正确。请确保它是 Base64 或 Hex 格式。");
    process.exit(1);
}

// 状态管理
let lastProcessedEventId = null;
const createQueue = new Map(); // boss_id -> { createAt: timestamp, data: bossData }

/**
 * 扫描击杀事件并捕获 Boss 数据
 */
async function pollKillEvents() {
    try {
        const events = await client.queryEvents({
            query: { MoveEventType: `${PACKAGE_ID}::boss_battle::CombatEvent` },
            limit: 20,
            order: "descending"
        });

        for (const event of events.data) {
            const eventId = `${event.id.txDigest}_${event.id.eventSeq}`;
            if (lastProcessedEventId && eventId === lastProcessedEventId) break;

            if (event.parsedJson && event.parsedJson.is_kill) {
                const bossId = event.parsedJson.boss_id;
                
                if (!createQueue.has(bossId)) {
                    // 获取死亡 Boss 的数据进行克隆
                    const oldBoss = await client.getObject({
                        id: bossId,
                        options: { showContent: true }
                    });

                    if (oldBoss.data && oldBoss.data.content) {
                        const fields = oldBoss.data.content.fields;
                        const deathTime = parseInt(fields.death_time);
                        const createAt = deathTime + 30000; // 30秒后创建新的 (加速测试)

                        console.log(`[Oracle] 🕵️ 监测到 Boss 死亡: ${fields.name} (${bossId})`);
                        console.log(`[Oracle] 📝 已记录 Boss 属性，准备 5 分钟后创建新对象...`);
                        
                        createQueue.set(bossId, {
                            createAt,
                            data: {
                                name: fields.name,
                                description: fields.description,
                                skill: fields.skill,
                                difficulty: fields.difficulty,
                                hp: fields.max_hp, // 使用 max_hp 作为新 Boss 的初始血量
                                attack_cost: fields.attack_cost
                            }
                        });
                    }
                }
            }
        }

        if (events.data.length > 0) {
            lastProcessedEventId = `${events.data[0].id.txDigest}_${events.data[0].id.eventSeq}`;
        }
    } catch (error) {
        console.error(`[Oracle] ❌ 轮询事件失败: ${error.message}`);
    }
}

/**
 * 执行创建新 Boss 操作
 */
async function processQueue() {
    const now = Date.now();
    
    for (const [oldBossId, task] of createQueue.entries()) {
        if (now >= task.createAt) {
            console.log(`[Oracle] 🔨 时间已到，正在克隆并创建新 Boss: ${task.data.name}`);
            
            try {
                const txb = new TransactionBlock();
                const d = task.data;
                
                txb.moveCall({
                    target: `${PACKAGE_ID}::boss_battle::create_boss`,
                    arguments: [
                        txb.object(ADMIN_CAP_ID),
                        txb.pure.string(d.name),
                        txb.pure.string(d.description),
                        txb.pure.string(d.skill),
                        txb.pure.string(d.difficulty),
                        txb.pure.u64(d.hp),
                        txb.pure.u64(d.attack_cost)
                    ]
                });

                const result = await client.signAndExecuteTransactionBlock({
                    signer: adminKeypair,
                    transactionBlock: txb,
                    options: { showEffects: true, showEvents: true }
                });

                if (result.effects && result.effects.status.status === "success") {
                    const newBossId = result.events[0].parsedJson.boss_id;
                    console.log(`[Oracle] ✨ 新 Boss 创建成功! ID: ${newBossId}`);
                    console.log(`[Oracle] 💡 旧 ID ${oldBossId} 已被替换。请更新 Agent 的攻击目标（如适用）。`);
                    createQueue.delete(oldBossId);
                } else {
                    console.error(`[Oracle] ❌ 创建失败: ${result.effects.status.error}`);
                    task.createAt = now + 10000; // 10秒后重试
                }
            } catch (error) {
                console.error(`[Oracle] ❌ 创建交易执行失败: ${error.message}`);
                task.createAt = now + 10000; 
            }
        }
    }
}

// 启动服务
console.log(`=========================================`);
console.log(`🚀 Boss Clone & Create Oracle 已启动`);
console.log(`管理员地址: ${adminKeypair.getPublicKey().toSuiAddress()}`);
console.log(`AdminCap: ${ADMIN_CAP_ID}`);
console.log(`模式: 死亡后 5 分钟创建全新同属性 Boss 对象`);
console.log(`=========================================`);

setInterval(pollKillEvents, 10000);
setInterval(processQueue, 5000);

pollKillEvents();
