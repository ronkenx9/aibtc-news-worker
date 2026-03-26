import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});

async function main() {
    console.log("Checking available models for your API key...");
    try {
        // We can't 'list' models directly in the current SDK without a dedicated endpoint 
        // frequently available to all, but we can test common ones.
        const models = [
            "claude-3-5-sonnet-20241022",
            "claude-3-5-sonnet-20240620",
            "claude-3-sonnet-20240229",
            "claude-3-5-haiku-20241022",
            "claude-3-haiku-20240307"
        ];

        for (const model of models) {
            try {
                await anthropic.messages.create({
                    model: model,
                    max_tokens: 1,
                    messages: [{ role: "user", content: "hi" }]
                });
                console.log(`✅ ${model}: AVAILABLE`);
            } catch (e: any) {
                console.log(`❌ ${model}: FAILED (${e.status} - ${e.message})`);
            }
        }
    } catch (e) {
        console.error("Error during model check:", e);
    }
}

main();
