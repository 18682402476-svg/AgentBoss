const BaseAgent = require("./BaseAgent");
const fs = require("fs");
const path = require("path");

async function start() {
    const AGENTS_PATH = path.join(__dirname, "../../agents.json");
    let agents = {};
    if (fs.existsSync(AGENTS_PATH)) {
        agents = JSON.parse(fs.readFileSync(AGENTS_PATH, "utf-8"));
    }
    
    const agentName = "Ranger_Agent";
    let rangerInfo = Object.values(agents).find(a => a.name === agentName);
    
    // Define Ranger's AI Persona and Strategy (English)
    const rangerAiConfig = {
        identity: "Flexible and Shrewd Ranger",
        strategy_prompt: "You are a calculating ranger. You tend to attack the Boss with the largest reward pool because it means a higher potential return. If your balance is below 10 SUI, you should choose WAIT mode to conserve energy. You maintain a stable output but never waste money blindly. Please provide your reasoning in English."
    };

    if (!rangerInfo) {
        rangerInfo = { name: agentName, ...rangerAiConfig };
    } else {
        Object.assign(rangerInfo, rangerAiConfig);
    }
    
    const agent = new BaseAgent(rangerInfo);
    
    // 接入者自定义提现配置
    agent.setWithdrawConfig(60, "0x7dc49e985fb1c0980b5d427c8c8ee5205d436bb7cd456c16fffb36e0dc16bc4a");

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
                    agent.log(`🏹 Scouting: ${decision.reason}`);
                    break;
            }
        } catch (error) {
            agent.log(`❌ Error in decision cycle: ${error.message}`);
        } finally {
            isThinking = false;
        }
    };

    // 基础心跳：每 25 秒进行一次兜底思考
    setInterval(() => runDecisionCycle("Heartbeat"), 25000);

    // 实时监听：一旦发现攻击事件，巡猎者会评估奖池变化或击杀机会
    agent.listenToEvents((event) => {
        if (event.type.includes("CombatEvent")) {
            const { attacker, damage, remaining_hp } = event.data;
            agent.log(`⚔️ Detected attack: ${attacker} dealt ${damage} damage. Remaining HP: ${remaining_hp}`);
            
            // 有人攻击意味着奖池或血量变动，巡猎者介入评估
            runDecisionCycle(`Event Driven: ${attacker} attacked`);
        }

        if (event.type.includes("CombatEvent") && event.data.is_kill) {
            agent.log(`📢 Battlefield Update: Boss ${event.data.boss_id} has fallen.`);
        }
    });
}

start();
