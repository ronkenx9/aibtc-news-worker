/**
 * AIBTC MCP Full Diagnostic Script
 * 
 * This script connects to the AIBTC MCP server and:
 * 1. Lists ALL available tools with their full input schemas
 * 2. Tests wallet_unlock and checks if state persists
 * 3. Tests get_wallet_info and logs the full raw response
 * 4. Tests btc_sign_message to see if unlock actually persists
 * 5. Logs the exact schema for news_file_signal
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import 'dotenv/config';

const WALLET_NAME = process.env.AIBTC_WALLET_NAME || 'agent007';
const WALLET_PASS = process.env.AIBTC_WALLET_PASSWORD || '';

async function main() {
    console.log("=== AIBTC MCP FULL DIAGNOSTIC ===\n");

    // Step 1: Connect
    console.log("--- STEP 1: Connecting to MCP Server ---");
    const transport = new StdioClientTransport({
        command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
        args: ['-y', '@aibtc/mcp-server@latest'],
        env: { ...process.env, NETWORK: 'mainnet' }
    });
    const client = new Client({ name: "diagnostic", version: "1.0" }, { capabilities: {} });
    await client.connect(transport);
    console.log("✅ Connected.\n");

    // Step 2: List ALL tools with full schemas
    console.log("--- STEP 2: Listing ALL available tools ---");
    const toolsResult = await client.listTools();
    console.log(`Found ${toolsResult.tools.length} tools:\n`);

    for (const tool of toolsResult.tools) {
        console.log(`📦 ${tool.name}`);
        console.log(`   Description: ${tool.description?.substring(0, 100)}...`);
        console.log(`   Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`);
        console.log("");
    }

    // Step 3: Test wallet_unlock
    console.log("\n--- STEP 3: Testing wallet_unlock ---");
    console.log(`Using wallet: ${WALLET_NAME}, password: ${WALLET_PASS ? '[SET]' : '[EMPTY!]'}`);
    try {
        const unlockResult = await client.callTool({
            name: "wallet_unlock",
            arguments: { name: WALLET_NAME, password: WALLET_PASS }
        });
        console.log("RAW UNLOCK RESPONSE:");
        console.log(JSON.stringify(unlockResult, null, 2));
    } catch (e: any) {
        console.error("UNLOCK FAILED:", e.message);
    }

    // Step 4: Immediately test get_wallet_info
    console.log("\n--- STEP 4: Testing get_wallet_info (immediately after unlock) ---");
    try {
        const infoResult = await client.callTool({
            name: "get_wallet_info",
            arguments: {}
        });
        console.log("RAW WALLET_INFO RESPONSE:");
        console.log(JSON.stringify(infoResult, null, 2));
    } catch (e: any) {
        console.error("WALLET_INFO FAILED:", e.message);
    }

    // Step 5: Test btc_sign_message (immediately after unlock)
    console.log("\n--- STEP 5: Testing btc_sign_message (immediately after unlock) ---");
    try {
        const signResult = await client.callTool({
            name: "btc_sign_message",
            arguments: { message: "diagnostic-test" }
        });
        console.log("RAW SIGN RESPONSE:");
        console.log(JSON.stringify(signResult, null, 2));
    } catch (e: any) {
        console.error("SIGN FAILED:", e.message);
    }

    // Step 6: Specifically print news_file_signal schema
    console.log("\n--- STEP 6: news_file_signal Schema Detail ---");
    const newsTool = toolsResult.tools.find(t => t.name === 'news_file_signal');
    if (newsTool) {
        console.log("FULL SCHEMA:");
        console.log(JSON.stringify(newsTool.inputSchema, null, 2));
    } else {
        console.log("⚠️ news_file_signal tool NOT FOUND in tool list!");
        console.log("Available news-related tools:");
        toolsResult.tools
            .filter(t => t.name.includes('news'))
            .forEach(t => console.log(`  - ${t.name}`));
    }

    // Step 7: Print news_claim_beat schema too
    console.log("\n--- STEP 7: news_claim_beat Schema Detail ---");
    const beatTool = toolsResult.tools.find(t => t.name === 'news_claim_beat');
    if (beatTool) {
        console.log("FULL SCHEMA:");
        console.log(JSON.stringify(beatTool.inputSchema, null, 2));
    } else {
        console.log("⚠️ news_claim_beat tool NOT FOUND!");
    }

    console.log("\n=== DIAGNOSTIC COMPLETE ===");
    process.exit(0);
}

main().catch(e => {
    console.error("FATAL:", e);
    process.exit(1);
});
