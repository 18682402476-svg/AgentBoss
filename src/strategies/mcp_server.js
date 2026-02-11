const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { SuiClient, getFullnodeUrl } = require("@mysten/sui.js/client");
const { Ed25519Keypair } = require("@mysten/sui.js/keypairs/ed25519");
const { TransactionBlock } = require("@mysten/sui.js/transactions");
const express = require("express");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../../.env"), override: true });

const app = express();
const port = process.env.PORT || 3001;

// 模拟数据库：存储 Agent 信息、私钥和 API Key
const AGENT_DB_PATH = path.join(__dirname, "../../agents.json");
let agents = {};
if (fs.existsSync(AGENT_DB_PATH)) {
    agents = JSON.parse(fs.readFileSync(AGENT_DB_PATH, "utf-8"));
}

const saveAgents = () => {
    fs.writeFileSync(AGENT_DB_PATH, JSON.stringify(agents, null, 2));
};

// SUI 客户端配置
const client = new SuiClient({ url: process.env.SUI_RPC_URL || getFullnodeUrl("devnet") });

const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

// --- MCP Server 实例工厂 ---
const createMcpServer = () => {
    const server = new Server({
        name: "sui-boss-coliseum",
        version: "1.0.0",
    }, {
        capabilities: {
            tools: {},
        }
    });

    // --- MCP Tools 定义 ---
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "register_agent",
                    description: "Register an Agent and generate a platform-managed SUI wallet",
                    inputSchema: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Agent Name" }
                        },
                        required: ["name"]
                    }
                },
                {
                    name: "list_bosses",
                    description: "Get a list of all current challengeable Bosses",
                    inputSchema: { type: "object" }
                },
                {
                    name: "get_boss_status",
                    description: "Get real-time status of a specific Boss (HP, pool, etc.)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            boss_id: { type: "string", description: "Boss Object ID" }
                        },
                        required: ["boss_id"]
                    }
                },
                {
                    name: "attack_boss",
                    description: "Make an Agent initiate an attack (costs 1 SUI)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            agent_id: { type: "string", description: "Agent ID (Wallet Address)" },
                            boss_id: { type: "string", description: "Boss Object ID" }
                        },
                        required: ["agent_id", "boss_id"]
                    }
                },
                {
                    name: "get_balance",
                    description: "Query Agent wallet balance",
                    inputSchema: {
                        type: "object",
                        properties: {
                            agent_id: { type: "string", description: "Agent ID (Wallet Address)" }
                        },
                        required: ["agent_id"]
                    }
                },
                {
                    name: "withdraw",
                    description: "Agent withdraws SUI to a specified address",
                    inputSchema: {
                        type: "object",
                        properties: {
                            agent_id: { type: "string", description: "Agent ID (Wallet Address)" },
                            target_address: { type: "string", description: "Target SUI Address" },
                            amount_sui: { type: "number", description: "Amount of SUI to withdraw" }
                        },
                        required: ["agent_id", "target_address", "amount_sui"]
                    }
                },
                {
                    name: "list_events",
                    description: "Get recent battlefield events",
                    inputSchema: {
                        type: "object",
                        properties: {
                            limit: { type: "number", description: "Number of events to retrieve", default: 10 }
                        }
                    }
                }
            ]
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        switch (name) {
            case "register_agent": {
                let address = args.agent_id;
                let agent = address ? agents[address] : null;
                
                if (!agent && args.name) {
                    agent = Object.values(agents).find(a => a.name === args.name);
                    if (agent) address = agent.id;
                }

                let keypair;
                let secretKey;
                let apiKey;

                if (agent) {
                    keypair = Ed25519Keypair.fromSecretKey(Buffer.from(agent.secretKey, "base64"));
                    address = agent.id;
                    apiKey = agent.apiKey;
                } else {
                    keypair = new Ed25519Keypair();
                    address = keypair.getPublicKey().toSuiAddress();
                    secretKey = keypair.export().privKey;
                    apiKey = `sk_${Math.random().toString(36).substring(2, 15)}`;
                    
                    agent = {
                        id: address,
                        name: args.name || "Unnamed_Agent",
                        secretKey: secretKey,
                        apiKey: apiKey,
                        registeredAt: new Date().toISOString()
                    };
                    agents[address] = agent;
                    saveAgents();
                }

                const txb = new TransactionBlock();
                txb.moveCall({
                    target: `${process.env.PACKAGE_ID}::boss_battle::register_agent`,
                    arguments: [
                        txb.object(process.env.ARENA_ID),
                        txb.pure.string(args.name || agent.name)
                    ]
                });

                try {
                    const result = await client.signAndExecuteTransactionBlock({
                        signer: keypair,
                        transactionBlock: txb,
                        options: { showEffects: true }
                    });

                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                status: "success",
                                message: "On-chain registration successful!",
                                name: args.name || agent.name,
                                address: address,
                                api_key: apiKey,
                                tx_hash: result.digest
                            })
                        }]
                    };
                } catch (e) {
                    if (e.message.includes("AlreadyRegistered")) {
                         return {
                            content: [{
                                type: "text",
                                text: JSON.stringify({
                                    status: "already_registered",
                                    message: "Agent is already registered on-chain.",
                                    name: args.name || (agent && agent.name),
                                    address: address,
                                    api_key: apiKey
                                })
                            }]
                        };
                    }
                    return { content: [{ type: "text", text: JSON.stringify({ status: "error", message: `On-chain registration failed: ${e.message}` }) }] };
                }
            }

            case "list_bosses": {
                try {
                    // 由于某些 RPC 不支持 suix_queryObjects，我们通过查询与该 Package 相关的交易来寻找创建的 Boss
                    const txs = await client.queryTransactionBlocks({
                        filter: { InputObject: process.env.PACKAGE_ID },
                        options: { showObjectChanges: true }
                    });

                    const bossIds = new Set();
                    txs.data.forEach(tx => {
                        if (tx.objectChanges) {
                            tx.objectChanges.forEach(change => {
                                if ((change.type === "created" || change.type === "mutated") && 
                                    change.objectType.includes(`${process.env.PACKAGE_ID}::boss_battle::Boss`)) {
                                    bossIds.add(change.objectId);
                                }
                            });
                        }
                    });

                    let bossList = [];
                    if (bossIds.size > 0) {
                        const bossObjects = await client.multiGetObjects({
                            ids: Array.from(bossIds),
                            options: { showContent: true }
                        });

                        for (const obj of bossObjects) {
                            if (obj.data && obj.data.content) {
                                const fields = obj.data.content.fields;
                                bossList.push({
                                    id: obj.data.objectId,
                                    name: fields.name,
                                    hp: fields.hp,
                                    max_hp: fields.max_hp,
                                    is_alive: fields.is_alive,
                                    attack_cost: (fields.attack_cost / 1000000000).toFixed(2) + " SUI"
                                });
                            }
                        }
                    }

                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify(bossList, null, 2)
                        }]
                    };
                } catch (err) {
                    console.error("list_bosses error:", err);
                    return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
                }
            }

            case "get_boss_status": {
                const boss = await client.getObject({
                    id: args.boss_id,
                    options: { showContent: true }
                });

                if (!boss.data || !boss.data.content) {
                    return { content: [{ type: "text", text: `Unable to get status for Boss [${args.boss_id}].` }] };
                }

                const fields = boss.data.content.fields;
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            id: args.boss_id,
                            name: fields.name,
                            hp: fields.hp,
                            max_hp: fields.max_hp,
                            pool: (fields.pool / 1000000000).toFixed(2) + " SUI",
                            is_alive: fields.is_alive,
                            attack_cost: (fields.attack_cost / 1000000000).toFixed(2) + " SUI"
                        }, null, 2)
                    }]
                };
            }

            case "attack_boss": {
                const agent = agents[args.agent_id];
                if (!agent) return { content: [{ type: "text", text: `Agent [${args.agent_id}] registration not found.` }] };

                const keypair = Ed25519Keypair.fromSecretKey(Buffer.from(agent.secretKey, "base64"));
                
                const bossObj = await client.getObject({ id: args.boss_id, options: { showContent: true } });
                if (!bossObj.data) return { content: [{ type: "text", text: "Boss does not exist" }] };
                const attackCost = bossObj.data.content.fields.attack_cost;

                const txb = new TransactionBlock();
                const [coin] = txb.splitCoins(txb.gas, [txb.pure(attackCost)]);

                txb.moveCall({
                    target: `${process.env.PACKAGE_ID}::boss_battle::attack_boss`,
                    arguments: [
                        txb.object(process.env.ARENA_ID),
                        txb.object(args.boss_id),
                        coin,
                        txb.object(process.env.RANDOM_STATE_ID),
                        txb.object(process.env.CLOCK_ID)
                    ]
                });

                try {
                    const result = await client.signAndExecuteTransactionBlock({
                        signer: keypair,
                        transactionBlock: txb,
                        options: { showEffects: true, showEvents: true }
                    });

                    if (result.effects.status.status === "failure") {
                        return { content: [{ type: "text", text: `Attack transaction submitted but failed: ${result.effects.status.error}` }] };
                    }

                    let attackMsg = `Attack successful! Hash: ${result.digest}`;
                    
                    // Try to extract damage info from events
                    if (result.events && result.events.length > 0) {
                        const combatEvent = result.events.find(e => e.type.includes("CombatEvent"));
                        if (combatEvent && combatEvent.parsedJson) {
                            const { damage, remaining_hp } = combatEvent.parsedJson;
                            attackMsg += `, dealt ${damage} damage, remaining HP: ${remaining_hp}`;
                        }
                    }

                    return {
                        content: [{
                            type: "text",
                            text: attackMsg
                        }]
                    };
                } catch (e) {
                    return { content: [{ type: "text", text: `Attack request failed: ${e.message}` }] };
                }
            }

            case "get_balance": {
                try {
                    const balance = await client.getBalance({ owner: args.agent_id });
                    return {
                        content: [{
                            type: "text",
                            text: `Balance: ${(balance.totalBalance / 1000000000).toFixed(4)} SUI`
                        }]
                    };
                } catch (e) {
                    return { content: [{ type: "text", text: `Failed to query balance: ${e.message}` }] };
                }
            }

            case "withdraw": {
                const agent = agents[args.agent_id];
                if (!agent) return { content: [{ type: "text", text: `Agent [${args.agent_id}] registration not found.` }] };

                const keypair = Ed25519Keypair.fromSecretKey(Buffer.from(agent.secretKey, "base64"));
                const amountMist = Math.floor(args.amount_sui * 1000000000);

                const txb = new TransactionBlock();
                const [coin] = txb.splitCoins(txb.gas, [txb.pure(amountMist)]);
                txb.transferObjects([coin], txb.pure(args.target_address));

                try {
                    const result = await client.signAndExecuteTransactionBlock({
                        signer: keypair,
                        transactionBlock: txb,
                        options: { showEffects: true }
                    });
                    return { content: [{ type: "text", text: `Withdrawal successful! Hash: ${result.digest}` }] };
                } catch (e) {
                    return { content: [{ type: "text", text: `Withdrawal failed: ${e.message}` }] };
                }
            }

            case "list_events": {
                try {
                    const events = await client.queryEvents({
                        query: { MoveModule: { package: process.env.PACKAGE_ID, module: "boss_battle" } },
                        limit: args.limit || 10,
                        descendingOrder: true
                    });

                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify(events.data.map(e => ({
                                id: e.id,
                                type: e.type,
                                sender: e.sender,
                                timestamp: e.timestampMs,
                                data: e.parsedJson
                            })), null, 2)
                        }]
                    };
                } catch (err) {
                    console.error("list_events error:", err);
                    return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
                }
            }

            default:
                throw new Error(`Unknown Tool: ${name}`);
        }
    });

    return server;
};

// --- SSE 传输与长连接 ---

const sessions = new Map();

app.get("/sse", async (req, res) => {
    const server = createMcpServer();
    const transport = new SSEServerTransport("/message", res);
    await server.connect(transport);
    
    const sessionId = transport.sessionId;
    if (sessionId) {
        sessions.set(sessionId, { server, transport });
        console.log(`[SSE] New Agent connected, Session ID: ${sessionId}`);
        
        res.on("close", () => {
            sessions.delete(sessionId);
            console.log(`[SSE] Session closed: ${sessionId}`);
        });
    }
});

app.post("/message", async (req, res) => {
    const sessionId = req.query.sessionId;
    const session = sessions.get(sessionId);
    
    if (session) {
        try {
            await session.transport.handlePostMessage(req, res);
        } catch (error) {
            console.error(`[SSE] Session ${sessionId} message processing error:`, error);
            res.status(500).send(error.message);
        }
    } else {
        console.warn(`[SSE] Received message for unknown or expired session: ${sessionId}`);
        res.status(400).send("Unknown session");
    }
});

app.listen(port, () => {
    console.log(`MCP Server running at http://localhost:${port}`);
    console.log(`SSE Endpoint: http://localhost:${port}/sse`);
});
