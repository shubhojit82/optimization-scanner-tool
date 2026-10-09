# Collect the first real observation

1. Keep your existing client and audit; select that client in the workspace.
2. Add these lines to the **existing** project-root `.env`:

   ```dotenv
   OPENAI_API_KEY=your_api_key
   GEO_OPENAI_MODEL=gpt-4.1
   ```

   Obtain a project API key through https://platform.openai.com/api-keys and enable API billing as needed. Keep the key in `.env`, which Git ignores. Never paste it into the browser or chat. `.env.example` contains empty values only.
3. Stop the running app with Control-C. Run `npm run dev` and reload http://localhost:5173.
4. Click **Review observations** or **Observations**. The provider should show **Configured**. This means a key was loaded, not that its validity or quota has already been verified.
5. Choose one relevant question from the query universe, or edit the question. Click **Run query & save**. This sends the question and client market to the selected provider and incurs API usage. It does not send imported HTML or automatically inject the client brand into the question.
6. Expand the saved observation. Check the complete answer, clickable inline citations, source links, exact returned model and collection time. Then check Overview for sample mention/citation rates.

**Query universe → Run query** also opens the collector with that question selected. JSON imports remain available for evidence collected from other providers or consumer experiences.

## What the result means

This adapter records the Responses API with web search, not the consumer ChatGPT interface. Those surfaces can return different answers. A missing client mention is valid evidence when a complete answer is collected. A failed request is not evidence of zero visibility and is never added to the denominator. Mention matching uses the current client brand name and explicit aliases. Correct these with **Edit client**; saved response text stays unchanged. Rates currently combine the latest 200 observations across surfaces/models; use the retained metadata to interpret the sample. Repeat runs are separate samples.

The adapter requests web search explicitly, caps output at 2,048 tokens, times out at 60 seconds, and stores the provider response ID. Only HTTP(S) citation URLs without credentials are accepted. No automatic retry is performed. API costs include model usage and search tool usage; there is no account-level currency budget in this version. Configure provider-side spend limits and start with one question.

## Failure handling and limitations

- **Setup required:** add a server key and restart; entering a key in `.env` does not update an already-running process.
- **Rejected key:** replace the key on the server and restart.
- **Quota/rate limit:** check your provider account and usage before trying again.
- **Rejected request:** verify `GEO_OPENAI_MODEL` supports Responses API web search.
- **Connection timeout:** no observation is saved, but the upstream request may still be billable. Check provider usage before retrying.
- **Saved but refresh failed:** reload the page. The observation is already stored; do not rerun solely to refresh it.

At most two requests run concurrently per server process. Requests use a client-generated UUID; completed request replays return the saved observation without another provider call. The browser retains the ID while the same attempt is unresolved, but a reload loses it. Crash/timeout recovery across replicas requires a durable queue, leases and reconciliation; this release is a single-process local/VM increment, not a scheduled multi-provider campaign system.

## Adding another provider

Implement `AIProvider.observe(prompt, market)` in a separate adapter. Return normalized answer/citation/model/time evidence. Register the adapter and its public `ProviderInfo` in `src/server/node-server.ts`. Keep all credentials and transport parsing inside the server adapter. The application runner, scoring and SQLite storage need no vendor-specific branch.

Official integration reference: https://developers.openai.com/api/docs/guides/tools-web-search
