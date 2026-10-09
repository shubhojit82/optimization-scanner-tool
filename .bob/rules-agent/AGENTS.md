# AGENTS.md — Agent (coding) mode

This file provides guidance to agents when working with code in this repository.

## Non-obvious coding rules

- **Never add `.js` extensions to TypeScript `import` paths.** `scripts/build-portable.mjs` post-processes `dist/server/` to add them after `tsc` compiles. Adding them manually will break the rewrite.
- **Domain core (`src/core/`) must stay dependency-free.** No `import` of zod, node builtins, react, or any adapter. Tests transpile it directly with `ts.transpileModule`.
- **`src/core/contracts.ts` owns all shared types.** Do not duplicate types in application or adapter layers; import from there.
- **Two separate HTTP stacks share the same application layer.** `src/server/node-server.ts` (portable, plain Node) and `app/api/v1/` (Next.js, cloud). Keep them in sync when adding endpoints.
- **`src/adapters/validation.ts` is the only place Zod schemas live.** Both HTTP stacks import from there. Do not validate inline in route handlers.
- **`components/ui/`** is vendored shadcn — do not edit or lint. ESLint rules for it are explicitly suppressed.
- **`owner` is always the auth identity**, not a client concept. Scopes every repository call. In portable mode it is the admin username; in cloud mode it is `oai-authenticated-user-id`.
- **SQLite is the Node built-in `DatabaseSync`** (`node:sqlite`, Node 24+). Do not use `better-sqlite3` or any third-party SQLite package.
- **`core.test.mjs` creates `.sites-runtime/` at runtime** via `ts.transpileModule`. Don't worry about this directory; it is git-ignored and ephemeral.
- **Test files are `.mjs`**, not `.ts` — they run directly with `node --test`, not a TypeScript runner.
