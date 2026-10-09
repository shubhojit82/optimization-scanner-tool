# AI Search Intelligence — Implementation Plan

## Overview

Rebrand the "GEO Workbench" to "AI Search Intelligence" and add 12 features to the existing
Node.js 24 + React 19/Vite SPA + SQLite workbench. The codebase uses a strict layering rule:
`src/core/` has zero deps, all types live in `src/core/contracts.ts`, all Zod schemas in
`src/adapters/validation.ts`, server code is minified one-liners, and frontend uses normal
formatting.

Two HTTP stacks must stay in sync:
- **Portable**: `src/server/node-server.ts`
- **Cloud (Next.js)**: `app/api/v1/` route files + `src/adapters/http.ts`

## Implementation Order (dependency-first)

**Group 1 — No dependencies (can be done in any order)**
- Rebrand
- Feature 3: Multi-client dashboard (pure frontend)
- Feature 6: Query Universe editing (minor API + frontend)
- Feature 8: PDF/print export (CSS + frontend only)
- Feature 9: CSV import wizard (frontend only)
- Feature 10: Role-based viewer access (server only)
- Feature 12: SearchGPT / Bing AI monitoring (uses existing probe infrastructure)

**Group 2 — Requires Group 1 complete or independent DB**
- Feature 1: Perplexity provider (depends on Settings type changes)
- Feature 5: Alert system (needs new DB table, runs after probes)
- Feature 2: Scheduled re-probing (needs DB table + probe infrastructure)

**Group 3 — Independent but complex**
- Feature 4: Site Crawler dedicated tab (backend exists, pure frontend wrapper)
- Feature 7: Contentful CMS connector (new server file + UI)
- Feature 11: Playwright browser capture (optional dep, server only)

---

## Sub-Task 0: Rebrand to "AI Search Intelligence"

**Status:** [ ] pending

**Intent**
Rename every user-visible string from "GEO Workbench" / "GEO workbench" to "AI Search Intelligence"
across the UI, HTML reports, and documentation. No logic changes.

**Expected Outcomes**
- Browser tab reads "AI Search Intelligence"
- Sidebar brand reads "AI Search Intelligence"
- Footer reads "AI Search Intelligence · Observations v0.2.1"
- HTML audit report title/heading/footer reads "AI Search Intelligence"
- Exec summary footer reads "AI Search Intelligence"
- README.md heading updated

**Files to Edit**

| File | Location | Change |
|------|----------|--------|
| `app/workbench-ui.tsx` | Line 49 (sidebar brand) | Replace `GEO<span className="brand-light"> workbench</span>` with `AI Search Intelligence` |
| `app/workbench-ui.tsx` | Line 93 (footer) | Replace `GEO Workbench` with `AI Search Intelligence` |
| `frontend/index.html` | `<title>` | `GEO Workbench` → `AI Search Intelligence` |
| `frontend/index.html` | `<meta name="description">` | Update description copy |
| `src/server/html-report.ts` | Line 121 (`<title>`), 201 (heading), 234 (footer) | Replace `GEO Workbench` with `AI Search Intelligence` |
| `src/server/exec-summary-report.ts` | Line 354 (footer) | Replace `GEO Workbench` with `AI Search Intelligence` |
| `src/server/node-server.ts` | Line 69 (WWW-Authenticate realm) | Replace `GEO Workbench` with `AI Search Intelligence` |
| `README.md` | Heading and all body references | Replace throughout |

**Todo List**
- [ ] Edit `frontend/index.html` — title + description
- [ ] Edit `app/workbench-ui.tsx` — sidebar brand text + footer text
- [ ] Edit `src/server/html-report.ts` — three brand references
- [ ] Edit `src/server/exec-summary-report.ts` — footer reference
- [ ] Edit `src/server/node-server.ts` — WWW-Authenticate realm string
- [ ] Edit `README.md` — heading + body references

**Relevant Context**
- All brand occurrences confirmed via grep: `app/workbench-ui.tsx:49`, `app/workbench-ui.tsx:93`,
  `src/server/html-report.ts:121,201,234`, `src/server/exec-summary-report.ts:354`,
  `src/server/node-server.ts:69`

---

## Sub-Task 1: Perplexity Provider

**Status:** [ ] pending

**Intent**
Add Perplexity as a fourth AI provider using its OpenAI-compatible chat completions API.
Wire it into Settings, the provider map, and the providers info array so it appears in the
AI Visibility probe UI alongside OpenAI/Gemini/Claude.

**Expected Outcomes**
- `PERPLEXITY_API_KEY` and `GEO_PERPLEXITY_MODEL` env vars are recognised
- Provider appears in `GET /api/v1/providers` response as `{id:'perplexity', ...}`
- Probe runs can select Perplexity as an engine
- Existing tests still pass

**Files to Create**

| File | Purpose |
|------|---------|
| `src/server/providers/perplexity-provider.ts` | Implements `AIProvider`; calls `https://api.perplexity.ai/chat/completions` with OpenAI-compatible schema; default model `sonar` |

**Files to Edit**

| File | Change |
|------|--------|
| `src/server/node-server.ts` | Add `perplexityKey?` and `perplexityModel?` to `Settings` type; parse `PERPLEXITY_API_KEY` / `GEO_PERPLEXITY_MODEL` in `settings()`; add `providers.set('perplexity', ...)` and `info` entry in `createWorkbenchServer()` |

**Implementation Notes**
- Mirror `openai-provider.ts` exactly — same `observe()` return shape, same citation extraction logic.
- Perplexity's endpoint: `POST https://api.perplexity.ai/chat/completions`
- Auth header: `Authorization: Bearer <key>` (same as OpenAI)
- Request body: `{model, messages: [{role:'user', content: prompt}], stream: false}`
- Response: `choices[0].message.content` for text; citations live in `choices[0].delta.citations` or `message.citations` (Perplexity-specific field — extract if present, otherwise empty array)
- No new npm packages needed (uses `fetch`)

**Todo List**
- [ ] Create `src/server/providers/perplexity-provider.ts` (copy OpenAI provider, adapt endpoint + citation field)
- [ ] Extend `Settings` type in `node-server.ts` with `perplexityKey?` and `perplexityModel?`
- [ ] Extend `settings()` to parse `PERPLEXITY_API_KEY` and `GEO_PERPLEXITY_MODEL` (default: `sonar`)
- [ ] Add `providers.set('perplexity', ...)` and `info` push in `createWorkbenchServer()`
- [ ] Add `GEO_PERPLEXITY_MODEL` and `PERPLEXITY_API_KEY` entries to `.env` example / README

**Relevant Context**
- `src/server/providers/openai-provider.ts` — copy pattern
- `src/server/node-server.ts:29` — Settings type, `settings()`, provider map, info array (lines 29–54)

**Risks**
- Perplexity's citations field name differs from OpenAI (`message.citations` array vs OpenAI annotations). Confirm the exact field from Perplexity docs or test response; guard with optional chaining.

---

## Sub-Task 2: Scheduled / Automated Re-Probing

**Status:** [ ] pending

**Intent**
Allow users to configure a schedule (daily/weekly/monthly) per client so probes run automatically
in the background, with results saved to the existing `records` table as `probe-run` kind records.

**Expected Outcomes**
- `schedules` table exists in SQLite
- `POST /api/v1/schedules`, `GET /api/v1/schedules/:clientId`, `DELETE /api/v1/schedules/:clientId` endpoints respond correctly
- Scheduler checks every 5 minutes and fires due probes; results saved via `repo.saveProbeRun()`
- New "Schedule" UI panel visible inside AI Visibility tab (or as a new tab)

**Files to Create**

| File | Purpose |
|------|---------|
| `src/server/scheduler.ts` | `Scheduler` class — `setInterval` every 5 min; queries `schedules` table for `enabled=1 AND nextRunAt <= now`; runs `ProbeRunner.runProbes()`; saves result; updates `lastRunAt`/`nextRunAt` |
| `app/probe-schedule-panel.tsx` | React panel — cadence selector, provider checkboxes, enable/disable toggle, save/delete buttons |

**Files to Edit**

| File | Change |
|------|--------|
| `src/core/contracts.ts` | Add `ProbeSchedule` type |
| `src/server/sqlite-repository.ts` | Add migration version 2: `CREATE TABLE schedules(...)` |
| `src/adapters/validation.ts` | Add `scheduleSchema` (clientId, cadence, providers[], prompts[]) |
| `src/server/node-server.ts` | Import `Scheduler`; add 3 schedule endpoints; instantiate and start scheduler |
| `app/workbench-ui.tsx` | Import and render `ProbeSchedulePanelComponent` inside AI Visibility tab or as new tab |

**Schema: `schedules` table**
```sql
CREATE TABLE schedules(
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients(id),
  cadence TEXT NOT NULL,        -- 'daily'|'weekly'|'monthly'
  providers TEXT NOT NULL,      -- JSON array of provider ids
  prompts TEXT NOT NULL,        -- JSON array of prompt strings
  last_run_at TEXT,
  next_run_at TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created TEXT NOT NULL
);
CREATE INDEX idx_schedules_owner_next ON schedules(owner, next_run_at);
```

**`ProbeSchedule` type (contracts.ts)**
```typescript
export type ProbeSchedule = {
  id: string; clientId: string; owner: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  providers: string[]; prompts: string[];
  lastRunAt?: string; nextRunAt: string;
  enabled: boolean; created: string;
};
```

**Todo List**
- [ ] Add `ProbeSchedule` type to `src/core/contracts.ts`
- [ ] Add migration v2 with `schedules` table to `src/server/sqlite-repository.ts`
- [ ] Add schedule CRUD methods to `SqliteRepository` (not on the `Repository` interface — direct on the class)
- [ ] Add `scheduleSchema` to `src/adapters/validation.ts`
- [ ] Create `src/server/scheduler.ts`
- [ ] Add 3 schedule API endpoints to `src/server/node-server.ts`
- [ ] Create `app/probe-schedule-panel.tsx`
- [ ] Wire panel into `app/workbench-ui.tsx`

**Relevant Context**
- `src/server/sqlite-repository.ts` — migration pattern (version check → `BEGIN IMMEDIATE` → `COMMIT`)
- `src/application/probe-runner.ts` — `ProbeRunner.runProbes()` signature
- `src/server/node-server.ts:63` — `setInterval(...).unref()` pattern already used for cache eviction

**Risks**
- Scheduler must call `.unref()` on the interval so it doesn't prevent clean process exit.
- The `Repository` interface in `contracts.ts` must NOT gain schedule methods (only `SqliteRepository` gets them) to keep the D1 adapter unaffected.
- `nextRunAt` calculation: use plain Date arithmetic, not a cron library.

---

## Sub-Task 3: Multi-Client Dashboard Tab

**Status:** [ ] pending

**Intent**
Add a "Dashboard" tab that shows all clients in a sortable grid with key metrics, letting users
quickly compare clients and click through to any client.

**Expected Outcomes**
- New "Dashboard" nav entry (first in list, or after Overview)
- Grid shows: client name, domain, GEO score, mention rate, citation rate, last audit date, trend indicator
- Rows sorted by score descending by default
- Clicking a row selects that client and switches to Overview tab

**Files to Create**

| File | Purpose |
|------|---------|
| `app/dashboard-panel.tsx` | React component — maps over `clients[]`, loads per-client detail from existing API or local state, renders sortable table |

**Files to Edit**

| File | Change |
|------|--------|
| `app/workbench-ui.tsx` | Add `{name:'Dashboard', icon:LayoutDashboard}` to nav array; render `<DashboardPanel>` in tab switch; pass needed props |

**Implementation Notes**
- The workbench UI already has a `clients` state array (list of `Client` objects). The dashboard
  can render from that array directly, fetching detail lazily per row on hover or on mount.
- `detail` responses are already cached client-side in the existing state management pattern.
- No new API endpoints needed.
- Score displayed is the latest audit's `score` field; fallback to `—` if no audit.
- Trend arrow: compare last two audits if both present.

**Todo List**
- [ ] Create `app/dashboard-panel.tsx`
- [ ] Add Dashboard to nav array and tab renderer in `app/workbench-ui.tsx`

**Relevant Context**
- `app/workbench-ui.tsx` — existing tab nav array pattern; `clients` state; `detail` data shape

---

## Sub-Task 4: Site Crawler Dedicated Tab

**Status:** [ ] pending

**Intent**
Elevate the site crawler from its buried position inside the Scanner tab to a dedicated first-class
tab with proper configuration UI, results table, and XLSX export.

**Expected Outcomes**
- New "Site Crawler" tab in nav
- URL input + depth/max-pages config (note: `crawlSite()` currently uses internal constants — these may need to become parameters or the UI just shows a note about defaults)
- Results table: per-page URL, score, coverage, gaps
- Common gaps chart (bar or table)
- XLSX export button (calls existing `/api/v1/site-scan/export`)

**Files to Create**

| File | Purpose |
|------|---------|
| `app/site-crawler-panel.tsx` | Full site crawler UI panel |

**Files to Edit**

| File | Change |
|------|--------|
| `app/workbench-ui.tsx` | Add `{name:'Site Crawler', icon:Globe}` to nav; render `<SiteCrawlerPanel>` |

**Implementation Notes**
- Backend already has `/api/v1/site-scan` (POST `{url, clientId?}`) and `/api/v1/site-scan/export` (POST same payload → XLSX blob).
- `SiteScanResult` shape: `{startUrl, crawledAt, pagesAttempted, pagesScored, avgScore, avgCoverage, commonGaps[], pages[]}`.
- Depth/max-pages config: `crawlSite()` constants are internal. For now, expose them as read-only info in the UI ("Crawls up to 50 pages, max depth 3"). Actual parameterisation of the crawler is a future enhancement.

**Todo List**
- [ ] Create `app/site-crawler-panel.tsx`
- [ ] Add Site Crawler to nav and tab renderer in `app/workbench-ui.tsx`

**Relevant Context**
- `src/server/site-crawler.ts` — `SiteScanResult` type, constants `MAX_PAGES=50`, `MAX_DEPTH=3`
- Existing Scanner tab in `app/workbench-ui.tsx` for UI pattern reference

---

## Sub-Task 5: Alert / Threshold System

**Status:** [ ] pending

**Intent**
Let users configure metric thresholds (mention rate, citation rate, or score) per client.
After each probe run the system checks configured alerts and flags any breaches. The UI shows
banners when thresholds are breached.

**Expected Outcomes**
- `alerts` table in SQLite
- CRUD endpoints for alerts
- Alert check runs after every probe completion in `node-server.ts`
- `GET /api/v1/clients/:id` (detail) returns active alert breaches alongside other data, OR a separate `GET /api/v1/alerts/:clientId/status` endpoint
- UI panel shows alert config and current breach banners

**Files to Create**

| File | Purpose |
|------|---------|
| `app/alerts-panel.tsx` | Alert configuration UI — add/delete threshold rules, show breach banners |

**Files to Edit**

| File | Change |
|------|--------|
| `src/core/contracts.ts` | Add `Alert` and `AlertBreach` types |
| `src/server/sqlite-repository.ts` | Add migration version 3: `CREATE TABLE alerts(...)` + CRUD methods on class |
| `src/adapters/validation.ts` | Add `alertSchema` |
| `src/server/node-server.ts` | Add 3 alert endpoints; call `checkAlerts()` helper after probe results saved |
| `app/workbench-ui.tsx` | Render `<AlertsPanel>` in AI Visibility tab or new "Alerts" tab |

**Schema: `alerts` table**
```sql
CREATE TABLE alerts(
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients(id),
  metric TEXT NOT NULL,         -- 'mentionRate'|'citationRate'|'score'
  threshold REAL NOT NULL,
  direction TEXT NOT NULL,      -- 'below'|'above'
  last_triggered_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created TEXT NOT NULL
);
CREATE INDEX idx_alerts_owner_client ON alerts(owner, client_id);
```

**`Alert` type**
```typescript
export type Alert = {
  id: string; clientId: string; owner: string;
  metric: 'mentionRate' | 'citationRate' | 'score';
  threshold: number;
  direction: 'below' | 'above';
  lastTriggeredAt?: string;
  enabled: boolean; created: string;
};
```

**Todo List**
- [ ] Add `Alert` type to `src/core/contracts.ts`
- [ ] Add migration v3 with `alerts` table to `src/server/sqlite-repository.ts`
- [ ] Add alert CRUD methods to `SqliteRepository` (direct on class, not on `Repository` interface)
- [ ] Add `alertSchema` to `src/adapters/validation.ts`
- [ ] Add alert check helper in `src/server/node-server.ts` and call after probe saves
- [ ] Add 3 alert endpoints to `src/server/node-server.ts`
- [ ] Create `app/alerts-panel.tsx`
- [ ] Wire panel into `app/workbench-ui.tsx`

**Relevant Context**
- Migration versioning: Sub-Task 2 adds v2 (schedules); this adds v3 (alerts). Must be in sequence.
- Alert check: after `repo.saveProbeRun()` succeeds, load the latest `ProbeRun`, compare metrics to enabled alerts, update `last_triggered_at` on breach.

**Risks**
- Migration ordering: if Sub-Task 2 and Sub-Task 5 are implemented, versions must be v2=schedules, v3=alerts (not interchangeable).

---

## Sub-Task 6: Query Universe Editing

**Status:** [ ] pending

**Intent**
Allow users to save custom prompts per client alongside the auto-generated query universe, with
inline add/edit/delete in the Query Universe tab.

**Expected Outcomes**
- New API: `POST /api/v1/clients/:id/prompts` saves an array of custom prompt strings as a `kind='custom-prompts'` record
- New API: `DELETE /api/v1/clients/:id/prompts/:recordId` removes a custom-prompts record
- Query Universe tab shows custom prompts in an editable list with add/delete controls
- Custom prompts are included when running probes

**Files to Edit**

| File | Change |
|------|--------|
| `src/adapters/validation.ts` | Add `customPromptsSchema` (array of strings, max 50 items) |
| `src/server/node-server.ts` | Add `POST /api/v1/clients/:id/prompts` and `DELETE /api/v1/clients/:id/prompts/:recordId` endpoints; reuse existing `repo.saveRecords()` and `repo.deleteRecord()` |
| `app/workbench-ui.tsx` | In Query Universe tab, add editable list for custom prompts; fetch `kind='custom-prompts'` records; combine with generated prompts for probe runs |

**Implementation Notes**
- Storage: custom prompts are stored as a `records` row with `kind='custom-prompts'`. Each save call replaces previous custom prompts for that client (single record approach) OR appends (multi-record). Single record (one JSON array per client) is simpler and avoids 200-row cap issues.
- No new npm packages needed.
- The `DELETE` can reuse the existing `DELETE /api/v1/clients/:id/:kind/:recordId` endpoint already in `node-server.ts` — only the `POST` save endpoint is new.

**Todo List**
- [ ] Add `customPromptsSchema` to `src/adapters/validation.ts`
- [ ] Add `POST /api/v1/clients/:id/prompts` endpoint to `src/server/node-server.ts`
- [ ] Update Query Universe tab in `app/workbench-ui.tsx` — fetch + display custom prompts, add inline add/delete/save UI

**Relevant Context**
- Existing `DELETE /api/v1/clients/:id/:kind/:recordId` in `node-server.ts` — already handles deletion by kind+recordId
- `repo.saveRecords()` / `repo.listRecords()` — existing persistence methods

---

## Sub-Task 7: Contentful CMS Connector

**Status:** [ ] pending

**Intent**
Add a Contentful integration that fetches a page's rendered HTML by entry ID using the Contentful
Delivery API, then feeds it into the existing audit pipeline.

**Expected Outcomes**
- `CONTENTFUL_SPACE_ID` and `CONTENTFUL_ACCESS_TOKEN` env vars recognised
- `POST /api/v1/cms/contentful/fetch` returns a `PageSnapshot` and optionally auto-creates an audit
- Scanner tab shows "Import from Contentful" option when Contentful is configured
- No new npm packages (uses `fetch`)

**Files to Create**

| File | Purpose |
|------|---------|
| `src/server/cms/contentful-connector.ts` | Implements `CMSConnector` interface; calls Contentful Delivery API `GET /spaces/:spaceId/entries/:entryId`; extracts body HTML from rich-text fields; returns `PageSnapshot` |

**Files to Edit**

| File | Change |
|------|--------|
| `src/server/node-server.ts` | Parse `CONTENTFUL_SPACE_ID` and `CONTENTFUL_ACCESS_TOKEN` from env (add to Settings or as local vars); instantiate `ContentfulConnector`; add `POST /api/v1/cms/contentful/fetch` endpoint |
| `src/adapters/validation.ts` | Add `contentfulFetchSchema` (spaceId override optional, entryId, clientId optional) |
| `app/workbench-ui.tsx` | In Scanner tab, show "Import from Contentful" input+button when `contentfulConfigured` flag is true in providers/settings response |

**Implementation Notes**
- `CMSConnector` interface already defined in `contracts.ts` with `readPage(id)` and `stageDraft(pageId, html, expectedVersion)`.
- Contentful Delivery API: `GET https://cdn.contentful.com/spaces/{spaceId}/entries/{entryId}?access_token={token}`
- HTML extraction: Contentful rich-text fields are returned as a structured document; a simple recursive renderer that produces plain HTML is sufficient for scoring purposes.
- `stageDraft` can be a no-op stub for this iteration (Contentful Management API is more complex).
- The `Settings` type should gain `contentfulSpaceId?` and `contentfulToken?`; or keep them as local variables inside `createWorkbenchServer()` to avoid changing the exported type.

**Todo List**
- [ ] Create `src/server/cms/contentful-connector.ts`
- [ ] Add `contentfulFetchSchema` to `src/adapters/validation.ts`
- [ ] Add Contentful env vars to `settings()` or as local vars in `node-server.ts`
- [ ] Add `POST /api/v1/cms/contentful/fetch` endpoint in `node-server.ts`
- [ ] Add "Import from Contentful" UI to Scanner tab in `app/workbench-ui.tsx`

**Relevant Context**
- `src/core/contracts.ts` — `CMSConnector` interface, `PageSnapshot` type
- `src/server/node-server.ts` — Settings type, `createWorkbenchServer()` provider wiring pattern

---

## Sub-Task 8: PDF / Print Export Enhancement

**Status:** [ ] pending

**Intent**
Improve the HTML report with `@media print` CSS optimisations and add a "Print to PDF" button
that opens the report HTML in a new tab, letting the browser handle PDF generation — zero new
dependencies.

**Expected Outcomes**
- Existing `POST /api/v1/report` HTML response is print-optimised (page breaks, hidden nav, visible URLs)
- "Print to PDF" / "Open Report" button in the UI opens the report in a new tab
- No Puppeteer or Playwright dependency introduced

**Files to Edit**

| File | Change |
|------|--------|
| `src/server/html-report.ts` | Add `@media print { ... }` CSS block inside the report's `<style>` tag: hide interactive elements, add page breaks before major sections, print URLs after links |
| `app/workbench-ui.tsx` | In report output area, add "Open in new tab / Print to PDF" button that calls `window.open()` with the report blob URL or posts to `/api/v1/report` and opens result |

**Todo List**
- [ ] Add `@media print` CSS to HTML report template in `src/server/html-report.ts`
- [ ] Add "Print to PDF" button in report section of `app/workbench-ui.tsx`

**Relevant Context**
- `src/server/html-report.ts` — report HTML template with inline styles

---

## Sub-Task 9: Observations CSV Import Wizard

**Status:** [ ] pending

**Intent**
Add a multi-step modal wizard that accepts a CSV file with observation data, previews it, and
bulk-imports it using the existing observations API.

**Expected Outcomes**
- "Import CSV" button in Observations tab opens wizard
- Step 1: file picker + format hint (`engine,surface,model,prompt,response,citations,observedAt`)
- Step 2: preview table of parsed rows with validation errors highlighted
- Step 3: confirm and POST to existing `POST /api/v1/clients/:id` observations endpoint
- No new backend endpoints needed; no new npm packages (manual CSV split)

**Files to Create**

| File | Purpose |
|------|---------|
| `app/csv-import-wizard.tsx` | Multi-step modal component — CSV text area / file input → parse → preview table → submit |

**Files to Edit**

| File | Change |
|------|--------|
| `app/workbench-ui.tsx` | In Observations tab, add "Import CSV" button that opens `<CsvImportWizard>` |

**Implementation Notes**
- CSV parsing: split on newlines, then split each line on commas (handle quoted fields with a
  minimal state machine — no library needed for this fixed schema).
- `citations` column is a pipe-separated list of URLs within the CSV cell, parsed into `string[]`.
- Map each row to the `observationSchema` shape before POST.
- Validate `observedAt` is parseable as ISO date; show error inline for invalid rows.
- Submit calls existing `POST /api/v1/clients/:id` with body `{kind: 'observations', data: rows[]}` OR the dedicated `POST /api/v1/clients/:id/observations` endpoint in the Next.js adapter — check which path `workbench-ui.tsx` uses today.

**Todo List**
- [ ] Create `app/csv-import-wizard.tsx`
- [ ] Add "Import CSV" button in Observations tab of `app/workbench-ui.tsx`

**Relevant Context**
- `src/adapters/validation.ts` — `observationSchema` for row validation shape
- `app/workbench-ui.tsx` — Observations tab, existing import/submit pattern

---

## Sub-Task 10: Role-Based Viewer Access

**Status:** [ ] pending

**Intent**
Add a read-only "viewer" authentication mode: a second password (`GEO_VIEWER_PASSWORD`) that
grants access only to GET endpoints. POST/DELETE/PUT return 403. UI shows a "Read-only mode"
banner.

**Expected Outcomes**
- `GEO_VIEWER_PASSWORD` env var recognised (optional; if absent, viewer mode is disabled)
- Requests authenticated with viewer password can only call GET endpoints
- All mutation endpoints return `{error: 'Read-only mode'}` with status 403 for viewers
- UI detects read-only mode via a new `GET /api/v1/session` endpoint or a header in any response, and shows a banner

**Files to Edit**

| File | Change |
|------|--------|
| `src/server/node-server.ts` | Add `viewerPassword?` to `Settings`; parse `GEO_VIEWER_PASSWORD`; add `isViewer(req, s)` auth check; wrap all non-GET handlers with viewer guard; add `GET /api/v1/session` returning `{readOnly: boolean}` |
| `app/workbench-ui.tsx` | Fetch `GET /api/v1/session` on mount; show "Read-only mode" banner when `readOnly: true`; disable all mutating buttons |

**Implementation Notes**
- `authenticated()` function should be split into `authenticatedAdmin()` and `isViewer()`.
- Viewer password must be different from admin password (validate in `settings()`).
- `GET /api/v1/session` response: `{readOnly: boolean, username?: string}` — no sensitive data.

**Todo List**
- [ ] Add `viewerPassword?` to `Settings` type and parse in `settings()` in `node-server.ts`
- [ ] Add `isViewer()` helper alongside existing `authenticated()` in `node-server.ts`
- [ ] Add `GET /api/v1/session` endpoint
- [ ] Guard all mutation endpoints (POST/DELETE) with viewer check
- [ ] In `app/workbench-ui.tsx`, fetch session on mount and show read-only banner + disable mutating controls

**Relevant Context**
- `src/server/node-server.ts:41-42` — `equal()`, `authenticated()` helpers
- `src/server/node-server.ts:69` — WWW-Authenticate realm (update to match new brand from Sub-Task 0)

**Risks**
- `GEO_VIEWER_PASSWORD` must not equal `GEO_ADMIN_PASSWORD`. Validate this in `settings()` and throw on startup.
- Local mode (`GEO_AUTH_MODE=local`) has no passwords — viewer mode only applies in `basic` mode.

---

## Sub-Task 11: Playwright Browser Capture

**Status:** [ ] pending

**Intent**
Add optional Playwright-based JS-rendered page capture as an alternative to the existing
`NodeCrawler` (fetch-based). Falls back gracefully if Playwright is not installed.
Controlled by `GEO_USE_BROWSER=true` env flag.

**Expected Outcomes**
- `GEO_USE_BROWSER=true` activates Playwright chromium capture
- If `playwright` is not installed, server logs a warning and falls back to `NodeCrawler`
- JS-heavy pages (SPAs, React) can now be crawled and scored
- No hard `playwright` dependency — declared as optional in `package.json`

**Files to Create**

| File | Purpose |
|------|---------|
| `src/server/browser-crawler.ts` | `BrowserCrawler` class — implements `Crawler` interface; dynamic `import('playwright')` with try/catch fallback; launches Chromium, navigates, extracts `document.documentElement.outerHTML` |

**Files to Edit**

| File | Change |
|------|--------|
| `src/server/node-server.ts` | Parse `GEO_USE_BROWSER` env flag; conditionally instantiate `BrowserCrawler` instead of `NodeCrawler`; pass to scan handlers |
| `package.json` | Add `"playwright": "..."` under `optionalDependencies` |

**Implementation Notes**
- Dynamic import: `const {chromium} = await import('playwright').catch(() => null)` — if null, fall back.
- `BrowserCrawler.capture(url)` must return the same `PageSnapshot` shape as `NodeCrawler`.
- Set a 25-second navigation timeout (matching `NodeCrawler`'s 25000ms).
- Close the browser after each capture or use a persistent browser instance (persistent is faster but more complex — keep simple for first iteration: one launch per capture).

**Todo List**
- [ ] Create `src/server/browser-crawler.ts`
- [ ] Add `GEO_USE_BROWSER` parsing to `settings()` and `createWorkbenchServer()` in `node-server.ts`
- [ ] Add `playwright` to `optionalDependencies` in `package.json`

**Relevant Context**
- `src/server/node-crawler.ts` — existing `Crawler` implementation pattern
- `src/core/contracts.ts` — `Crawler` interface, `PageSnapshot` type
- `src/server/node-server.ts:58` — `const crawler=new NodeCrawler(25000)`

**Risks**
- Playwright binary download: `npm install` with optionalDeps will try to install but not abort on failure. Browsers must be explicitly installed via `npx playwright install chromium`. Document this in README.
- Memory/process overhead: each capture spawns and tears down a browser. Not suitable for high-volume batch crawls — acceptable for the use case.

---

## Sub-Task 12: SearchGPT / Bing AI Monitoring

**Status:** [ ] pending

**Intent**
Add a "passive monitoring" mode in the AI Visibility tab that uses a different prompt pattern
("What does [AI engine] say about [brand]?") rather than user-query framing, to simulate brand
monitoring rather than SEO probing. Uses existing probe infrastructure — no new backend.

**Expected Outcomes**
- "AI Search Monitor" section visible within AI Visibility tab (or as a sub-panel)
- User can trigger a monitor probe with a single click
- Monitor prompts are pre-filled with brand-monitoring templates using the client's brand name
- Results shown alongside regular probe results

**Files to Create**

| File | Purpose |
|------|---------|
| `app/ai-monitor-panel.tsx` | React component — renders pre-filled brand monitoring prompts, runs probe via existing `/api/v1/probe` endpoint, shows results |

**Files to Edit**

| File | Change |
|------|--------|
| `app/workbench-ui.tsx` | In AI Visibility tab, add `<AiMonitorPanel>` sub-section |

**Implementation Notes**
- Monitor prompt templates (pure frontend, no backend change):
  - `"What does [AI engine] currently say about [brand]?"`
  - `"Summarise what AI search results say about [brand] in [market]."`
  - `"List companies mentioned in AI answers about [industry] in [market]."`
- These are pre-populated as editable text before running — user can tweak before firing.
- Calls existing `POST /api/v1/probe` endpoint with `{clientId, prompts, providers}`.
- No new API, no new types, no DB changes.

**Todo List**
- [ ] Create `app/ai-monitor-panel.tsx`
- [ ] Add `<AiMonitorPanel>` to AI Visibility tab in `app/workbench-ui.tsx`

**Relevant Context**
- `src/server/node-server.ts` — `POST /api/v1/probe` endpoint signature: `{clientId, prompts[], providers[]}`
- `app/workbench-ui.tsx` — AI Visibility tab structure, existing probe call pattern

---

## Cross-Cutting Constraints

1. **Migration versioning**: Features 2 (schedules) and 5 (alerts) each add a migration. They must be applied in order: v2 = schedules, v3 = alerts. Implement Sub-Task 2 before Sub-Task 5.

2. **`src/core/` stays zero-deps**: New types (`ProbeSchedule`, `Alert`) go in `contracts.ts` only — no imports added.

3. **`.js` extension rule**: Never add `.js` to TS import paths in source — the `build-portable.mjs` post-processor adds them.

4. **Two HTTP stacks**: For features 2, 5, 6, 7 that add new endpoints, Next.js route files under `app/api/v1/` should be added to match `node-server.ts` — unless the feature is portable-only. For this scope, portable-first is acceptable; Next.js routes can be added as a follow-up.

5. **Server code style**: All `node-server.ts` additions must match the existing minified one-liner style.

6. **`Repository` interface**: Features 2 and 5 add DB methods directly on `SqliteRepository` (the concrete class), not on the `Repository` interface in `contracts.ts`, to keep the D1 adapter unaffected.

---

## Sub-Task UI: IBM Design System Reskin

**Status:** [ ] pending

**Intent**
Replace the current custom CSS with an IBM Carbon Design System-inspired visual language:
IBM color palette, IBM Plex Sans / IBM Plex Mono typefaces (loaded via CDN from fonts.googleapis.com
or unpkg), carbon-style UI components (data tables, tiles, buttons, notifications, tags).
The app must look like a professional IBM enterprise tool — not a startup SaaS product.

**Expected Outcomes**
- All CSS custom properties updated to IBM Carbon color tokens
- Typography: IBM Plex Sans for body/labels, IBM Plex Mono for code/scores
- Sidebar: Carbon-style left nav — dark background (`#161616`), white text, blue active state (`#0f62fe`)
- Top header bar: Carbon Shell Header pattern (`#161616`)
- Buttons: Carbon primary (`#0f62fe`), secondary (`#393939`), danger (`#da1e28`)
- Cards/panels: Carbon Tile pattern — white surface, `1px solid #e0e0e0`, no border-radius or `2px` max
- Data tables: Carbon Data Table style — `14px` IBM Plex Sans, zebra stripes (`#f4f4f4`)
- Status tags/badges: Carbon Tag colors — green (positive/pass), red (fail/danger), blue (info), gray (neutral)
- Score rings/progress: Carbon progress indicator style; use `#0f62fe` for primary, `#42be65` for good, `#f1c21b` for warning, `#da1e28` for critical
- Notifications/alerts: Carbon Inline Notification style — left color border, icon, message
- No external CSS framework — all styles stay in the existing inline `<style>` block in `app/workbench-ui.tsx`
- Responsive: same breakpoints as today; no layout regression

**IBM Color Palette (Carbon 10 — white theme)**
```
Background:         #ffffff
Layer 01:           #f4f4f4
Layer 02:           #e0e0e0
Border subtle:      #c6c6c6
Border strong:      #8d8d8d
Text primary:       #161616
Text secondary:     #525252
Text placeholder:   #a8a8a8
Interactive:        #0f62fe   (primary blue)
Interactive hover:  #0353e9
Focus:              #0f62fe
Danger:             #da1e28
Danger hover:       #b81921
Warning:            #f1c21b
Success:            #24a148
Tag blue:           #d0e2ff / #0043ce
Tag green:          #defbe6 / #0e6027
Tag red:            #fff1f1 / #750e13
Tag gray:           #e0e0e0 / #525252
Sidebar bg:         #161616  (Carbon Gray 100)
Sidebar active:     #0f62fe
Sidebar hover:      #262626
Header bg:          #161616
```

**IBM Typography**
```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
--font-sans: 'IBM Plex Sans', sans-serif;
--font-mono: 'IBM Plex Mono', monospace;
```

**Key Component Patterns**
- Sidebar: `width: 256px`, `background: #161616`, nav items `48px` tall, active item has `4px` left blue border + blue background tile
- Header: `48px` height, `background: #161616`, product name in white IBM Plex Sans 16px medium
- Content area: `padding: 32px`, max-width `1584px` (Carbon max-width)
- Primary button: `height: 48px`, `background: #0f62fe`, `border: none`, `padding: 0 64px 0 16px`, no border-radius
- Input fields: `height: 40px`, `border: none`, `border-bottom: 1px solid #8d8d8d`, `background: #f4f4f4`
- Section headers: uppercase label style `12px` `#525252` `letter-spacing: 0.32px`

**Files to Edit**

| File | Change |
|------|--------|
| `app/workbench-ui.tsx` | Replace entire `<style>` block with IBM Carbon-based CSS; update className references where needed; load IBM Plex fonts in style block or via `@import`; update icon choices to match Carbon iconography where lucide has equivalents |
| `frontend/index.html` | Add `<link>` for IBM Plex fonts preconnect (performance) |

**Files to Create**
None — keep all styles inline (existing pattern).

**Todo List**
- [ ] Design the full CSS replacement in `app/workbench-ui.tsx` — replace `<style>` block with IBM Carbon tokens, typography, layout, sidebar, header
- [ ] Update button classes to Carbon style (no border-radius, Carbon heights, correct colors)
- [ ] Update card/tile classes to Carbon Tile pattern
- [ ] Update data tables to Carbon Data Table style
- [ ] Update status tags/badges to Carbon Tag colors
- [ ] Update score indicators to use IBM blue/green/yellow/red scale
- [ ] Update notification/alert components to Carbon Inline Notification style
- [ ] Add IBM Plex font `<link>` preconnect to `frontend/index.html`

**Relevant Context**
- `app/workbench-ui.tsx` — the entire `<style>` block (search for `<style>` tag; it is a large inline CSS block inside the TSX)
- IBM Carbon Design System reference: https://carbondesignsystem.com

---

## Suggested Implementation Order

```
Sub-Task UI (IBM Reskin)          — do first alongside Rebrand
Sub-Task 0  (Rebrand)             — no deps, do first
Sub-Task 1  (Perplexity)          — no deps
Sub-Task 3  (Dashboard tab)       — no deps, pure frontend
Sub-Task 4  (Site Crawler tab)    — no deps, pure frontend
Sub-Task 8  (PDF/print)           — no deps
Sub-Task 9  (CSV wizard)          — no deps
Sub-Task 12 (AI Monitor)          — no deps
Sub-Task 10 (Viewer access)       — no deps
Sub-Task 6  (Query Universe)      — minor API + frontend
Sub-Task 7  (Contentful)          — independent
Sub-Task 11 (Playwright)          — independent
Sub-Task 2  (Scheduler)           — needs DB migration v2
Sub-Task 5  (Alerts)              — needs DB migration v3, must follow v2
```
