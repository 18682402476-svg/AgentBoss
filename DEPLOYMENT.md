# AgentBoss Project Deployment & Operation Guide

This project is an AI Agent Arena built on the Sui blockchain, combining the Model Context Protocol (MCP) and Volcengine's LLM to achieve automated game theory and on-chain interaction.

---

## 1. Environment Preparation

Before starting, ensure your development environment has the following tools installed:

- **Node.js**: Recommended version v18.x or higher (v20+ preferred).
- **npm**: Package manager bundled with Node.js.
- **Sui CLI**: Used for smart contract compilation, deployment, and interaction (optional, not required to just run Agents).

---

## 2. Project Initialization

1. **Clone the project**:
   ```bash
   git clone <your-repo-url>
   cd AgentBoss
   ```

2. **Install root dependencies**:
   ```bash
   npm install
   ```

3. **Install frontend dependencies**:
   ```bash
   cd Dapp
   npm install
   cd ..
   ```

---

## 3. Configuration Setup

Create a `.env` file in the project root (or modify the existing one) and fill in the following key configurations:

```env
# Sui Network Configuration
SUI_RPC_URL=https://fullnode.devnet.sui.io:443

# Contract Related IDs (Devnet)
PACKAGE_ID=0x7276711e3b2785f1a30e4d6093fe7b1eda96084ce0916592f1babe25bf5cd3d6
ARENA_ID=0xef81cf34c567fefacfd2016c3ba05bb7b2a72193ffa25f48dbb60e0b1041c684
RANDOM_STATE_ID=0x8
CLOCK_ID=0x6

# Admin Secret Key (Used for Boss initialization or management operations)
ADMIN_SECRET_KEY=Your_Admin_Secret_Key_Base64

# Volcengine AI Configuration
VOLC_API_KEY=Your_Volcengine_API_Key
VOLC_API_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions
# Inference Endpoint ID
VOLC_ENDPOINT_ID=ep-**********-d65xq

# MCP Server Configuration
MCP_SERVER_URL=http://127.0.0.1:3001
```

---

## 4. Startup Steps

To run the project properly, start the four core components in the following order:

### Step 1: Start MCP Relay Server (Required)
The MCP server is responsible for actual interaction between Agents and the Sui chain, and manages the Agents' local wallets.
```bash
# Run in Terminal 1
node src/strategies/mcp_server.js
```

### Step 2: Start Boss Respawn Oracle
The Oracle listens for Boss death events and automatically creates a new Boss with the same attributes after 5 minutes (30 seconds in test mode) to ensure there is always a target to fight.
```bash
# Run in Terminal 2
node src/services/RespawnOracle.js
```

### Step 3: Start Frontend Visualization (Optional)
Used to visually check the battlefield status, Boss health, and Agent dynamics.
```bash
# Run in Terminal 3
cd Dapp
npm run dev
```

### Step 4: Start AI Agent Strategy Scripts
You can start one or more Agents with different personas simultaneously.
```bash
# Run in Terminal 4: Reckless Warrior (Aggressive)
node src/strategies/Strategy_Aggressive.js

# Run in Terminal 5: Cunning Mage (Cunning)
node src/strategies/Strategy_Cunning.js

# Run in Terminal 6: Steady Ranger (Steady)
node src/strategies/Strategy_Steady.js
```

---

## 5. Core Logic Description

- **MCP Server**: Listens on port `3001`, providing core tools like `register_agent`, `attack_boss`, `list_events`, etc.
- **Respawn Oracle**: The "referee" and "respawner" of the arena, ensuring the game loop continues by auto-respawning Bosses.
- **BaseAgent**: The base class for all Agents, encapsulating LLM thinking logic (`think`), event listening logic, and MCP call logic.
- **Event-Driven**: Agents monitor `CombatEvent` on-chain in real-time. Once an attack occurs, Agents are immediately awakened to enter an AI decision cycle.
- **Auto-Withdrawal**: Agents will automatically withdraw earnings to a specified cold wallet address when the balance exceeds a threshold, based on configurations in `.env` or scripts.

---

## 6. FAQ

- **Q: Starting Agent results in ECONNREFUSED error?**
  - **A**: Ensure that `mcp_server.js` is successfully running on port 3001.
- **Q: AI thinking keeps failing?**
  - **A**: Check if `VOLC_API_KEY` in `.env` is valid and if `VOLC_ENDPOINT_ID` is filled correctly.
- **Q: Agents are not reacting?**
  - **A**: Agents use an event-driven mode. If there is no attack activity on-chain, they enter a "heartbeat" mode (thinking every 15-25 seconds). You can try manually initiating an attack from the frontend to wake them up.

---
