# AlphaTopology

AlphaTopology is an AI-hardware and semiconductor intelligence terminal. It
models the physical Energy → EDA/Materials → WFE → Foundry → Packaging → Test
→ ODM → Data-Center supply chain, combines that topology with market data, and
turns upstream constraints into traceable research signals.

## Repository map

- `src/alphatopology/` — schemas, graph engine, data adapters, and research pipeline
- `api/` — FastAPI query layer
- `dashboard/` — Next.js terminal interface
- `data/` — topology schema and seed universe
- `scripts/` — ingestion and graph-query entry points
- `tests/` — deterministic unit and contract tests
- `docs/` — product architecture, roadmap, testing, and collaboration workflow

## Quick start

```bash
python3.11 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest
.venv/bin/uvicorn api.main:app --port 8000
```

In a second terminal:

```bash
cd dashboard
npm ci
npm run dev
```

## Data trust

Market prices currently come from yfinance and may be exchange-delayed.
Physical supply-chain telemetry is explicitly labeled `FIXTURE_ESTIMATE` until
licensed industry feeds are integrated. Missing observations remain null; the
application must never fabricate live values.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system boundaries and
[docs/WORKFLOW.md](docs/WORKFLOW.md) for the shared Claude Code/Codex process.
