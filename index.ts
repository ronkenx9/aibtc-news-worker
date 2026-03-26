import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const WALLET_NAME = process.env.AIBTC_WALLET_NAME || 'agent007';
const WALLET_PASS = process.env.AIBTC_WALLET_PASSWORD || '';
const BEAT = process.env.AIBTC_BEAT || 'web3-gaming-infra';

let mcp: Client;
let btcAddress = "";

// ─── MCP Connection ──────────────────────────────────────────────
async function connectMcp() {
    console.log("Starting MCP connection...");
    const transport = new StdioClientTransport({
        command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
        args: ['-y', '@aibtc/mcp-server@latest'],
        env: { ...process.env, NETWORK: 'mainnet' }
    });
    mcp = new Client({ name: "aibtc-news-worker", version: "1.0" }, { capabilities: {} });
    await mcp.connect(transport);
    console.log("MCP Connected.");
}

// ─── Helper: extract text from MCP tool response ─────────────────
function extractText(result: any): string {
    if (result?.content?.[0]?.text) return result.content[0].text;
    if (result?.content?.[0]) return JSON.stringify(result.content[0]);
    return JSON.stringify(result);
}

// ─── Wallet Unlock (with state-sync wait) ────────────────────────
async function unlockWallet(): Promise<void> {
    console.log("Unlocking wallet...");
    const result = await mcp.callTool({
        name: "wallet_unlock",
        arguments: { name: WALLET_NAME, password: WALLET_PASS }
    });
    console.log("Unlock response:", extractText(result));
    // Critical: Wait for the MCP server's internal state to sync
    await new Promise(r => setTimeout(r, 3000));
}

// ─── Cache BTC Address ───────────────────────────────────────────
async function cacheBtcAddress(): Promise<void> {
    const result = await mcp.callTool({
        name: "get_wallet_info",
        arguments: {}
    });
    const raw = extractText(result);
    console.log("Wallet info raw:", raw);

    // Try to parse JSON and find the address
    try {
        const info = JSON.parse(raw);
        // Try multiple possible field names
        btcAddress = info.btc_address || info.btcAddress || info.segwit || info["Native SegWit"] || "";

        // If still empty, search for bc1q pattern in the raw string
        if (!btcAddress) {
            const match = raw.match(/bc1q[a-zA-Z0-9]{38,}/);
            if (match) btcAddress = match[0];
        }
    } catch {
        // If not JSON, try regex on raw text
        const match = raw.match(/bc1q[a-zA-Z0-9]{38,}/);
        if (match) btcAddress = match[0];
    }

    console.log("BTC Address:", btcAddress || "⚠️ NOT FOUND");
}

// ─── Heartbeat ───────────────────────────────────────────────────
async function heartbeat() {
    try {
        // Always unlock before signing
        await unlockWallet();

        const timestamp = new Date().toISOString();
        const msg = `AIBTC Check-In | ${timestamp}`;

        const signResult = await mcp.callTool({
            name: "btc_sign_message",
            arguments: { message: msg }
        });
        const signRaw = extractText(signResult);
        console.log("Sign result:", signRaw);

        // Check if sign returned an error string
        if (signRaw.startsWith("Error:")) {
            console.error("Signing failed:", signRaw);
            return;
        }

        const parsed = JSON.parse(signRaw);

        console.log("Sending heartbeat to AIBTC...");
        const res = await fetch("https://aibtc.com/api/heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                address: btcAddress,
                message: msg,
                signature: parsed.signature,
            }),
        });
        console.log("✅ Heartbeat sent:", res.status);
    } catch (e) {
        console.error("Heartbeat error:", e);
    }
}

// ─── Fetch News & File Signal ────────────────────────────────────
async function fetchNewsAndFileSignal() {
    try {
        console.log("Fetching news for analysis...");

        // Get latest news from the AIBTC brief
        let newsText = "";
        try {
            const briefResult = await mcp.callTool({
                name: "news_get_brief",
                arguments: {}
            });
            newsText = extractText(briefResult);
        } catch {
            newsText = "Latest BTC and Web3 gaming developments";
        }

        console.log("Asking Claude 3 Haiku to format signal...");
        const msg = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 500,
            temperature: 0,
            system: "Output only raw JSON without code blocks.",
            messages: [{
                role: "user",
                content: `Analyze this news data and return a JSON object with:
- "headline": A punchy headline (max 120 chars)
- "body": A 2-3 sentence technical analysis (max 1000 chars)
- "tags": Array of 1-5 lowercase tag slugs like ["bitcoin", "defi", "gaming"]
- "sources": Array of 1-3 objects like [{"url": "https://example.com", "title": "Article Title"}]

If you don't have real source URLs, use: [{"url": "https://aibtc.com", "title": "AIBTC Intelligence Brief"}]

News Data: ${newsText}`
            }]
        });

        const responseText = (msg.content[0] as any).text;
        const signalData = JSON.parse(responseText);

        console.log("Generated:", signalData.headline);

        // Ensure sources are objects with url+title (required by Zod)
        const sources = (signalData.sources || []).map((s: any) => {
            if (typeof s === 'string') return { url: s, title: "Source" };
            return { url: s.url || "https://aibtc.com", title: s.title || "Source" };
        });
        if (sources.length === 0) {
            sources.push({ url: "https://aibtc.com", title: "AIBTC Intelligence Brief" });
        }

        // Ensure tags are strings with >= 1 item
        const tags = signalData.tags || ["bitcoin", "alpha"];
        if (tags.length === 0) tags.push("bitcoin");

        const fileResult = await mcp.callTool({
            name: "news_file_signal",
            arguments: {
                beat_slug: BEAT,
                headline: signalData.headline,
                body: signalData.body || "",
                sources: sources,
                tags: tags,
                disclosure: "claude-3-haiku-20240307, custom-typescript-worker"
            }
        });
        console.log("✅ Signal Filed:", extractText(fileResult));

    } catch (e) {
        console.error("Error filing signal:", e);
    }
}

// ─── Main Boot Sequence ──────────────────────────────────────────
async function main() {
    console.log("🚀 Booting AIBTC News Worker...");

    await connectMcp();

    // Wait for MCP server to fully initialize
    await new Promise(r => setTimeout(r, 2000));

    // Unlock and cache address
    await unlockWallet();
    await cacheBtcAddress();

    // Claim beat
    try {
        console.log(`Claiming beat: ${BEAT}...`);
        await mcp.callTool({
            name: "news_claim_beat",
            arguments: {
                slug: BEAT,
                name: "Web3 Gaming & Infrastructure",
                description: "Alpha on Agentic Infrastructure and Web3 Gaming"
            }
        });
        console.log("Beat claimed.");
    } catch (e) {
        console.log("Beat claim note:", e);
    }

    // Initial heartbeat
    await heartbeat();

    // Initial signal
    await fetchNewsAndFileSignal();

    console.log("⏱️ Worker is now actively polling. Heartbeat: 5m, News Signal: 4h.");
    setInterval(heartbeat, 5 * 60 * 1000);
    setInterval(fetchNewsAndFileSignal, 4 * 60 * 60 * 1000);
}

main().catch(e => {
    console.error("FATAL:", e);
    process.exit(1);
});
