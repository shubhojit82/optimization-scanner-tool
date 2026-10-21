# AGENTS.md — Plan mode

This file provides guidance to agents when working with code in this repository.

## Non-obvious architectural constraints

- **Two deployment targets share one domain core**: portable (Node + SQLite) and cloud (Next.js + Cloudflare D1). Any new domain feature must work for both; adapters must not leak into `src/core/` or `src/application/`.
- **`Repository` interface is the only coupling** between application and storage. New storage backends implement the interface in `src/core/contracts.ts`. No ORM or query builder is shared between adapters.
- **`saveRecords` is transactional by contract** — partial writes are not acceptable. SQLite uses `BEGIN IMMEDIATE`/`ROLLBACK`; D1 uses `.batch()`.
- **`owner` is the entire auth model** — no roles, teams, or ACLs. Isolation is enforced at every read/write. Adding multi-tenancy touches every repository method.
- **`listRecords` hard-capped at 200 rows**; `listProbeRuns` at 20. Pagination not implemented. Visibility stats computed over this window.
- **`CollectionError` is the only provider error type** that reaches the HTTP layer with a non-500 status. All provider errors must be wrapped in it.
- **ProbeRunner runs all prompt×engine tasks in `Promise.all`** — failures per task are swallowed as empty results, not propagated. Design new probe features to tolerate partial failures.
- **`Scheduler` starts on every `createWorkbenchServer` call** — tests that call this must account for the background interval (or supply a mock).
- **`ScanCache`** is an in-process LRU — shared across all requests in a single server process, invisible to tests that spin up isolated servers.
- **SQLite schema is forward-only** — migrations run at startup via version-gated `BEGIN IMMEDIATE` blocks. Rolling back requires manual SQL; no migration framework is used.
- **`analyzeHtml` returns 4 permanently-null dimensions** (`crawl`, `freshness`, `authority`, `measurement`). The rubric is intentionally incomplete; `aggregate()` computes coverage only over measured weight.
- **`queryUniverse()` is a pure function** of `Client` — deterministic, no LLM involved in query generation.
- **Crawler, CMS connector, and JobQueue interfaces** are defined in `src/core/contracts.ts` but `JobQueue` has no implementation yet. `CMSConnector` is implemented only via `ContentfulConnector`.
- **Two Vite configs coexist**: `vite.config.ts` is the cloud/Sites deploy (Cloudflare plugin, Wrangler). `vite.portable.config.ts` is the portable SPA build used by `npm run build` and `npm run dev`. Do not conflate them.
- **`tsconfig.client.json` only explicitly lists `app/workbench-ui.tsx`** as its entry. All panel components are reachable transitively. New panels must be imported from `workbench-ui.tsx` to be typechecked.
- **All frontend styles are inline** — there are no CSS Modules or utility class coupling to components. Design-token CSS variables (`app/globals.css`) exist but components must inline-reference their hex values when inline styles are used.
- **`app/overview-charts.tsx` is the sole chart module** — no chart library dependency. Adding charts means adding SVG components here.
