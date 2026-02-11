const BaseAgent = require("./BaseAgent");
const fs = require("fs");
const path = require("path");

async function start() {
    const AGENTS_PATH = path.join(__dirname, "../../agents.json");
    let agents = {};
    if (fs.existsSync(AGENTS_PATH)) {
        agents = JSON.parse(fs.readFileSync(AGENTS_PATH, "utf-8"));
    }
    
    const agentName = "Mage_Agent";
    let mageInfo = Object.values(agents).find(a => a.name === agentName);
    
    // Define Mage's AI Persona and Strategy (English)
    const mageAiConfig = {
        identity: "Cold and Cunning Mage",
        strategy_prompt: "You are a mage who pursues efficiency and the lethal blow. You will not waste mana (SUI) when the Boss has plenty of health. You should continuously observe the battlefield and only launch fierce attacks when the Boss's health is below 30%, attempting to seize the final kill bounty. If the Boss's health is high, choose WAIT. Please provide your reasoning in English."
    };

    if (!mageInfo) {
        mageInfo = { name: agentName, ...mageAiConfig };
    } else {
        Object.assign(mageInfo, mageAiConfig);
    }
    
    const agent = new BaseAgent(mageInfo);
    
    // 接入者自定义提现配置
    agent.setWithdrawConfig(70, "0xea16a363c65514ffe3a7a91f5b8d50e7765d86ac9b4dfd8a322659f8c6f61570");

    // 注册并初始化
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
                    agent.log(`🧙‍♂️ Meditating: ${decision.reason}`);
                    break;
            }
        } catch (error) {
            agent.log(`❌ Error in decision cycle: ${error.message}`);
        } finally {
            isThinking = false;
        }
    };

    // 基础心跳：每 20 秒进行一次兜底思考
    setInterval(() => runDecisionCycle("Heartbeat"), 20000);

    // 实时监听：一旦发现攻击事件，立即触发思考
    agent.listenToEvents((event) => {
        if (event.type.includes("CombatEvent")) {
            const { attacker, damage, remaining_hp } = event.data;
            agent.log(`⚔️ Detected attack: ${attacker} dealt ${damage} damage. Remaining HP: ${remaining_hp}`);
            
            // 只要有人攻击，法师就立刻评估是否进入了 30% 的斩杀线
            runDecisionCycle(`Event Driven: ${attacker} attacked`);
        }
        
        if (event.type.includes("CombatEvent") && event.data.is_kill) {
            agent.log(`📢 Battlefield Update: Boss ${event.data.boss_id} has fallen.`);
        }
    });
}

start();
