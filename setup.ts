import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs/promises';

async function run() {
    const transport = new StdioClientTransport({
        command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
        args: ['-y', '@aibtc/mcp-server@latest'],
        env: { ...process.env, NETWORK: 'mainnet' }
    });

    const client = new Client({ name: "setup-script", version: "1.0.0" }, { capabilities: {} });

    console.log("Connecting to AIBTC MCP Server...");
    await client.connect(transport);
    console.log("Connected.");
    console.log("Generating wallet 'agent007'...");

    try {
        const result = await client.callTool({
            name: "wallet_create",
            arguments: {
                name: "agent007",
                password: "PulseAgent007Secure"
            }
        });

        console.log("\n✅ Wallet created successfully!");
        console.log(JSON.stringify(result, null, 2));

        const envContent = `AIBTC_WALLET_NAME=agent007
AIBTC_WALLET_PASSWORD=PulseAgent007Secure
ANTHROPIC_API_KEY=your_claude_api_key_here
AIBTC_BEAT=web3-gaming-infra
`;
        await fs.writeFile('.env', envContent);
        console.log("\n✅ Saved credentials template to .env file.");
        console.log("Please update your ANTHROPIC_API_KEY in the .env file before running the agent.");

    } catch (error) {
        console.error("Error creating wallet. Wait, is it already created? Trying to unlock instead...");
        try {
            const unlockResult = await client.callTool({
                name: "wallet_unlock",
                arguments: {
                    name: "agent007",
                    password: "PulseAgent007Secure"
                }
            });
            console.log("Unlocked successfully", unlockResult);
        } catch (unlockError) {
            console.error(unlockError);
        }
    } finally {
        process.exit(0);
    }
}

run().catch(console.error);
