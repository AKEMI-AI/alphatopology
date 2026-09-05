# Testing Strategy

## Test pyramid

- **Unit tests:** graph invariants, lag calculations, provider normalization,
  fixture ingestion, signal generation, and time-series formatting.
- **Integration tests:** FastAPI response contracts, source/freshness metadata,
  data-pipeline fallback behavior, and schema validation.
- **Frontend checks:** ESLint, strict TypeScript, production build, focused
  component interactions, and later accessibility/visual regression.
- **End-to-end tests:** a small number of critical terminal workflows after the
  API and canonical store stabilize.

## Required cases

1. Missing provider data produces null plus an explicit non-live state.
2. Partial primary-provider results fall back per ticker and preserve source.
3. Fixture estimates cannot lose their source label.
4. An observed capacity shock generates deterministic downstream signals;
   absent or sub-threshold observations do not.
5. Intraday bars retain unique timestamps while daily bars use date keys.
6. Every topology edge references a unique known node and the graph is a DAG.
7. API responses validate against their consumer contract.
8. Backtests, once added, enforce `known_at <= decision_at` for every feature.

## Quality targets

- Business-critical graph, provenance, signal, and ledger modules: at least 90%
  branch coverage once coverage reporting is introduced.
- Other backend modules: at least 80% line coverage.
- No global frontend coverage target until component boundaries stabilize;
  require interaction tests for every material user action.
- CI must stay fast enough for every pull request; move slow provider and E2E
  suites to scheduled jobs rather than skipping deterministic checks.
