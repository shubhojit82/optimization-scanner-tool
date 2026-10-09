# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack

- **Node.js 24 required** (`.nvmrc` pins to 24; built-in `node:sqlite` `DatabaseSync` and `--env-file-if-exists` are used directly)
- **Dual runtime**: server code compiles to ESM via `tsc`; frontend is a React 19 / Vite SPA; also a Next.js shell for cloud deployment (ChatGPT connector)
- **Package manager**: `npm` (not pnpm — `pnpm-workspace.yaml` is a Sites-platform config file, not a monorepo definition for this project)

## Commands

```bash
npm run dev          # builds server-only, then starts API :8080 + Vite dev :5173
npm run build        # full portable build (tsc + vite) → dist/server/ + dist/client/
npm run test         # builds portable first, then runs Node built-in test runner
npm run typecheck    # tsc --noEmit on both tsconfig.client.json and tsconfig.server.json
```

### Running a single test

The tests use **Node's built-in test runner** (`node:test`), not Jest/Vitest:
```bash
node --test tests/core.test.mjs      # core scoring/rubric tests (no build needed if .sites-runtime exists)
node --test tests/portable.test.mjs  # HTTP integration tests (requires a prior build)
```
`portable.test.mjs` imports from `dist/server/…` so `npm run build` (or `build-portable.mjs`) must run first.

## Architecture

```
src/core/          ← pure domain (contracts, scoring, demo) — no runtime deps
src/application/   ← Workbench class, depends only on Repository interface
src/adapters/      ← D1Repository (Cloudflare), validation (Zod schemas), http.ts (Next.js/Cloudflare handler)
src/server/        ← SqliteRepository (Node built-in sqlite), node-server.ts (plain http.createServer)
app/api/v1/        ← Next.js route handlers (cloud path) — thin wrappers around src/adapters/http.ts
frontend/          ← Vite entry point (main.tsx → app/workbench-ui.tsx)
app/workbench-ui.tsx ← single-file React UI (shared between Next.js and Vite builds)
```

**Two deployment paths share the same domain core:**
1. **Portable** (`npm run build/start`): `node-server.ts` + `SqliteRepository`, serves `dist/client/` as static files
2. **Cloud/Next.js** (`app/api/v1/`): `D1Repository` on Cloudflare D1, identity from `oai-authenticated-user-id` header

## Critical Patterns

- **`src/core/`** has zero external dependencies — keep it that way. All framework/DB imports go in adapters or server.
- **`owner` = auth identity**: In portable mode, `owner = s.username` (the single admin). In cloud mode, `owner = r.headers.get('oai-authenticated-user-id')`. All repository calls are scoped by owner.
- **`build-portable.mjs` post-processes TS output**: After `tsc`, it rewrites bare relative imports to add `.js` extensions (ESM requirement). Never add `.js` extensions to TypeScript `import` statements — the build script adds them.
- **`core.test.mjs` transpiles TypeScript at test time** using `typescript` package's `transpileModule`. It writes output to `.sites-runtime/tests/` before importing — this directory is ephemeral and git-ignored.
- **Validation is in `src/adapters/validation.ts`** (Zod). All API boundaries must go through these schemas before reaching the application layer.
- **`components/ui/`** is vendored verbatim from shadcn@4.17.0 — ESLint rules are suppressed for it. Do not edit these files.
- **Body size limit** is 600 000 bytes (enforced in both `src/adapters/http.ts` and `src/server/node-server.ts`).
- **CORS**: Only `POST` requests check `Origin`; `GET` does not. Origins are allowlisted via `GEO_ALLOWED_ORIGINS`.

## Code Style

- **TypeScript strict mode** on both client and server configs.
- Server source code is heavily minified on purpose (one-liners, no spacing) — match surrounding style when editing server files.
- Frontend/app code uses normal formatting (spaces, multi-line).
- Types from `src/core/contracts.ts` are the canonical domain types — import from there, not from application or adapter layers.
- Dates are always ISO 8601 strings (`new Date().toISOString()`), never `Date` objects in persisted types.
- `score: number | null` — null means "unmeasured" (distinct from a zero score).

## Environment

- `.env` is loaded with `--env-file-if-exists` (Node 24 flag) — no `dotenv` package.
- Dev requires `GEO_AUTH_MODE=local` (default). Cloud deployments use `GEO_AUTH_MODE=basic` with `GEO_ADMIN_PASSWORD` ≥ 16 chars, not containing `REPLACE_`.
- API dev port is always `8080`; Vite dev port is always `5173` (both `strictPort`).
