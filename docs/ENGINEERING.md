# Engineering Readiness — the path from prototype to product

For the incoming backend/infra engineer, and the standing rules that keep
AI-assisted development reviewable. Status: research prototype, single-user,
local. Nothing here blocks prototyping; everything here gates launch.

## What is already solid (keep)

- **Typed contract at every boundary**: JSON Schema + Pydantic for the graph,
  typed API responses, TS interfaces in `dashboard/lib/api.ts`. This is the
  spine — never let untyped data cross a boundary.
- **Data provenance discipline**: live vs fixture vs estimate is labeled in
  data and UI. Preserve this property through every refactor.
- **Graceful failure rule**: missing data → null + flag, never fabricated.
- **CI** (this PR): schema validation, graph integrity, dashboard build on
  every PR. Grow it; never skip it.
- Multi-agent process: branches, cross-review, AGENTS.md contract.

## Launch-gating work, in priority order

### 1. Auth & tenancy (backend engineer's first project)
- FastAPI currently has **zero auth** and localhost CORS. Do not expose it.
- Recommendation: managed auth (Clerk/Auth0/Supabase Auth) over hand-rolled;
  session JWT verified in FastAPI middleware; per-user rows in Postgres.
- The paper book (SQLite, single-tenant) becomes per-user tables in Postgres.
  `simulator.py` is deliberately small — port it, don't grow it first.

### 2. Data licensing (the commercial wall)
- yfinance = unofficial Yahoo. **Fine for personal research; not licensable
  for a commercial product.** Before any paid launch: licensed vendor
  (Polygon / FMP / similar), server-side only, with the vendor adapter
  pattern already stubbed in `scripts/ingest_metrics.py` promoted into
  `market.py` as a provider interface.
- Copilot: per-user API-key handling or metered server key with quotas.

### 3. Secrets & config
- `.env` is gitignored; keep it that way. Production: secret manager
  (never env-in-repo), separate keys per environment, key rotation story.
- Add `pydantic-settings` config object instead of scattered `os.getenv`.

### 4. Persistence & jobs
- SQLite → Postgres (users, books, alerts, watchlists). DuckDB/Timescale
  for time series when the ingest cadence grows.
- The 60s SWR cache is in-process; multi-instance deploy needs Redis (or
  accept per-instance caches — decide, don't drift into it).
- Scheduled ingest (cron/worker) instead of request-triggered refresh.

### 5. Observability & ops
- Structured logging (request ids), Sentry (both apps), uptime checks,
  and a `/healthz` that verifies feed freshness — "API up but data stale"
  is this product's characteristic failure.
- Rate limiting on every public endpoint (slowapi/nginx) before exposure.

### 6. Testing debt (highest-value first)
- Unit: `simulator.py` P&L math (property tests), `topology.py` traversals,
  quarter-lag clamps, palette grammar parser.
- API contract tests against the typed responses.
- One Playwright smoke: load → select node → switch views → fill paper order.

## Standing rules for AI-built code (the vibe-coding contract)

1. **No direct commits to main; CI green before merge; cross-review**
   (Claude ↔ Codex ↔ humans) per AGENTS.md.
2. **Schema-first**: any new data crosses a Pydantic/TS type or it doesn't
   ship. Schema changes touch `topology_schema.json` + `models.py` together.
3. **Every external call wrapped**: timeout, typed failure, null-not-fake.
4. **Secrets never in code, prompts, or fixtures.**
5. **Docs are contracts**: `docs/design/*` and this file are what agents
   build against — change the doc in the same PR as the behavior.
6. **Small PRs from here on.** The ux-redesign mega-branch was bootstrap
   mode; steady state is one feature per branch.
7. Financial-tool red lines (also in AGENTS.md): no real-order execution
   code, simulation labeled as simulation, no fabricated data, advice
   disclaimers on copilot surfaces.
