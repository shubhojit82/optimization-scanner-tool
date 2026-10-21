# AGENTS.md — Agent (coding) mode

This file provides guidance to agents when working with code in this repository.

## Non-obvious coding rules

- **Never add `.js` extensions to TypeScript `import` paths.** `scripts/build-portable.mjs` post-processes `dist/server/` to add them after `tsc`. Adding them manually breaks the rewrite regex.
- **`src/core/` must stay dependency-free.** No zod, node builtins, react, or adapter imports. Tests transpile it directly with `ts.transpileModule`.
- **`src/core/contracts.ts` owns all shared types.** Do not duplicate; import from there in application and adapter layers.
- **Two HTTP stacks share one application layer.** `src/server/node-server.ts` (portable) and `app/api/v1/` (Next.js/cloud). Keep in sync when adding endpoints.
- **`src/adapters/validation.ts` is the only place Zod schemas live.** Both stacks import from there. Do not validate inline in route handlers.
- **`CollectionError`** is thrown by AI providers for expected failures (401, 429, 502). The server maps it to the error's `.status` field, not 500. Any new provider must use `CollectionError`, not plain `Error`.
- **OpenAI uses the Responses API** (`POST /v1/responses`), not Chat Completions. The model must support web search tools. `gpt-4o-mini` does NOT support it — use `gpt-4.1` or `gpt-4o`.
- **`SqliteRepository` implements three interfaces**: `Repository`, `ObservationLookup`, `ClientIdentityStore`. When adding methods, add them to the correct interface in `src/core/contracts.ts` first.
- **`probe-run`, `custom-prompts`** are stored in the `records` table with those literal `kind` strings — not separate tables. `listProbeRuns` and `listCustomPrompts` query `records` by `kind`.
- **`Scheduler`** starts automatically in `createWorkbenchServer` — do not start it manually or call it twice.
- **`SqliteRepository`** uses Node built-in `DatabaseSync` (`node:sqlite`, Node 24+). Do not add `better-sqlite3`.
- **`components/ui/`** is vendored shadcn — do not edit or apply ESLint fixes to it.
- **Test files are `.mjs`**, run with `node --test`. `core.test.mjs` writes to `.sites-runtime/` at runtime via `ts.transpileModule` — ephemeral, git-ignored.
- **Server request timeout is 300 000ms** (5 min) to accommodate long-running AI provider calls.
- **TSX string literals must use straight quotes only** — curly/typographic apostrophes cause the Vite oxc parser to throw a parse error. Never use `'` or `"` inside JSX text or template strings in `app/*.tsx`.
- **Empty state pattern**: every panel that can have no data must show an illustrated empty state using a gradient card (`linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)`), SVG illustration on left, 3–4 feature-explainer tiles on right. See `CompetitorEmptyState` in `app/competitor-panel.tsx` for canonical shape.
- **Inline focus ring on inputs/selects**: use `onFocus`/`onBlur` handlers toggling `borderColor` between `#4f6ef7` and `#e4e6ef`. CSS `:focus` is not used — all component styles are inline.
- **Custom select chevron**: always use `appearance:'none'` + SVG chevron as a `background-image`. See `selectStyle()` in `app/alerts-panel.tsx`.
- **`lucide-react` is pinned at `1.31.0`** — do not upgrade; icon names changed in later releases.
- **`tsconfig.client.json` only explicitly lists `app/workbench-ui.tsx`**, but all panels are imported from it so `npm run typecheck` catches them transitively. Do not add new `app/*.tsx` directly to `tsconfig.client.json`.
