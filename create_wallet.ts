/**
 * Create a new wallet and capture the mnemonic phrase.
 * The mnemonic must be added to Railway as CLIENT_MNEMONIC.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import 'dotenv/config';

async function main() {
    console.log("=== Creating New Wallet ===\n");

    const transport = new StdioClientTransport({
        command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
        args: ['-y', '@aibtc/mcp-server@latest'],
        env: { ...process.env, NETWORK: 'mainnet' }
    });
    const client = new Client({ name: "wallet-setup", version: "1.0" }, { capabilities: {} });
    await client.connect(transport);
    console.log("Connected to MCP.\n");

    // Create wallet
    console.log("Creating wallet 'agent007'...");
    const createResult = await client.callTool({
        name: "wallet_create",
        arguments: { name: "agent007", password: "PulseAgent007Secure" }
    });

    // Print the FULL raw response so we can see the mnemonic
    const text = (createResult as any).content?.[0]?.text || JSON.stringify(createResult);
    console.log("\n=== WALLET CREATED - FULL RESPONSE ===");
    console.log(text);
    console.log("\n=== SAVE THE MNEMONIC ABOVE! ===");

    // Now list tools to find correct news tool names
    console.log("\n--- Available news tools ---");
    const tools = await client.listTools();
    tools.tools
        .filter(t => t.name.includes('news') || t.name.includes('brief'))
        .forEach(t => console.log(`  ${t.name}: ${t.description?.substring(0, 80)}`));

    process.exit(0);
}

main().catch(e => { console.error("Error:", e); process.exit(1); });
