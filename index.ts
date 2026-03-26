import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BEAT = process.env.AIBTC_BEAT || 'web3-gaming-infra';

let mcp: Client;

// ─── Helper: extract text from MCP tool response ─────────────────
function extractText(result: any): string {
    if (result?.content?.[0]?.text) return result.content[0].text;
    if (result?.content?.[0]) return JSON.stringify(result.content[0]);
    return JSON.stringify(result);
}

// ─── MCP Connection ──────────────────────────────────────────────
// The CLIENT_MNEMONIC env var is passed to the MCP server process.
// This means the server auto-loads the wallet — no unlock needed.
async function connectMcp() {
    console.log("Starting MCP connection...");
    const transport = new StdioClientTransport({
        command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
        args: ['-y', '@aibtc/mcp-server@latest'],
        env: {
            ...process.env,
            NETWORK: 'mainnet',
            CLIENT_MNEMONIC: process.env.CLIENT_MNEMONIC || ''
        }
    });
    mcp = new Client({ name: "aibtc-news-worker", version: "1.0" }, { capabilities: {} });
    await mcp.connect(transport);
    console.log("MCP Connected.");
}

// ─── Get Wallet Info ─────────────────────────────────────────────
async function getWalletAddress(): Promise<string> {
    const result = await mcp.callTool({ name: "get_wallet_info", arguments: {} });
    const raw = extractText(result);
    console.log("Wallet info:", raw.substring(0, 200));

    // Try to find bc1q address via regex (most reliable)
    const match = raw.match(/bc1q[a-zA-Z0-9]{38,}/);
    if (match) return match[0];

    // Try JSON parsing as fallback
    try {
        const info = JSON.parse(raw);
        return info.btc_address || info.btcAddress || info.segwit || "";
    } catch {
        return "";
    }
}

// ─── Heartbeat ───────────────────────────────────────────────────
async function heartbeat() {
    try {
        const timestamp = new Date().toISOString();
        const msg = `AIBTC Check-In | ${timestamp}`;

        const signResult = await mcp.callTool({
            name: "btc_sign_message",
            arguments: { message: msg }
        });
        const signRaw = extractText(signResult);

        // Check if sign returned an error string
        if (signRaw.startsWith("Error:")) {
            console.error("Signing failed:", signRaw);
            return;
        }

        const parsed = JSON.parse(signRaw);
        const btcAddress = await getWalletAddress();

        console.log("Sending heartbeat...");
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
        console.log("Fetching news...");

        // Use the correct tool: news_front_page
        let newsText = "";
        try {
            const briefResult = await mcp.callTool({
                name: "news_front_page",
                arguments: {}
            });
            newsText = extractText(briefResult);
        } catch {
            newsText = "Latest BTC, Stacks, and Web3 gaming developments";
        }

        console.log("Asking Claude to format signal...");
        const msg = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 500,
            temperature: 0,
            system: "Output only raw JSON without code blocks.",
            messages: [{
                role: "user",
                content: `Analyze this news and return JSON with:
- "headline": Punchy headline (max 120 chars)
- "body": 2-3 sentence analysis (max 1000 chars)
- "tags": Array of 1-5 lowercase slugs like ["bitcoin", "defi"]
- "sources": Array of 1-3 objects like [{"url": "https://aibtc.com", "title": "AIBTC Brief"}]

News: ${newsText.substring(0, 2000)}`
            }]
        });

        const responseText = (msg.content[0] as any).text;
        const signalData = JSON.parse(responseText);

        console.log("Generated:", signalData.headline);

        // Ensure sources are objects with url+title
        const sources = (signalData.sources || []).map((s: any) => {
            if (typeof s === 'string') return { url: s, title: "Source" };
            return { url: s.url || "https://aibtc.com", title: s.title || "Source" };
        });
        if (sources.length === 0) {
            sources.push({ url: "https://aibtc.com", title: "AIBTC Intelligence Brief" });
        }

        // Ensure tags
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

        const fileText = extractText(fileResult);
        if (fileText.startsWith("Error:")) {
            console.error("Signal filing failed:", fileText);
        } else {
            console.log("✅ Signal Filed:", fileText.substring(0, 200));
        }

    } catch (e) {
        console.error("Error filing signal:", e);
    }
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
    console.log("🚀 Booting AIBTC News Worker...");

    await connectMcp();

    // Wait for MCP server to fully initialize
    await new Promise(r => setTimeout(r, 2000));

    // Verify wallet is loaded via CLIENT_MNEMONIC
    const addr = await getWalletAddress();
    if (!addr) {
        console.error("❌ FATAL: No wallet loaded. Set CLIENT_MNEMONIC env var on Railway.");
        process.exit(1);
    }
    console.log("✅ Wallet active:", addr);

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

    // Initial runs
    await heartbeat();
    await fetchNewsAndFileSignal();

    console.log("⏱️ Worker active. Heartbeat: 5m, News Signal: 4h.");
    setInterval(heartbeat, 5 * 60 * 1000);
    setInterval(fetchNewsAndFileSignal, 4 * 60 * 60 * 1000);
}

main().catch(e => {
    console.error("FATAL:", e);
    process.exit(1);
});
