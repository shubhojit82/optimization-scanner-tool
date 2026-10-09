# AGENTS.md — Plan mode

This file provides guidance to agents when working with code in this repository.

## Non-obvious architectural constraints

- **Two deployment targets share one domain core**: portable (Node + SQLite) and cloud (Next.js + Cloudflare D1). Any new domain feature must work for both; adapters must not leak into `src/core/` or `src/application/`.
- **`Repository` interface is the only coupling** between application and storage. New storage backends implement the 5-method interface in `src/core/contracts.ts`. No ORM or query builder is shared.
- **`saveRecords` is transactional by contract** (SQLite uses `BEGIN IMMEDIATE`/`ROLLBACK`; D1 uses `.batch()`). Implementations must guarantee atomicity — partial writes are not acceptable.
- **`owner` is the entire auth model**: there are no roles, teams, or ACLs. Owner isolation is enforced at every read and write in the repository layer. Adding multi-tenancy or roles requires touching every repository method.
- **`listRecords` is hard-capped at 200 rows** (the last 200 by `created DESC`). `visibility()` statistics are computed over this window. Pagination is not implemented.
- **`analyzeHtml` returns 4 unmeasured dimensions** (`crawl`, `freshness`, `authority`, `measurement`) with `score: null`. The rubric is intentionally incomplete; `aggregate()` handles nulls by computing coverage over measured weight only.
- **`queryUniverse()` is a pure function** of `Client` — it generates a fixed 10-prompt set deterministically. No LLM is involved in query generation today.
- **Crawler, AI provider, CMS draft, and JobQueue interfaces** are defined in `src/core/contracts.ts` but have no external adapters yet. These are the planned next layer.
- **The Next.js app shell (`app/layout.tsx`, `app/page.tsx`) is thin scaffolding** for the ChatGPT connector deployment; the portable build ignores it entirely and serves `dist/client/index.html` directly.
