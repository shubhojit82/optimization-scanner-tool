# AGENTS.md — Ask mode

This file provides guidance to agents when working with code in this repository.

## Non-obvious documentation context

- **`app/` serves two purposes**: Next.js route handlers (`app/api/v1/`) for cloud/ChatGPT deployment, AND the shared React UI (`app/workbench-ui.tsx`) that is also the Vite SPA entry point.
- **`frontend/` is just two files** (`index.html`, `main.tsx`). All real UI logic is in `app/workbench-ui.tsx`.
- **`pnpm-workspace.yaml` is NOT a monorepo config** — it is a Sites-platform policy file. The project uses `npm`.
- **Four AI providers are fully implemented** in `src/server/providers/`: OpenAI, Gemini, Claude, Perplexity. Each is enabled solely by the presence of its API key in `.env`.
- **OpenAI uses the Responses API** (`/v1/responses`), not Chat Completions — this is non-standard and the model must support web search tools.
- **`src/adapters/d1-repository.ts`** imports `cloudflare:workers` — it cannot be tested or run outside a Cloudflare Workers environment.
- **`RUBRIC_VERSION = 'readiness-cues/1.1.0'`** in `src/core/scoring.ts`. It is embedded in every saved audit record.
- **`probe-run` and `custom-prompts`** are stored in the `records` table (not separate tables) using `kind` as a discriminator.
- **`GEO_VIEWER_PASSWORD`** enables a read-only tier — viewers can GET but cannot POST or DELETE.
- **`drizzle/` and `drizzle.config.ts`** exist but are not used by any active code path — unused scaffolding.
- **`src/server/scan-cache.ts`** is a 5-min TTL, 50-entry LRU cache for scan and competitor results. It lives only in-process; restarts clear it.
- **`Scheduler`** in `src/server/scheduler.ts` runs probe schedules automatically on server start — it uses `setInterval` polling, not cron.
- **All `app/*.tsx` panel files are typechecked transitively** through `app/workbench-ui.tsx` (the only explicit include in `tsconfig.client.json`). Adding a new panel only requires importing it from `workbench-ui.tsx` — not editing `tsconfig.client.json`.
- **`app/overview-charts.tsx`** contains all SVG chart components (`DonutChart`, `DimBar`, `MiniRing`, `OverviewCharts`). There is no charting library — charts are hand-coded SVG.
- **`vite.config.ts` is the cloud/Sites build config** (uses `@cloudflare/vite-plugin`, `vinext`, Wrangler). The portable Vite build uses `vite.portable.config.ts` instead.
