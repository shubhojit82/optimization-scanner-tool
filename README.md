# GEO Workbench — standalone source v0.2.1

Complete first-stage GEO product source with a standalone Mac/Linux runtime. Start with [docs/SETUP.md](docs/SETUP.md), which includes local setup, cloud deployment and Git workflows.

## Updating your existing local installation

Read [UPGRADE.md](UPGRADE.md). The included Git patch upgrades v0.1.1 or v0.2.0 while preserving `data/` and `.env`.

## Correcting an existing client identity

Use **Edit client** next to the selected client. For this WFG workspace, use `World Financial Group` as the name and `WFG, WorldFinancialgroup` as explicit aliases. The update preserves the client ID, records and website. Saved observation rates recalculate using the new identity; historical audits retain their previous scores. Reimport page HTML to create a new audit under rubric `readiness-cues/1.1.0`.

## Automatic observations

Add `OPENAI_API_KEY` to your existing `.env`, keep `GEO_OPENAI_MODEL=gpt-4.1`, and restart. Select your client → Observations → choose a question → **Run query & save**. Keys stay on the server. Each run incurs API usage; a ChatGPT subscription does not provide API credits. See [docs/OBSERVATIONS.md](docs/OBSERVATIONS.md).

## Quick start

Requires Node 24 and npm. After extracting the ZIP:

```sh
cd geo-workbench-v0.2.1
cp .env.example .env
npm ci
npm run dev
```

Open http://localhost:5173. Stop with Control-C. SQLite data persists under `data/`; no cloud credentials or paid API keys are needed for the implemented import workflows. Restart `npm run dev` after changing server/domain TypeScript; frontend changes reload through Vite.

## Verify and run the built app

```sh
npm run typecheck
npm test
npm start
```

`npm test` builds both server and client before running 28 regression/integration tests. Open http://localhost:8080 for the built app. Do not run the dev and built server simultaneously on port 8080.

## Source boundaries

| Directory/file | Purpose |
| --- | --- |
| `src/core` | Vendor-neutral contracts, scoring, visibility and prompt logic |
| `src/application` | Workflows depending on interfaces |
| `src/server` | Standalone Node HTTP/auth and SQLite repository |
| `src/adapters/validation.ts` | Shared input validation |
| `frontend`, `app/workbench-ui.tsx`, `app/globals.css` | React/Vite user interface |
| `src/adapters/d1-repository.ts`, `app/api` | Original Cloudflare/Sites adapters, unused by standalone commands |
| `Dockerfile`, `compose.yaml`, `Caddyfile` | Single-VM HTTPS deployment with persistent storage |
| `.github/workflows/ci.yml` | Tests/build on GitHub push and pull request |
| `docs` | Setup, architecture, API and verification records |
| `reference/GEO_Workbench_Sites_Source.tar.gz` | Exact original hosted source snapshot at commit `1d6f9588d9b16500ed40e744477668f9d801423e` |

Root `npm` commands run the standalone edition. The old Sites entrypoints/configuration are retained for reference but are not part of the portable build. The original snapshot has its own complete dependency manifest and pnpm lockfile; it is separate from the portable npm lockfile. Do not restore only one original configuration file into this edition.

## Implemented scope

Client setup, HTML import, evidence/coverage scoring, candidate queries, OpenAI web-search observations, manual AI observations, immutable audit history and report export. The Northstar client is illustrative. Live crawling, additional provider APIs, CMS connectors, organization teams and automatic publication remain future work.

The standalone edition uses one configured owner. Local mode is restricted to loopback; the supplied cloud deployment uses HTTP Basic authentication over HTTPS. For enterprise teams, add OIDC/SSO, tenant memberships/RBAC and stronger secret management before broader use. SQLite suits the first single-instance deployment; move behind a PostgreSQL repository adapter before multiple application replicas.
