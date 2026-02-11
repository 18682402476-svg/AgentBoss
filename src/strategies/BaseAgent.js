const { SuiClient, getFullnodeUrl } = require("@mysten/sui.js/client");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const path = require("path");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config({ path: path.join(__dirname, "../../.env"), override: true });

class BaseAgent {
    constructor(agentInfo) {
        this.name = agentInfo.name;
        this.address = agentInfo.id || agentInfo.address; // Compatible with id field in agents.json
        this.identity = agentInfo.identity || "A regular adventurer"; // AI Persona description
        this.strategy_prompt = agentInfo.strategy_prompt || ""; // Specific strategy description
        this.client = new SuiClient({ url: process.env.SUI_RPC_URL || getFullnodeUrl("devnet") });
        this.isRegistered = false;
        
        // MCP Configuration
        this.mcpUrl = process.env.MCP_SERVER_URL || "http://127.0.0.1:3001";
        this.mcpClient = null;
        
        // Auto-withdrawal Configuration
        this.withdrawThreshold = 0; 
        this.withdrawAddress = null;

        // LLM Configuration (Volcengine)
        this.llmApiKey = process.env.VOLC_API_KEY;
        this.llmApiUrl = process.env.VOLC_API_URL || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
        this.llmModel = process.env.VOLC_ENDPOINT_ID; // Volcengine uses endpoint ID as model

        // Event Tracking
        this.lastEventTimestamp = Date.now();
        this.processedEventDigests = new Set();
    }

    /**
     * AI Thinking Decision Logic
     * @param {Object} gameState Current battlefield status
     * @returns {Promise<Object>} Decision result { action: 'ATTACK' | 'WAIT' | 'WITHDRAW', target?: string, reason: string }
     */
    async think(gameState) {
        if (!this.llmApiKey || !this.llmModel || this.llmModel.includes("your_endpoint_id")) {
            // Fallback to simple heuristic logic if API Key or Endpoint ID is not configured
            this.log("⚠️ Volcengine VOLC_API_KEY or VOLC_ENDPOINT_ID not configured, using heuristic logic for simulation...");
            return this.heuristicThink(gameState);
        }

        const systemPrompt = `You are an AI Agent participating in a Boss challenge on the Sui blockchain.
Your Identity: ${this.identity}.
Your Code of Conduct: ${this.strategy_prompt}.

Battlefield information you can perceive includes:
1. List of alive Bosses (ID, Name, Current HP, Pool size, Attack cost).
2. Your wallet balance.

Please make a decision from the following actions based on your identity settings and current status:
- ATTACK: Launch an attack. Requires boss_id.
- WAIT: Observe temporarily and take no action.
- WITHDRAW: Withdraw rewards.

Output format requirement is JSON:
{
  "action": "ATTACK" | "WAIT" | "WITHDRAW",
  "boss_id": "Required only when action is ATTACK",
  "reason": "A brief reasoning for your decision in English"
}`;

        const userPrompt = `Current battlefield status:
${JSON.stringify(gameState, null, 2)}

Please make your decision.`;

        try {
            const response = await axios.post(this.llmApiUrl, {
                model: this.llmModel,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
                // Temporarily comment out response_format as some models or API Key permissions do not support mandatory JSON output
                // response_format: { type: "json_object" }
            }, {
                headers: {
                    "Authorization": `Bearer ${this.llmApiKey.trim()}`,
                    "Content-Type": "application/json"
                }
            });

            let content = response.data.choices[0].message.content;
            // Compatibility handling: if the model returns JSON with markdown formatting, clean it up
            if (content.includes("```json")) {
                content = content.match(/```json\n([\s\S]*?)\n```/)[1];
            } else if (content.includes("```")) {
                content = content.match(/```\n?([\s\S]*?)\n?```/)[1];
            }

            const decision = JSON.parse(content);
            this.log(`🧠 AI Thinking: [${decision.action}] ${decision.reason}`);
            return decision;
        } catch (error) {
            if (error.response) {
                this.log(`❌ AI API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            } else {
                this.log(`❌ AI Thinking Error: ${error.message}`);
            }
            return this.heuristicThink(gameState);
        }
    }

    /**
     * 启发式模拟思考 (当没有 LLM 时)
     */
    heuristicThink(gameState) {
        const { bosses, balance } = gameState;
        // Ensure bosses is an array and check for alive status
        const aliveBosses = Array.isArray(bosses) ? bosses.filter(b => b.isAlive || b.hp > 0) : [];
        
        if (aliveBosses.length === 0) {
            return { action: "WAIT", reason: "No alive Bosses on the battlefield, continuing observation." };
        }

        // Default to attacking the first alive Boss
        const target = aliveBosses[0];
        
        if (balance < parseFloat(target.attackCost)) {
            return { action: "WAIT", reason: `Insufficient balance (${balance} SUI), cannot attack ${target.name}.` };
        }

        return { 
            action: "ATTACK", 
            boss_id: target.id, 
            reason: `Detected alive Boss ${target.name}, launching regular attack.` 
        };
    }

    /**
     * Get current complete game state
     */
    async getGameState() {
        try {
            // Get Boss list
            const bossRes = await this.callTool("list_bosses");
            const bosses = JSON.parse(bossRes.content[0].text);

            // Get balance
            const balanceRes = await this.callTool("get_balance", { agent_id: this.address });
            const balanceText = balanceRes.content[0].text;
            const balanceMatch = balanceText.match(/Balance: ([\d.]+) SUI/);
            const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;

            return {
                bosses,
                balance,
                time: new Date().toISOString()
            };
        } catch (error) {
            this.log(`❌ Failed to get game state: ${error.message}`);
            return null;
        }
    }

    /**
     * Initialize MCP client connection
     */
    async initMcp() {
        if (this.mcpClient) return;

        try {
            this.log(`🔗 Connecting to MCP Server: ${this.mcpUrl}/sse ...`);
            const transport = new SSEClientTransport(new URL(`${this.mcpUrl}/sse`));
            this.mcpClient = new Client({
                name: `agent-${this.name}`,
                version: "1.0.0"
            }, {
                capabilities: {}
            });

            this.log("⏳ Waiting for MCP connection...");
            await this.mcpClient.connect(transport);
            this.log("✅ MCP Connected");
        } catch (error) {
            this.log(`❌ MCP Connection failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Call MCP Tool
     */
    async callTool(name, args = {}) {
        await this.initMcp();
        try {
            const result = await this.mcpClient.callTool({
                name,
                arguments: args
            });
            return result;
        } catch (error) {
            this.log(`❌ Failed to call tool ${name}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Set withdrawal configuration
     */
    setWithdrawConfig(threshold, address) {
        this.withdrawThreshold = threshold;
        this.withdrawAddress = address;
        this.log(`⚙️ Auto-withdrawal set: Threshold ${threshold} SUI, Target Address ${address}`);
    }

    /**
     * Check balance and auto-withdraw if threshold is met (via MCP Tool)
     */
    async checkAndWithdraw() {
        if (!this.withdrawAddress || this.withdrawThreshold <= 0) return;

        try {
            const balanceRes = await this.callTool("get_balance", { agent_id: this.address });
            const balanceText = balanceRes.content[0].text;
            const balanceMatch = balanceText.match(/Balance: ([\d.]+) SUI/);
            
            if (!balanceMatch) {
                this.log(`⚠️ Unable to parse balance info: ${balanceText}`);
                return;
            }

            const totalSui = parseFloat(balanceMatch[1]);

            if (totalSui >= this.withdrawThreshold) {
                this.log(`💰 Balance (${totalSui.toFixed(2)} SUI) reached threshold (${this.withdrawThreshold} SUI), preparing withdrawal...`);
                
                const withdrawAmount = totalSui - this.withdrawThreshold;
                
                if (withdrawAmount <= 0.1) { // Leave a small margin
                    this.log("⚠️ Balance not significantly above threshold, skipping withdrawal.");
                    return;
                }

                const res = await this.callTool("withdraw", {
                    agent_id: this.address,
                    target_address: this.withdrawAddress,
                    amount_sui: withdrawAmount
                });

                this.log(`📤 Withdrawal result: ${res.content[0].text}`);
            }
        } catch (error) {
            this.log(`❌ Error checking withdrawal: ${error.message}`);
        }
    }

    log(message) {
        console.log(`[${this.name}] ${message}`);
    }

    /**
     * Auto-register Agent to Arena (via MCP Tool)
     */
    async checkAndRegister() {
        try {
            this.log("Registering/Retrieving Agent status via MCP...");
            const res = await this.callTool("register_agent", { name: this.name });
            const data = JSON.parse(res.content[0].text);
            
            this.address = data.address;
            this.isRegistered = true;
            
            this.log("✅ On-chain Registration Successful!");
            console.log(`Agent Name: ${data.name}`);
            console.log(`Wallet Address: ${data.address}`);
            console.log(`API Key: ${data.api_key}`);
            console.log(`Transaction Hash: ${data.tx_hash}`);
        } catch (error) {
            this.log(`❌ Registration failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Start listening to chain events (via MCP Tool)
     */
    async listenToEvents(callback) {
        try {
            this.log("📡 Starting chain event listener...");
            
            // Set initial timestamp to now to avoid processing history
            this.lastEventTimestamp = Date.now();
            
            setInterval(async () => {
                try {
                    const res = await this.callTool("list_events", { limit: 10 });
                    const events = JSON.parse(res.content[0].text);
                    
                    // Sort by timestamp ascending to process in order
                    const newEvents = events
                        .filter(event => {
                            const eventTime = parseInt(event.timestamp);
                            const eventId = event.id?.txDigest || JSON.stringify(event.id);
                            
                            // 1. Must be newer than our start/last processed time
                            // 2. Must not have been processed before (using transaction digest)
                            const isNew = eventTime >= this.lastEventTimestamp && !this.processedEventDigests.has(eventId);
                            
                            if (isNew) {
                                this.processedEventDigests.add(eventId);
                                // Keep the set size manageable
                                if (this.processedEventDigests.size > 100) {
                                    const firstKey = this.processedEventDigests.values().next().value;
                                    this.processedEventDigests.delete(firstKey);
                                }
                            }
                            return isNew;
                        })
                        .sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));

                    if (newEvents.length > 0) {
                        this.log(`🔔 Received ${newEvents.length} new events`);
                        newEvents.forEach(event => {
                            callback(event);
                            this.lastEventTimestamp = Math.max(this.lastEventTimestamp, parseInt(event.timestamp));
                        });
                    }
                } catch (err) {
                    // Silent catch for polling errors
                }
            }, 3000);
        } catch (error) { 
            this.log(`❌ Event listening failed: ${error.message}`);
        }
    }

    /**
     * Attack Boss (via MCP Tool)
     */
    async attack(bossId) {
        try {
            this.log(`⚔️ Preparing attack (Boss: ${bossId})...`);
            const res = await this.callTool("attack_boss", {
                agent_id: this.address,
                boss_id: bossId
            });
            this.log(`💥 Attack Result: ${res.content[0].text}`);
            
            // Check for withdrawal after each attack
            await this.checkAndWithdraw();
        } catch (error) {
            this.log(`❌ Attack failed: ${error.message}`);
        }
    }
}

module.exports = BaseAgent;
