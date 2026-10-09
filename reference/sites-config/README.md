# GEO Workbench

Working foundation for evidence-based generative search readiness. Private client workspace, durable audits, transparent scoring, query generation and manual AI observations.

Read [architecture and scaling decisions](docs/ARCHITECTURE.md). API schema: [OpenAPI](docs/openapi.json).

## Layout

- `src/core`: vendor-independent domain and contracts
- `src/application`: workflows depending on interfaces
- `src/adapters`: D1 and HTTP implementations
- `app`: React UI and versioned API routes
- `db/schema.ts`, `drizzle`: schema and generated migrations
- `tests`: domain/application regression checks

## Verification

```sh
node --test tests/core.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Dependencies and build follow the bundled Sites scripts. The manifest declares logical D1 binding `DB`. Generated migrations are applied during hosting. Preview migrations are separate and must not be replayed.

## First use

1. Sign in and create a client with its domain, products, competitors and market.
2. Import a page's HTML and its original URL.
3. Inspect readiness coverage, evidence and prioritized cue gaps.
4. Export candidate queries; collect genuine answers before importing observations.
5. Export the report and re-import the same page after changes for a comparable baseline.

The Northstar sample is read-only and illustrative. Automated crawling, AI provider connections, CMS adapters, team roles and publishing are not implemented. Do not treat this foundation as a production-ready SaaS or as a ranking predictor.
