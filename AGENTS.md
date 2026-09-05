# AlphaTopology — Agent Briefing

AI hardware supply-chain intelligence engine: graph model of the physical
Energy → EDA/Materials → WFE → Foundry → Packaging → Test → ODM → Data-Center
pipeline, a FastAPI market-data backend, and a Next.js terminal dashboard.

Read `CLAUDE.md` for the full layout and invariants — it is the canonical
project doc and applies to every agent, not just Claude. Key rules:

1. **Physical Reality Rule** — signals propagate along graph edges with
   physical `lead_time_days`; quarter lags clamp to [1, 4].
2. **Deterministic Schemas** — all outputs validate against
   `src/alphatopology/models.py` (Pydantic) / `data/topology_schema.json`.
   Keep the two in sync when either changes.
3. **Graceful Failures** — non-US tickers use Yahoo suffixes (`4063.T`,
   `2317.TW`, `000660.KS`); missing data becomes `null` + `live: false`,
   never fabricated values.
4. **Research only** — no brokerage/order-execution code anywhere.
5. **Real vs fixture** — quote/history/forecast data is live (yfinance).
   `PHYSICAL_PROXIES` in `src/alphatopology/market.py` are labeled fixture
   estimates; keep the `FIXTURE_ESTIMATE` labeling in any UI that shows them.

## Quick start
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn api.main:app --port 8000        # market/graph API
cd dashboard && npm install && npm run dev         # terminal UI on :3000
.venv/bin/python scripts/query_topology.py --chokepoints   # smoke test
```

`data/live_telemetry.json` is generated (`scripts/ingest_metrics.py`) and
gitignored; `dashboard/data/live_telemetry.json` is a committed fallback
snapshot the dashboard needs at build time — refresh it deliberately.
Never commit `.env` (holds `FMP_API_KEY` etc.).
