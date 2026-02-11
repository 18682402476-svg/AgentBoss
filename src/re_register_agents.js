const { Ed25519Keypair } = require("@mysten/sui.js/keypairs/ed25519");
const fs = require("fs");
const path = require("path");

async function registerThreeAgents() {
    const AGENT_DB_PATH = path.join(__dirname, "../agents.json");
    let agents = {};
    
    const names = ["Warrior_Agent", "Mage_Agent", "Ranger_Agent"];
    
    console.log("正在重新注册 3 个 Agent 并生成私钥...");

    for (const name of names) {
        const keypair = new Ed25519Keypair();
        const address = keypair.getPublicKey().toSuiAddress();
        // Ed25519 私钥应该是 32 字节，keypair.keypair.secretKey 包含了公钥 (共 64 字节)
        // 我们只需要前 32 字节作为私钥种子
        const secretKey = keypair.keypair.secretKey.slice(0, 32); 
        const apiKey = `sk_${Math.random().toString(36).substring(2, 15)}`;

        agents[address] = {
            id: address,
            name: name,
            secretKey: Buffer.from(secretKey).toString('base64'),
            apiKey: apiKey,
            registeredAt: new Date().toISOString()
        };
        console.log(`已注册: ${name} | 地址: ${address} | API Key: ${apiKey}`);
    }

    fs.writeFileSync(AGENT_DB_PATH, JSON.stringify(agents, null, 2));
    console.log("\n✅ 注册完成！agents.json 已更新。");
}

registerThreeAgents().catch(console.error);
