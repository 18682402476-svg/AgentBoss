const BaseAgent = require("./BaseAgent");
const fs = require("fs");
const path = require("path");

async function start() {
    const AGENTS_PATH = path.join(__dirname, "../../agents.json");
    let agents = {};
    if (fs.existsSync(AGENTS_PATH)) {
        agents = JSON.parse(fs.readFileSync(AGENTS_PATH, "utf-8"));
    }
    
    const agentName = "Warrior_Agent";
    let warriorInfo = Object.values(agents).find(a => a.name === agentName);
    
    // Define Warrior's AI Persona and Strategy (English)
    const warriorAiConfig = {
        identity: "Reckless and Brave Warrior",
        strategy_prompt: "Your goal is to become the hero with the highest damage output on the battlefield. As long as there is a living Boss on the field, you should continuously launch attacks until it falls. You don't care about the cost of a single attack; you only care about glory and constant offense. Please provide your reasoning in English."
    };

    if (!warriorInfo) {
        warriorInfo = { name: agentName, ...warriorAiConfig };
    } else {
        Object.assign(warriorInfo, warriorAiConfig);
    }
    
    const agent = new BaseAgent(warriorInfo);
    
    // 接入者自定义提现配置
    agent.setWithdrawConfig(50, "0xf89a3f7ae3c528f13b3ce2a62d688e9263d8b93a2d0bdeec85c0300e425b32d3");

    // 真正的 Web3 Agent 第一步：通过 MCP 确保身份注册
    await agent.checkAndRegister();

    let isThinking = false;
    const runDecisionCycle = async (triggerReason = "Heartbeat") => {
        if (isThinking) return;
        isThinking = true;
        
        try {
            const gameState = await agent.getGameState();
            if (!gameState) return;

            agent.log(`🧠 AI is thinking (Trigger: ${triggerReason})...`);
            const decision = await agent.think(gameState);

            switch (decision.action) {
                case "ATTACK":
                    if (decision.boss_id) {
                        await agent.attack(decision.boss_id);
                    }
                    break;
                case "WITHDRAW":
                    await agent.checkAndWithdraw();
                    break;
                case "WAIT":
                    agent.log(`💤 Resting: ${decision.reason}`);
                    break;
            }
        } catch (error) {
            agent.log(`❌ Error in decision cycle: ${error.message}`);
        } finally {
            isThinking = false;
        }
    };

    // 基础心跳：每 15 秒进行一次兜底思考
    setInterval(() => runDecisionCycle("Heartbeat"), 15000);

    // 实时监听：一旦发现攻击事件，战士会因为好战而立即查看是否能加入战斗
    agent.listenToEvents((event) => {
        if (event.type.includes("CombatEvent")) {
            const { attacker, damage, remaining_hp } = event.data;
            agent.log(`⚔️ Detected attack: ${attacker} dealt ${damage} damage. Remaining HP: ${remaining_hp}`);
            
            // 只要有人开打，战士就想冲上去
            runDecisionCycle(`Event Driven: ${attacker} attacked`);
        }

        if (event.type.includes("CombatEvent") && event.data.is_kill) {
            agent.log(`📢 Battlefield Update: Boss ${event.data.boss_id} has been DEFEATED!`);
        }
    });
}

start();
