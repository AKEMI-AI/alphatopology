# AlphaTopology — AI Hardware & Semiconductor Intelligence Engine

Institutional research index, node-graph dashboard, and multi-agent research
pipeline modeling the physical supply chain of AI hardware
(EDA → Materials → WFE → Foundry → Packaging → Test → ODM → Cooling/Power).

## Layout
- `data/topology_schema.json` — JSON Schema (draft-07) for the graph; the source of truth.
- `data/nodes_seed.json` — seed topology (24 nodes, 14 edges).
- `src/alphatopology/models.py` — Pydantic mirrors of the schema + `MacroSignal`.
- `src/alphatopology/topology.py` — NetworkX DiGraph loader and graph queries.
- `src/alphatopology/agents.py` — 4-agent pipeline (Ingestion, TransmissionLag, DislocationArbitrage, Orchestrator).
- `scripts/query_topology.py` — CLI: `--upstream <ticker>`, `--chokepoints`, `--lead-time`.
- `api/main.py` — FastAPI backend for the future Next.js dashboard (`uvicorn api.main:app`).

## Invariants
1. **Physical Reality Rule**: signals propagate along graph edges with physical
   `lead_time_days`; quarter lags clamp to `Q_lag ∈ [1, 4]` (`days_to_quarter_lag`).
2. **Deterministic Schemas**: every pipeline output validates against the Pydantic
   models; keep `models.py` and `topology_schema.json` in sync.
3. **Graceful Failures**: non-US tickers use Yahoo-style suffixes (`4063.T`,
   `2330.TW`, `000660.KS`); node `id` is the stable join key, never the ticker.
4. **Research only**: the pipeline emits `MacroSignal` research output and reports.
   It contains no brokerage/order-execution code, by design.

## Dev
- Python 3.11+ target; code is kept 3.9-compatible (`from __future__ import annotations`)
  because this machine currently has only 3.9. Venv: `.venv/`.
- `python scripts/query_topology.py --upstream NVDA` is the smoke test.
