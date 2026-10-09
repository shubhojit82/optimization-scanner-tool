# Portable edition validation — October 5, 2026

- 12 domain/application tests pass.
- 6 provider/collection tests pass using injected HTTP fixtures and temporary SQLite databases.
- 4 standalone HTTP/storage/authentication integration tests pass.
- Strict client/server TypeScript checks pass.
- Portable React/Vite and Node server builds pass.
- SQLite persistence, owner filtering and transaction rollback pass.
- Original hosted source and its original validation notes remain in `reference/GEO_Workbench_Sites_Source.tar.gz`.

Testing ran on Linux with Node v24.19.0. Mac execution and Docker/Compose deployment were not tested in this environment. No browser visual verification is claimed. The supplied cloud configuration requires a hostname, valid DNS, inbound 80/443 and an edited `.env` before it can issue HTTPS and run.

The new provider flow verifies citation extraction, rejected credentials/quota failures, incomplete responses, missing web search, unsafe citation rejection, no fabricated observations, owner checks, concurrent request limits, completed-request replay, and HTTP origin/input validation. Live OpenAI calls were not tested because no API key was supplied. No credentials were requested in chat.

Six additional identity tests pass (28 total). They cover canonical and alias matching, whitespace and Unicode boundaries, literal regex characters, hidden HTML exclusion, owner-scoped atomic edits, deduplication, preservation of observations/old audit snapshots, persisted identities across SQLite connections, HTTP validation/origin rejection, and updated mention rates without changing citation rates.
