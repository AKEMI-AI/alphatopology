# Product and System Architecture

## Product thesis

AlphaTopology is a Bloomberg-like terminal focused on the physical AI-hardware
supply chain. Its advantage is not breadth across every asset. It is depth:
industry-specific topology, explicit transmission lags, sourced operating
metrics, reproducible research, and a copilot that can explain every input.

The product supports four activities:

1. **Observe** prices, filings, physical constraints, events, and revisions.
2. **Investigate** the value-chain graph, peers, documents, and time series.
3. **Test** hypotheses through point-in-time forecasts and backtests.
4. **Simulate** strategies in an internal ledger and, after a separate safety
   decision, an external paper account.

Forecasts are uncertain research estimates, not facts or personalized advice.

## Current foundation

```text
Next.js terminal
      |
      | REST
      v
FastAPI query layer
      |
      +-- NetworkX physical-supply DAG
      +-- yfinance market adapter
      +-- deterministic research pipeline
      |
JSON Schema + Pydantic + committed seed/snapshot data
```

The current graph, UI, and API are an effective vertical prototype. The next
stage is to replace committed snapshots as the primary runtime store with a
versioned canonical data layer while retaining the graph model and interface.

## Non-negotiable invariants

1. **Physical reality:** signals propagate through graph edges with explicit
   `lead_time_days`; quarter lags clamp to `[1, 4]`.
2. **Deterministic contracts:** topology and signal data validate before
   publication. Pydantic models and JSON Schema stay synchronized.
3. **Point-in-time truth:** time-varying records distinguish `effective_at`
   from `known_at` to prevent look-ahead bias.
4. **Source lineage:** every displayed or derived value identifies its source,
   as-of time, units, and quality state.
5. **Graceful absence:** missing data is null and visibly stale/unavailable,
   never replaced with a plausible invented value.
6. **Fixture isolation:** physical proxy estimates always carry
   `data_source=FIXTURE_ESTIMATE` in storage, APIs, and UI.
7. **Research/execution separation:** no live brokerage credentials or order
   routing enter this application without an explicit architectural and
   security review. Current code remains research-only.

## Target shape

Begin as a modular monolith plus deterministic background workers. Do not split
into microservices until scale, security, or team ownership requires it.

```text
                       +--------------------------+
                       | Next.js terminal         |
                       | graph / grids / copilot  |
                       +------------+-------------+
                                    |
                           REST + WebSocket/SSE
                                    |
                       +------------v-------------+
                       | FastAPI application      |
                       | query / auth / commands  |
                       +--+----------+----------+--+
                          |          |          |
                 +--------v--+  +----v-----+  +-v-------------+
                 | Copilot   |  | Analytics|  | Simulation &  |
                 | tools     |  | engine   |  | risk          |
                 +--------+--+  +----+-----+  +-------+-------+
                          |          |                |
             +------------v----------v----------------v-------+
             | PostgreSQL + TimescaleDB + pgvector            |
             | canonical entities / series / docs / ledger    |
             +-------------------------+-----------------------+
                                       |
                          +------------v-------------+
                          | Scheduled data workflows|
                          | ingest / normalize / QA |
                          | features / forecasts    |
                          +--------------------------+
```

Deterministic workflows—not LLM agents—own refresh schedules, retries,
idempotency, validation, and freshness. Agents may classify documents,
summarize evidence, call typed analysis tools, and investigate exceptions.

## Canonical data layers

1. **Raw:** immutable provider payload, request metadata, checksum, received
   time, and license classification.
2. **Canonical:** issuer/security identifiers, bars, corporate actions,
   reported facts, estimates, documents, events, and industry telemetry.
3. **Derived:** ratios, graph features, forecasts, screens, peer statistics,
   and portfolio analytics.
4. **Presentation:** cached terminal views and pre-aggregations.

Provider-specific payloads never flow directly into the UI or copilot.
Adapters translate them into versioned canonical contracts.

## Core entities

```text
issuer -> security -> listing -> market_bar
issuer -> filing -> document -> document_chunk
issuer -> reported_fact -> metric_definition
issuer -> estimate / event / news_item / physical_observation
model -> model_version -> forecast -> forecast_evaluation
strategy -> strategy_version -> backtest_run
portfolio -> account -> order / fill / position_lot / cash_ledger
source_record -> provenance_link -> canonical_or_derived_record
```

## Copilot boundary

The copilot receives typed, permissioned tools rather than unrestricted SQL or
order access. Initial tools should resolve securities, retrieve series and
fundamentals, compare peers, search documents, run screens/scenarios, and
explain backtests. Answers state their data cutoff and distinguish reported
facts, calculations, fixture estimates, and model outputs.

Retrieved documents are untrusted content. They can supply evidence but cannot
change system instructions or tool permissions.

## Forecasting boundary

Start with calibrated probability distributions rather than a single opaque
price target. Candidate outputs include positive excess-return probability,
earnings/KPI surprise probability, volatility regime, and event-impact
distributions. Every model requires walk-forward validation, point-in-time
features, costs/slippage assumptions, calibration metrics, and a versioned
training cutoff.

## Simulation boundary

An internal simulator is the reproducible research layer. It must record fill,
latency, spread, slippage, fee, borrow, and corporate-action assumptions. A
future broker paper adapter tests authentication and order-lifecycle behavior;
it does not validate live profitability. Live execution is a distinct product
decision and remains out of scope.
