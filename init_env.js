const { execSync } = require('child_process');
const fs = require('fs');

/**
 * SUI 本地环境初始化脚本
 * 负责配置本地网络、部署合约并更新项目配置
 */
async function initSuiEnvironment() {
    console.log("🚀 开始初始化 SUI 本地开发环境...");

    try {
        // 1. 检查 SUI 是否安装
        execSync('sui --version');
        console.log("✅ 检测到 SUI 二进制工具已安装");

        // 2. 配置本地网络环境
        console.log("📡 正在配置本地网络 (localnet)...");
        try {
            execSync('sui client new-env --alias localnet --rpc http://127.0.0.1:9000');
        } catch (e) {
            console.log("ℹ️ 本地环境配置已存在，跳过创建");
        }
        execSync('sui client switch --env localnet');

        // 3. 部署合约
        console.log("📦 正在编译并部署 Boss Battle 合约到本地网络...");
        const deployOutput = execSync('sui client publish --gas-budget 100000000 --json', {
            cwd: './contract/boss_battle'
        }).toString();
        
        const deployData = JSON.parse(deployOutput);
        const packageId = deployData.objectChanges.find(c => c.type === 'published').packageId;
        const bossObj = deployData.objectChanges.find(c => c.objectType && c.objectType.includes('::Boss'));
        const adminCap = deployData.objectChanges.find(c => c.objectType && c.objectType.includes('::AdminCap'));

        console.log(`\n🎉 合约部署成功!`);
        console.log(`- Package ID: ${packageId}`);
        if (bossObj) console.log(`- Boss Object ID: ${bossObj.objectId}`);
        
        // 4. 自动更新 mcp_server.js 中的配置
        updateMcpConfig(packageId, bossObj ? bossObj.objectId : "PENDING_CREATE");

    } catch (error) {
        console.error("❌ 初始化失败，请确保已运行 'sui start' 启动本地节点。");
        console.error(error.message);
    }
}

function updateMcpConfig(packageId, bossId) {
    let mcpContent = fs.readFileSync('./mcp_server.js', 'utf8');
    // 替换本地连接地址和合约 ID
    mcpContent = mcpContent.replace(/getFullnodeUrl\('testnet'\)/g, "'http://127.0.0.1:9000'");
    mcpContent = mcpContent.replace(/0x_real_boss_object_id/g, bossId);
    
    fs.writeFileSync('./mcp_server.js', mcpContent);
    console.log("📝 已自动更新 mcp_server.js 配置以适配本地网络。");
}

initSuiEnvironment();
