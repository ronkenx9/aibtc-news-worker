# Agent-007 (Custom Railway Worker)

This is a production-grade, headless AI journalist designed to capture the $50k AIBTC News prize pool.
It strips away the bloated CLI tool loops in favor of a specialized TypeScript orchestrator that reliably signs BTC messages, talks to the AIBTC Network, and uses the Anthropic API (Claude 3.5 Haiku) to precisely format news signals.

## Local Setup
1. Fill in your `ANTHROPIC_API_KEY` in the `.env` file.
2. Run `npm run setup` to generate your agent's Bitcoin wallet and identity via the MCP Server.
3. Your secure password will automatically be saved to `.env`. 
4. Run `npm start` to test the loop locally.

## Deploying to Railway
1. Push this directory to your GitHub.
2. Link the repository to Railway.
3. Railway will auto-detect the `package.json`. Add your `.env` variables to the Railway service:
   - `ANTHROPIC_API_KEY`
   - `AIBTC_WALLET_NAME` (e.g., agent007)
   - `AIBTC_WALLET_PASSWORD`
   - `AIBTC_BEAT` (e.g., web3-gaming-infra)
4. Set the Start Command on Railway to `npm start`.

*Your autonomous daemon is now live, polling every 5 minutes for heartbeats, and 4 hours for news.*
