# Project context: AI Search Intelligence (repo dir `geo-workbench`)

Read this first in every new session. It is a snapshot taken by Bob so the user does not need to re-explain the app.
Snapshot date: after the "User Management" design phase began. Re-verify anything marked (verify) with grep before relying on it.
The older `AGENTS.md` files hold coding rules. This file holds the app map and the current work state.

## What the product is
IBM consulting workbench that measures a client website's SEO / AEO / GEO readiness for AI search engines.
Flow: add client -> import/scan a page -> score against a rubric -> derive findings -> probe live AI engines (OpenAI, Gemini, Claude, Perplexity) with customer-intent prompts -> track mention rate, citations, sentiment over time -> reports.
Current user: Shubhojit. Test client in his data: World Financial Group (www.worldfinancialgroup.com). Local dev only so far.

## How to run
- Node 24 is required. The default shell is Node v22.19.0, but nvm has v24.15.0 installed. Run every npm command as `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && npm ...`.
- `npm run dev` -> builds server only (`scripts/build-portable.mjs --server-only`), starts API on 127.0.0.1:8080 and Vite on 127.0.0.1:5173. Open http://127.0.0.1:5173.
- `scripts/dev.mjs` refuses to run if `GEO_AUTH_MODE` is set to anything other than `local`.
- Restart after server TypeScript changes. Frontend edits hot-reload through Vite.
- To restart: `lsof -ti :8080 -ti :5173 | xargs kill; npm run dev` (run the dev server with `background: true`).
- `npm run typecheck`, `npm test` (builds portable, then 5 `node --test` files in `tests/`).
- `.env` is gitignored and Bob cannot read it (blocked by ignore patterns). Only variable names are known: GEO_AUTH_MODE, GEO_LOCAL_USER, GEO_BIND, PORT, GEO_DATA_DIR, GEO_ALLOWED_ORIGINS, OPENAI_API_KEY, GEO_OPENAI_MODEL, GEMINI_API_KEY, ANTHROPIC_API_KEY. Perplexity is NOT set up. Gemini default model string is `gemini-3.8-flash` (may not be a real model id; check `GEO_GEMINI_MODEL` if Gemini probes fail).
- Data lives in `data/geo.sqlite` (gitignored). Do not delete it.

## Known issues at snapshot time
1. FIXED: the typecheck error in `probe-runner.ts` (CollectionError import). `src/core/brand-matching.ts` fallback no longer matches inside longer words ("Northstarlight", "World Financial Grouper"). Tests updated for the new rubric: coverage 75 (sample) / 84 (SaaS industry profile), query universe 18 prompts, `listProbeRuns` stub. As of the last run: `npm run typecheck` clean, `npm test` 28/28 pass, brand-matching tests 9/9 pass, `npm run dev` serves UI :5173 and API :8080 with every `app/*.tsx` compiling.
2. The top-bar "Workspace" badge (`.private` span in `app/workbench-ui.tsx`) is a passive label with no behavior.
3. Many files have uncommitted changes (only 3 commits in git). Do not `git checkout`/`reset` anything without asking.

## Architecture (layers; keep them)
```
src/core/          zero-dependency domain. contracts.ts owns ALL shared types. scoring.ts (rubric, ~1090 lines), rgps.ts (passage scoring), question-mapping.ts, tech-detect.ts, brand-matching.ts, report-analysis.ts, demo.ts
src/application/   Workbench, ProbeRunner, ObservationRunner, scanner, findings (deriveFindings), SmartPromptsService, ContentBriefService, ArticleDraftService, RgpsRewriteService, ClientIdentityService
src/adapters/      validation.ts (ALL zod schemas live here), http.ts + d1-repository.ts (cloud/Next.js stack)
src/server/        node-server.ts (portable HTTP server, minified one-liner style), sqlite-repository.ts, providers/{openai,gemini,claude,perplexity}-provider.ts, node-crawler, browser-crawler, site-crawler, scheduler, scan-cache, html/xlsx/exec-summary exporters, cms/{contentful-connector,adapter-registry}.ts
app/               React 19 UI. workbench-ui.tsx is the shell (state, nav, tab switch). One *-panel.tsx per tab. globals.css = design tokens + layout.
frontend/main.tsx  Vite entry -> mounts WorkbenchUI
app/api/v1/        Next.js/cloud route handlers (only clients + audits + observations; most newer endpoints exist ONLY in node-server.ts)
```
- Two HTTP stacks exist. The portable one (`node-server.ts`) is the one actually used. New endpoints have been added only there. The AGENTS.md says to keep both in sync, but in practice the cloud stack is stale and unused by `npm run dev/start`.
- Server files are written as dense one-liners. Frontend files use normal formatting (panels) or dense (workbench-ui.tsx).
- Never add `.js` extensions to TS import paths (build script adds them).
- `src/core/` must not import zod/node builtins/react/adapters.
- Providers must throw `CollectionError` (from contracts) for expected failures so the server maps the status (not 500).
- `components/ui/` is vendored shadcn: do not edit.
- `lucide-react` pinned at 1.31.0.
- TSX: straight quotes only. No curly apostrophes anywhere in `app/*.tsx`.
- All UI styling is inline styles plus tokens in `app/globals.css` (`--interactive:#4f6ef7`, `--border-subtle:#e4e6ef`, `--bg-app:#f5f6fa`). Inputs use onFocus/onBlur to swap borderColor `#4f6ef7`/`#e4e6ef`. Selects use `appearance:'none'` + SVG chevron (see `selectStyle()` in `app/alerts-panel.tsx`). Empty states use the gradient card (see `CompetitorEmptyState` in `app/competitor-panel.tsx`).
- A PostToolUse hook (`.bob/hooks/sync-roadmap.mjs`, configured in `.bob/settings.json`) prints a reminder after any `src/` or `app/` edit: update `app/roadmap-panel.tsx` feature statuses when a roadmap feature advances.

## Auth model today (what user management will replace/extend)
- `settings()` in `src/server/node-server.ts`: `GEO_AUTH_MODE=local` (default, loopback only, NO login, identity = `GEO_LOCAL_USER`, default `local-admin`) or `basic` (HTTP Basic auth, `GEO_ADMIN_USERNAME` + `GEO_ADMIN_PASSWORD` >= 16 chars; optional `GEO_VIEWER_PASSWORD` = read-only tier).
- `const owner = s.username` is the single tenant key. EVERY repository call is scoped by `owner`. All data (clients, records, schedules, alerts, findings, recommendations, audit_log) is owned by that one string.
- Frontend sees auth only via `GET /api/v1/session` -> `{readOnly, username}`; a 401 `Sign in required` sets a banner. There is no login page.
- Mutating requests (POST/PATCH/DELETE) require an `Origin` header in `GEO_ALLOWED_ORIGINS`. `app/workbench-api.ts` has `api` (GET/POST), `patch`, `del`. NOTE: `del` does not send Origin (verify; DELETE may be rejected by the origin check from a browser that omits Origin on same-origin DELETE).

## Storage (SQLite, `SqliteRepository`, migrations tracked in `schema_migrations`)
Migrations 1-5 exist: 1 clients+records, 2 schedules, 3 alerts, 4 findings+recommendations, 5 audit_log. Next free version = 6.
Tables: `clients(id,owner,data JSON,created)`, `records(id,owner,client_id,kind,data,created)` where kind in audit | observation | probe-run | custom-prompts, `schedules`, `alerts`, `findings`, `recommendations`, `audit_log`.
Implements `Repository`, `ObservationLookup`, `ClientIdentityStore`, `FindingStore`. Add new methods to the interface in `contracts.ts` first.
`listClients` is capped at 100 rows; `listRecords` at 200.

## HTTP API (portable server) - all under /api/v1
session, providers, clients (GET list, POST create), clients/:id (GET detail, DELETE), clients/:id/audits|observations (POST), clients/:id/identity (POST), clients/:id/observation-runs (POST), clients/:id/prompts (GET/POST), clients/:id/(audits|observations)/:rid (DELETE), scan, scan/save, scan/export, scan/questions, site-scan, site-scan/export, report, exec-summary/:id, probe, probe-history/:id, competitors, benchmark, smart-prompts, content-brief, article-draft, rgps/rewrite, schedules (POST) + schedules/:id (GET/DELETE), alerts (POST) + alerts/:id (GET/DELETE alerts/:cid/:aid), findings (GET ?clientId) + findings/:id (PATCH) + findings/:id/retest, recommendations (GET/POST) + recommendations/:id (PATCH), audit-log, cms/adapters, cms/change-instructions, cms/contentful/fetch, /healthz.
Handlers use `repo.getClient(owner, id)` to guard per-client access; several (probe-history, prompts, schedules, alerts GET/DELETE, findings GET, recommendations, audit-log) do NOT verify the client exists/is visible first. Any per-user client scoping must be enforced centrally.

## UI tabs (sidebar `nav` array in `app/workbench-ui.tsx`)
Dashboard, Overview, Scanner, Site Crawler, Findings, AI Visibility, AI Monitor, Schedules, Alerts, Smart Prompts, Analytics, CMS, Competitors, Benchmark, Progress, Content Brief, Action Plan, Executive Summary, Query universe, Observations, Integrations, Architecture, Roadmap. Top bar has a "Workspace" badge and a Help drawer (`app/help-drawer.tsx`). A client selector bar sits under the heading. Sample client "Northstar" (`demo`) is shown when no real client exists.
Smart Prompts "Probe" button -> `onRunPrompt` -> `queuedProbePrompts` state in workbench-ui -> AIVisibilityPanel pre-fills custom prompts (done this session).

## Work in progress: USER MANAGEMENT (requested, design done, NO app code written yet)
User request (verbatim intent): build user management with
1. a Super Admin and a "backdoor" entry for the tool (emergency access that does not depend on the user table),
2. Super Admin adds users; the app SENDS AN INVITE EMAIL when a user is added,
3. in the admin profile, grant each user access to specific clients; users must NOT see all clients; a client a user creates themselves is visible to them in addition to what admin assigned,
4. a login page full of graphics that asks for ORGANIZATION, USERNAME, PASSWORD; on successful validation the workspace appears ("comes alive").

Only change made so far: `npm install nodemailer@^7` and `-D @types/nodemailer` (package.json/lock updated). Todo list that was in progress:
- shared types in `contracts.ts` + zod schemas in `validation.ts`
- migration 6 + user store (organizations, users, client_access grants, sessions, invites)
- mailer (nodemailer) + AuthService (scrypt password hashing via node:crypto, sessions, login rate limit, invite tokens)
- user/admin routes + integrate into `node-server.ts` (new auth mode, central client scoping)
- `scripts/dev.mjs`, `.env.example` updates
- `LoginPage` + invite-acceptance screen (React, graphic-heavy, inline styles)
- `UserAdminPanel` (orgs, users, invite, per-client access)
- wire `workbench-ui.tsx` (session gate, sign out, new nav item for admins)
- tests `tests/users.test.mjs`, typecheck, build, run.

Design decisions to carry forward (confirm with user only if they conflict with something new):
- Keep `owner` as the data tenant key so existing data keeps working. Introduce an organization: data owner = the org's owner key. Existing `GEO_LOCAL_USER`/admin data must stay reachable by the Super Admin.
- Super Admin + backdoor: seeded from env (`GEO_SUPERADMIN_*` and a break-glass credential), works even if the users table is broken; never stored in plain text; compare with timing-safe equality.
- Passwords: `crypto.scrypt` with per-user salt. Sessions: random token in an HttpOnly, SameSite=Strict cookie, stored hashed in SQLite. Invites: single-use random token (hashed in DB), expiry, set-password page.
- Email: nodemailer via SMTP env vars (`SMTP_HOST/PORT/USER/PASS/FROM`). If SMTP is not configured, fall back to logging the invite link to the server console AND returning it to the admin UI so invites are never lost. Say this clearly in the UI.
- Client visibility: new table of (user_id, client_id) grants plus `created_by`; list/detail/mutation endpoints filter by that. Viewer role = read-only. Enforce in one central place before routing, not per handler.
- Login form fields exactly: Organization, Username, Password.
- Cloud (Next.js) stack: out of scope unless the user asks.
- `local` mode must keep working for developers (decide with user whether the login page also applies to local mode; default plan: opt-in via `GEO_AUTH_MODE=users`).
## Work in progress: IBM CLOUD DEPLOY (step 1, minimum cost, us-east)
- Plan: one VPC VSI (cx2-2x4, Ubuntu 24.04) running `compose.ibm.yaml` (app + Caddy) with a separate 20 GB data volume at `/srv/geo-data`. Free HTTPS host `<ip-with-dashes>.sslip.io`.
- Code in `infra/` (Terraform, IBM provider; validated with `terraform validate`, cloud-init YAML checked). Creates VPC/subnet/SG, SSH key, data volume (prevent_destroy), VSI, floating IP, daily snapshot policy, COS bucket (35-day retention, prevent_destroy) and HMAC creds for `infra/scripts/geo-backup.sh` (nightly SQLite VACUUM INTO -> COS).
- `terraform apply` NOT run yet. Needs `ibmcloud login --sso -r us-east`, an `infra/terraform.tfvars` (copy the .example; gitignored), and user approval of the plan/cost first.
- After apply: clone repo on VM via read-only deploy key (private repo), write `.env` and `/etc/geo-backup.env`, `docker compose -f compose.ibm.yaml up -d --build`, test backup + restore.
- Later target ("pro"): Code Engine + Databases for PostgreSQL + COS + Secrets Manager; requires storage refactor (async repo interfaces, scheduler lock) first.
- Git remote `origin` is the plain https URL. A GitHub token leaked into chat earlier; the user must revoke it. Never embed tokens in the remote URL.
- ICA Edge AI provider: not built; need base URL, auth header, request/response shape from the user.



## Working preferences observed
- User prefers action over questions, wants concise, direct replies with real file links.
- User wants Bob to remember the app between sessions: keep this file updated when architecture or work state changes (append to "Work in progress"; move finished items into the sections above).
- Do the minimal change that solves the request; verify with `npm run typecheck` (and tests) before saying done.
