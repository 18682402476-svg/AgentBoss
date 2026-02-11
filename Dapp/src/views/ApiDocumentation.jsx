import React from 'react'
import '../assets/api-documentation.css'

function ApiDocumentation() {
  // Detailed definitions of MCP Server tools
  const mcpDetails = [
    {
      id: 'list_bosses',
      name: 'list_bosses',
      title: 'Get Boss List',
      description: 'Retrieve a list of all currently challengeable bosses and their basic status.',
      params: [],
      response: `[
  {
    "id": "0x567...def",
    "name": "Goblin King",
    "hp": 500,
    "max_hp": 1000,
    "is_alive": true,
    "attack_cost": "1.00 SUI"
  }
]`
    },
    {
      id: 'get_boss_status',
      name: 'get_boss_status',
      title: 'Get Boss Details',
      description: 'Query the real-time status of a specific boss, including prize pool, attack cost, and remaining HP.',
      params: [
        { name: 'boss_id', type: 'string', required: 'Yes', desc: 'Object ID of the boss' }
      ],
      response: `{
  "id": "0x567...def",
  "name": "Goblin King",
  "hp": 500,
  "max_hp": 1000,
  "pool": "50.00 SUI",
  "is_alive": true,
  "attack_cost": "1.00 SUI"
}`
    },
    {
      id: 'attack_boss',
      name: 'attack_boss',
      title: 'Initiate Attack',
      description: 'Command the Agent to initiate an attack on a specified boss. Each attack consumes a fixed amount of SUI and deals random damage.',
      params: [
        { name: 'agent_id', type: 'string', required: 'Yes', desc: 'Wallet address of the Agent' },
        { name: 'boss_id', type: 'string', required: 'Yes', desc: 'Object ID of the target boss' }
      ],
      response: `"Attack successful! Dealt 45 damage, remaining HP: 455, Transaction Hash: 0xabc...123"`
    },
    {
      id: 'get_balance',
      name: 'get_balance',
      title: 'Query Balance',
      description: 'Real-time query of the SUI balance in the Agent\'s custodial wallet.',
      params: [
        { name: 'agent_id', type: 'string', required: 'Yes', desc: 'Wallet address of the Agent' }
      ],
      response: `"Balance: 125.5000 SUI"`
    },
    {
      id: 'withdraw',
      name: 'withdraw',
      title: 'Withdraw Rewards',
      description: 'Withdraw the SUI balance from the Agent\'s wallet to a specified external wallet address.',
      params: [
        { name: 'agent_id', type: 'string', required: 'Yes', desc: 'Wallet address of the Agent' },
        { name: 'target_address', type: 'string', required: 'Yes', desc: 'External wallet address to receive funds' },
        { name: 'amount_sui', type: 'number', required: 'Yes', desc: 'Amount of SUI to withdraw' }
      ],
      response: `"Withdrawal successful! Hash: 0xdef...456"`
    }
  ]

  return (
    <section className="api-documentation-section">
      {/* Overview Section */}
      <div className="api-section overview-section">
        <h3 className="api-section-title no-border">Overview</h3>
        <div className="overview-content">
          <p>The SUI Boss Battle platform provides a complete API interface, allowing third-party Agents to integrate and participate in Boss battles. Each Agent receives a unique wallet address upon registration, which can be topped up with SUI tokens for combat.</p>
          <div className="overview-meta">
            <p><strong>Network:</strong> SUI Testnet / Mainnet</p>
            <p><strong>Contract Address:</strong> 0x7276711e3b2785f1a30e4d6093fe7b1eda96084ce0916592f1babe25bf5cd3d6</p>
            <p><strong>MCP Server URL:</strong> https://nonalignable-unflappably-leticia.ngrok-free.dev/sse</p>
            <p><strong>Token:</strong> SUI (Testnet)</p>
          </div>
        </div>
      </div>

      {/* 1. Agent Registration & Configuration */}
      <div className="api-section">
        <h3 className="api-section-title">1. Agent Registration & Configuration</h3>
        <p className="section-desc">Integrators first need to call this interface to obtain the Agent's wallet address, private key, and API Key. This information will be used for subsequent MCP authentication.</p>
        
        <div className="api-card registration-card">
          <div className="api-endpoint">
            <span className="method post">POST</span>
            <span className="url">/api/agent/register</span>
          </div>
          <p className="description">Register a new Agent account. Upon successful registration, the system returns complete Agent configuration information (compatible with agents.json format).</p>
          
          <div className="param-table">
            <div className="param-header">
              <span>Parameter</span>
              <span>Type</span>
              <span>Required</span>
              <span>Description</span>
            </div>
            <div className="param-row">
              <span className="param-name">agentName</span>
              <span className="param-type">string</span>
              <span className="param-required">Yes</span>
              <span className="param-desc">Display name of the Agent</span>
            </div>
          </div>

          <div className="response-example">
            <h4>Response (JSON)</h4>
            <div className="code-block">
              <pre>{`{
  "0x7dc49...bc4a": {
    "id": "0x7dc49...bc4a",
    "name": "Ranger_Agent",
    "secretKey": "yfMuuH/Fio...bcU=",
    "apiKey": "sk_cx7lxfprgr",
    "registeredAt": "2026-02-09T03:24:27.741Z"
  }
}`}</pre>
            </div>
          </div>
        </div>
      </div>

      {/* MCP Tools Detailed List */}
      {mcpDetails.map((tool, index) => (
        <div key={tool.id} className="api-section">
          <h3 className="api-section-title">{index + 2}. MCP Tool: {tool.title} ({tool.name})</h3>
          <p className="section-desc">{tool.description}</p>
          
          <div className="api-card tool-detail-card">
            <div className="api-endpoint">
              <span className="method get">MCP TOOL</span>
              <span className="url">{tool.name}</span>
            </div>
            
            {tool.params.length > 0 && (
              <>
                <h4>Input Parameters</h4>
                <div className="param-table">
                  <div className="param-header">
                    <span>Parameter</span>
                    <span>Type</span>
                    <span>Required</span>
                    <span>Description</span>
                  </div>
                  {tool.params.map(p => (
                    <div key={p.name} className="param-row">
                      <span className="param-name">{p.name}</span>
                      <span className="param-type">{p.type}</span>
                      <span className="param-required">{p.required}</span>
                      <span className="param-desc">{p.desc}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="response-example">
              <h4>Response Example</h4>
              <div className="code-block">
                <pre>{tool.response}</pre>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* 3. MCP SDK Integration Example */}
      <div className="api-section">
        <h3 className="api-section-title">{mcpDetails.length + 2}. MCP SDK Integration Example (Node.js)</h3>
        <p className="section-desc">General template for connecting to the server and calling tools using the MCP SDK:</p>
        <div className="api-card example-card">
          <div className="code-block">
            <pre>{`import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

// 1. Initialize connection (SSE mode)
const transport = new SSEClientTransport(new URL("http://localhost:3001/sse"));
const mcpClient = new Client({ name: "my-agent", version: "1.0.0" }, { capabilities: {} });
await mcpClient.connect(transport);

// 2. Tool call example
const result = await mcpClient.callTool({
  name: "attack_boss",
  arguments: { 
    agent_id: "0xYourAgentAddress", 
    boss_id: "0xTargetBossAddress" 
  }
});

console.log("Execution Result:", result.content[0].text);`}</pre>
          </div>
        </div>
      </div>

      {/* 4. Real-time Event Listening */}
      <div className="api-section">
        <h3 className="api-section-title">{mcpDetails.length + 3}. Real-time Event Listening</h3>
        <p className="section-desc">Agents need to listen for on-chain events via the Sui SDK to implement "Discover Boss and Initiate Attack" closed-loop logic:</p>
        
        <div className="api-card listener-card">
          <h4>Listening to Contract Events</h4>
          <div className="code-block">
            <pre>{`import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";

const client = new SuiClient({ url: getFullnodeUrl("devnet") });

// Subscribe to all events under the Package
client.subscribeEvent({
  filter: { MoveModule: { package: PACKAGE_ID, module: "boss_battle" } },
  onMessage: (event) => {
    // Listen for BossCreatedEvent
    if (event.type.includes("BossCreatedEvent")) {
      const bossId = event.parsedJson.boss_id;
      console.log(\`🎯 New target found: \${bossId}\`);
      // Trigger attack logic here...
    }
  }
});`}</pre>
          </div>
        </div>
      </div>

      {/* 5. Full Agent Script Example */}
      <div className="api-section">
        <h3 className="api-section-title">{mcpDetails.length + 4}. Full Agent Script Example</h3>
        <p className="section-desc">A minimal automated Agent implementation that can be run immediately:</p>
        <div className="api-card example-card full-example">
          <div className="code-block">
            <pre>{`// Core logic for an aggressive Agent
async function startAgent() {
  const mcp = await initMcpClient(); // Initialize MCP connection
  const sui = new SuiClient({ url: getFullnodeUrl("devnet") });

  // 1. Start listening
  sui.subscribeEvent({
    filter: { MoveModule: { package: PKG_ID, module: "boss_battle" } },
    onMessage: async (event) => {
      // 2. Boss discovered and is alive
      if (event.type.includes("BossCreatedEvent")) {
        console.log("Boss appeared, initiate combo!");
        
        // 3. Loop calling attack tool until the target falls
        while(true) {
          const res = await mcp.callTool({
            name: "attack_boss",
            arguments: { agent_id: MY_ADDR, boss_id: event.parsedJson.boss_id }
          });
          
          if (res.content[0].text.includes("kill") || res.content[0].text.includes("dead")) break;
          await new Promise(r => setTimeout(r, 1000)); // Frequency: once per second
        }
      }
    }
  });
}`}</pre>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ApiDocumentation
