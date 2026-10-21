# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack

- **Node.js 24 required** — uses built-in `node:sqlite` `DatabaseSync`, `--env-file-if-exists`, and `crypto.subtle` directly
- **Dual runtime**: portable (Node + SQLite) and cloud (Next.js + Cloudflare D1) share the same domain core
- **Package manager**: `npm` (`pnpm-workspace.yaml` is a Sites-platform policy file, not a monorepo config)

## Commands

```bash
npm run dev       # builds server-only, then starts API :8080 + Vite dev :5173
npm run build     # tsc + vite → dist/server/ + dist/client/
npm run test      # builds portable, then runs all 4 test files
npm run typecheck # tsc --noEmit on both tsconfig.client.json and tsconfig.server.json
```

### Running a single test

Tests use **Node's built-in test runner** (`node:test`), not Jest/Vitest:
```bash
node --test tests/core.test.mjs         # pure domain scoring tests (requires .sites-runtime/ from a prior run or build)
node --test tests/identity.test.mjs     # client identity/brand alias tests
node --test tests/observations.test.mjs # observation collection tests
node --test tests/portable.test.mjs     # full HTTP integration (requires dist/server/ — run build first)
```

## Architecture

```
src/core/          ← zero-dependency domain (contracts, scoring, demo, brand-matching, report-analysis)
src/application/   ← Workbench, ProbeRunner, ObservationRunner, Scanner, ContentBrief, SmartPrompts
src/adapters/      ← Zod validation schemas, D1Repository, http.ts (Cloudflare/Next.js handler)
src/server/        ← SqliteRepository, node-server.ts, AI providers, crawlers, exporters, Scheduler
app/api/v1/        ← Next.js route handlers (cloud) — thin wrappers around src/adapters/http.ts
frontend/          ← Vite entry (main.tsx → app/workbench-ui.tsx)
```

## Frontend — UI Conventions

- **TSX string literals must use straight quotes only** — curly/typographic apostrophes cause the Vite oxc parser to error. This applies to all `app/*.tsx` files.
- **`tsconfig.client.json` entry is `app/workbench-ui.tsx` only**, but all panel files are imported from it so `npm run typecheck` catches them all transitively.
- **Empty state pattern**: every panel with no data renders a gradient card (`linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)`), SVG illustration left, 3–4 feature-explainer tiles right. See `CompetitorEmptyState` in `app/competitor-panel.tsx` for the canonical shape.
- **Inline focus ring**: inputs/selects use `onFocus`/`onBlur` handlers to swap `borderColor` between `#4f6ef7` (focus) and `#e4e6ef` (blur). CSS `:focus` pseudo-class is not used — all styles are inline.
- **Custom select chevron**: selects use `appearance:'none'` + inline SVG chevron background. See `selectStyle()` in `app/alerts-panel.tsx` for the canonical implementation.
- **Design tokens**: colours/radii/shadows are CSS custom properties in `app/globals.css` (`--interactive:#4f6ef7`, `--border-subtle:#e4e6ef`, `--card-radius:10px`). Match them in inline styles where CSS vars are unreachable.
- **`lucide-react` is pinned at `1.31.0`** — do not bump; icon names changed in later releases.
- **Chart components** (`MiniRing`, `OverviewCharts`, `DonutChart`, `DimBar`) live in `app/overview-charts.tsx` — SVG only, no chart library dependency.

## AI Providers

Providers are configured entirely via `.env` — presence of the key enables the provider:

| Provider    | Key env var            | Model env var         | Default model               |
|-------------|------------------------|-----------------------|-----------------------------|
| OpenAI      | `OPENAI_API_KEY`       | `GEO_OPENAI_MODEL`    | `gpt-4o-mini`               |
| Gemini      | `GEMINI_API_KEY`       | `GEO_GEMINI_MODEL`    | `gemini-3.8-flash`          |
| Claude      | `ANTHROPIC_API_KEY`    | `GEO_CLAUDE_MODEL`    | `claude-opus-4-5-20251101`  |
| Perplexity  | `PERPLEXITY_API_KEY`   | `GEO_PERPLEXITY_MODEL`| `sonar`                     |

OpenAI uses the **Responses API** (`/v1/responses`) with `tools: [{type: 'web_search'}]`, not Chat Completions. The model must support this endpoint (e.g. `gpt-4.1`, `gpt-4o`).

## Critical Patterns

- **Never add `.js` extensions to TypeScript `import` paths** — `scripts/build-portable.mjs` rewrites them post-`tsc`
- **`src/core/` must stay dependency-free** — no zod, no node builtins, no react, no adapters
- **`CollectionError`** (in `src/core/contracts.ts`) is the only error type that maps to non-500 HTTP responses from providers — throw it for 4xx/502 provider failures
- **`owner` = auth identity** scopes every repository call. In portable mode it is the admin username; in cloud mode it is `oai-authenticated-user-id`
- **`audit` deduplication**: `Workbench.audit()` skips saving if an identical `hash+url` already exists for the client
- **`saveRecords` is transactional** — both SQLite (`BEGIN IMMEDIATE`/`ROLLBACK`) and D1 (`.batch()`) enforce atomicity
- **`listRecords` is hard-capped at 200 rows** (last 200 by `created DESC`); `listProbeRuns` defaults to 20
- **`SqliteRepository`** implements `Repository`, `ObservationLookup`, and `ClientIdentityStore` — it is not just the `Repository` interface
- **`components/ui/`** is vendored verbatim from shadcn@4.17.0 — do not edit; ESLint rules suppressed for it
- **Scan/competitor results are cached** in `ScanCache` (5-min TTL, 50-entry LRU) in `node-server.ts` — avoid duplicate HTTP fetches within the same server process
- **`RUBRIC_VERSION`** is now `'readiness-cues/1.1.0'`. Changing it invalidates existing audit version strings.
- **`probe-run` records** are stored in the `records` table with `kind='probe-run'` (not a separate table)
- **Custom prompts** are stored as `kind='custom-prompts'` in the `records` table; only the latest row per client is kept (replaced on save)

## Environment

- `.env` loaded via `--env-file-if-exists` (Node 24 flag) — no `dotenv` package
- `GEO_AUTH_MODE=local` (default, loopback-only). `basic` requires `GEO_ADMIN_PASSWORD` ≥ 16 chars, not containing `REPLACE_`
- `GEO_VIEWER_PASSWORD` enables a read-only access tier (basic mode only, must differ from admin password)
- `GEO_USE_BROWSER=true` activates `BrowserCrawler` instead of `NodeCrawler`
- Dev API port is always `8080`; Vite dev port is always `5173` (both `strictPort`)
