# AGENTS.md — Ask mode

This file provides guidance to agents when working with code in this repository.

## Non-obvious documentation context

- **`app/` contains two distinct things**: Next.js route handlers (`app/api/v1/`) for the cloud/ChatGPT deployment, and the shared React UI (`app/workbench-ui.tsx`) that is also the Vite entry point.
- **`frontend/` is just two files** (`index.html`, `main.tsx`); the actual UI code lives in `app/workbench-ui.tsx`. This is counterintuitive given the Next.js layout.
- **`pnpm-workspace.yaml` is NOT a monorepo workspace config** — it is a Sites-platform policy file. The project uses `npm`, not pnpm.
- **There are two separate ESLint config target audiences**: `components/ui/` (vendored shadcn, rules off) vs. all other code (next/core-web-vitals + next/typescript).
- **`src/adapters/d1-repository.ts`** imports from `cloudflare:workers` — it cannot be imported or tested outside a Cloudflare Workers environment.
- **`app/chatgpt-auth.ts`** handles ChatGPT connector auth via `oai-authenticated-user-*` headers — this is the cloud auth path. The portable server uses HTTP Basic instead.
- **The scoring rubric version** is `RUBRIC_VERSION = 'readiness-cues/1.0.0'` in `src/core/scoring.ts`. It is embedded in every audit record and cannot be changed without affecting existing records.
- **`drizzle/` and `drizzle.config.ts`** exist but are not used by the active code paths — they appear to be unused scaffolding.
