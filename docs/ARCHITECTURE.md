# GEO Workbench architecture — v0.2.1

The standalone product is a modular monolith: React/Vite UI, a Node 24 HTTP composition root, application services, a framework-free domain core, and replaceable infrastructure adapters. SQLite supports one local machine or single VM. The exact earlier hosted React/Vinext + Worker/D1 edition is archived in `reference/`.

## Dependency boundaries

| Layer | Current responsibility | Replacement path |
| --- | --- | --- |
| `app`, `frontend` | Workspace, client selection, query collector, evidence view | Another UI consuming versioned HTTP APIs |
| `src/server/node-server.ts` | Composition, authentication, origin checks, request validation, adapter registration | Another HTTP framework or hosting runtime |
| `src/application/workbench.ts` | Client access, audits, manual observation import | Reuse against another repository |
| `src/application/observation-runner.ts` | Owner check, request replay, provider orchestration, immutable observation save | Invoke through a future durable worker |
| `src/core` | Client/evidence contracts, query generation, scoring, visibility | Stable domain with no React, database SDK, provider SDK or CMS dependency |
| `src/server/sqlite-repository.ts` | Repository and exact observation lookup ports | PostgreSQL adapter implementing both ports |
| `src/server/providers/openai-provider.ts` | Credentialed HTTP transport and Responses API parsing | More adapters implementing `AIProvider` |
| `src/adapters/d1-repository.ts`, `app/api` | Original hosted adapter reference; unused by standalone build | Wire a separate composition root deliberately |

Provider configuration lives only on the server. `/api/v1/providers` returns id, label, model and whether credentials were supplied. The application runner does not know API keys, HTTP vendor details or model-specific response schemas. Add a provider by implementing the port and registering it; scoring and client storage stay unchanged.

## Collection and persistence

A run accepts one prompt, provider ID and UUID request ID. The application checks client ownership before contacting the provider. A deterministic SHA-256 record ID scopes the UUID to the owner/client. Completed replays return existing evidence; active duplicate calls are rejected. Two requests may run concurrently per process. A successful provider response is stored atomically; failures do not create observations. The same SQLite schema remains compatible with v0.1.1 data. New optional provider metadata is stored in the existing JSON envelope.

The OpenAI adapter requests web search, caps generated output at 2,048 tokens and applies a 60-second deadline. It checks completed response/search status, preserves the model, original question, answer, citations, inline citation ranges, provider response ID and observation time. It does not inject a target brand into the query. Server credentials are never returned to the UI. No automatic retries, scheduler, currency budget or cross-process lease is implemented.

SQLite uses WAL, foreign keys, parameterized queries and transactions. Each read filters owner; application services verify client access before writes. List limits remain 100 clients and 200 latest records of each kind. JSON imports retain their manual source. Actual observations and imports share the same visibility calculation. Imported HTML is analyzed as inert text and discarded; the audit retains evidence findings, hash and rubric version.

## Authentication and deployments

Local mode binds to loopback and enforces a localhost Host header. Cloud mode requires Basic credentials and HTTPS at the reverse proxy. Writes require an allowed Origin, input schemas reject extra fields, and bodies are bounded. Identity is derived from configured authentication, not spoofable request headers. When moving a database between runtimes, preserve the owner username to retain access.

The portable server is the active composition root. The hosted Site is not changed by this release. Reference adapters are not automatically compatible with every new application port; for example, hosted collection needs its own observation lookup and secret registration before the new runner can be wired there.

## Evidence interpretation

Readiness uses five assessed HTML cue dimensions totaling 70% of the rubric; unknown dimensions stay null and are excluded from the normalized weighted score. Scores assess implementation cues, not ranking or content quality. Brand matching uses the canonical brand name and explicitly configured aliases, with case-insensitive Unicode boundaries and flexible whitespace between words. It does not guess aliases. Citation matching requires the client hostname or a true subdomain. API results and consumer search experiences are distinct samples. Current rates combine the latest 200 observations and are descriptive, not population estimates or causal impact.

## Next increments for scale

1. Introduce durable campaign/run/query records and a `JobQueue` adapter. Add bounded campaigns, provider budgets, worker leases, progress, cancellation, reconciliation of uncertain paid calls, retry classification and idempotency across processes.
2. Add independent provider adapters and surface/model filters. Preserve prompt versions, sampling settings and comparison cohorts.
3. Implement queued crawling with bounded capture, safe outbound networking and reproducible evidence snapshots.
4. Replace SQLite with PostgreSQL and add object storage when deploying multiple workers. Keep access checks in the application and owner filters in every storage adapter.
5. Add organization membership, roles, audit logs and CMS read/draft adapters. Use version preconditions and explicit publication authorization.

Move busy collection workers out of the HTTP process when measured load requires it. Do not call the current per-process concurrency set a distributed queue or assume SQLite and local authentication already support a multi-tenant cluster.

## Client identity correction

`ClientIdentityService` depends on `Repository` and `ClientIdentityStore` ports. The SQLite implementation atomically updates only the name, aliases and update timestamp with an owner-scoped query. It preserves the website, creation time and all child records. `POST /api/v1/clients/{id}/identity` validates a name and up to 10 aliases; unrelated field changes are rejected. Aliases are trimmed and deduplicated case-insensitively.

The dashboard recalculates mention rates against saved answers using the current identity; this is a matching correction, not new provider evidence or an increase in real-world visibility. Citation rates still depend on the unchanged client domain. Existing audit snapshots remain immutable. New audits use rubric `readiness-cues/1.1.0`, whose brand cue also recognizes aliases with word boundaries. Audits from earlier rubric versions should not be treated as a like-for-like score comparison without examining that rule change.
