const { SuiClient, getFullnodeUrl } = require("@mysten/sui.js/client");
const { Ed25519Keypair } = require("@mysten/sui.js/keypairs/ed25519");
const { TransactionBlock } = require("@mysten/sui.js/transactions");
const dotenv = require("dotenv");
const fs = require("fs");

dotenv.config({ override: true });

const client = new SuiClient({ url: process.env.SUI_RPC_URL || getFullnodeUrl("localnet") });

// 使用当前环境的 Keypair (假设是 Admin)
// 这里简单演示，实际应从环境变量加载
const adminKeypair = Ed25519Keypair.deriveKeypair(process.env.ADMIN_PHRASE || "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon");

// 使用命令行查询当前 active-address 的私钥 (如果可用) 或者直接使用 sui client 命令行创建
async function createBosses() {
    const bosses = [
        {
            name: "烈焰巨龙",
            description: "拥有毁灭性火焰吐息的古老巨龙，挑战它需要勇气与力量。击败它将获得巨额奖励和“屠龙者”称号NFT。",
            skill: "火焰吐息",
            difficulty: "极高",
            hp: 200,
            attack_cost: 1000000000 // 1 SUI
        },
        {
            name: "冰霜巨像",
            description: "由远古寒冰构成的巨大雕像，能冻结一切接近它的敌人。击败它将获得稀有奖励和“冰霜征服者”NFT。",
            skill: "寒冰风暴",
            difficulty: "中等",
            hp: 150,
            attack_cost: 1000000000
        },
        {
            name: "暗影刺客",
            description: "神出鬼没的暗影刺客，擅长使用暗影突袭攻击敌人。适合新手练习，击败它将获得入门奖励。",
            skill: "暗影突袭",
            difficulty: "简单",
            hp: 100,
            attack_cost: 1000000000
        }
    ];

    console.log("正在通过命令行创建 Boss...");
    const { execSync } = require("child_process");

    for (const boss of bosses) {
        try {
            // 使用双引号包裹参数，这是 PowerShell 的标准做法
            // 关键：在双引号字符串内部，如果内容包含特殊字符或中文字符，PowerShell 可能会出问题
            // 我们尝试最简化的英文参数来验证，如果成功再考虑中文
            const name = boss.name === "烈焰巨龙" ? "FireDragon" : (boss.name === "冰霜巨像" ? "IceGolem" : "ShadowAssassin");
            const desc = boss.name === "烈焰巨龙" ? "Ancient dragon with fire breath" : (boss.name === "冰霜巨像" ? "Giant statue made of ice" : "Mysterious shadow assassin");
            const skill = boss.skill === "火焰吐息" ? "FireBreath" : (boss.skill === "寒冰风暴" ? "IceStorm" : "ShadowAttack");
            const diff = boss.difficulty === "极高" ? "VeryHard" : (boss.difficulty === "中等" ? "Medium" : "Easy");

            const cmd = `sui client call --package ${process.env.PACKAGE_ID} --module boss_battle --function create_boss --args ${process.env.ADMIN_CAP_ID} "${name}" "${desc}" "${skill}" "${diff}" ${boss.hp} ${boss.attack_cost} --gas-budget 1000000000 --json`;
            
            console.log(`执行命令: ${cmd}`);
            const output = execSync(cmd).toString();
            let result;
            try {
                result = JSON.parse(output);
            } catch (parseError) {
                console.error(`解析 JSON 失败: ${parseError.message}`);
                console.log(`原始输出: ${output}`);
                continue;
            }
            
            // 统一处理不同版本的 objectChanges / changed_objects 位置
            const changes = result.objectChanges || result.changed_objects || (result.effects && (result.effects.V2 ? result.effects.V2.status : result.effects.status) === "Success" ? result.objectChanges : null);
            
            const status = result.effects && result.effects.V2 ? result.effects.V2.status.status : (result.effects ? result.effects.status.status : null);
            const isSuccess = status === "Success" || status === "success" || result.confirmedLocalExecution || (result.effects && result.effects.V2 && result.effects.V2.status === "Success");

            if (isSuccess) {
                // 尝试从不同的字段提取 Boss ID
                let bossId = "未知";
                const allChanges = changes || [];
                const bossObject = allChanges.find(oc => {
                    const type = oc.objectType || oc.type || "";
                    return (oc.type === "created" || oc.idOperation === "CREATED" || oc.idOperation === "Created") && type.includes("::Boss");
                });
                if (bossObject) {
                    bossId = bossObject.objectId;
                }
                console.log(`Boss [${boss.name}] 创建成功! ID: ${bossId}`);
            } else {
                const error = result.effects ? (result.effects.V2 ? result.effects.V2.status.error : result.effects.status.error) : (result.error || "未知错误");
                console.error(`Boss [${boss.name}] 失败:`, error);
                console.log(`完整响应:`, JSON.stringify(result));
            }
        } catch (e) {
            console.error(`Boss [${boss.name}] 创建出错:`, e.message);
        }
    }
}

createBosses().catch(console.error);
