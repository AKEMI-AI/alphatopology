# The Completeness Map — what a full AI-industry repository contains

The target: the financial, business, and key-person repository of artificial
intelligence — the flow of money, power, and talent through the whole stack,
navigable through toggled lenses. This file is the ontology contract; each
tier becomes schema + data + a lens when built.

## Current ontology (v2, shipped)
- **Companies** (public + private): 72 nodes — supply chain, labs, neoclouds,
  robotics, hyperscalers, one capital conglomerate.
- **Edges**: physical supply (lead times) + capital/compute commitments ($B).
- **Country / export-control / telemetry** annotations.

## Missing tiers, in build order

### 1. People — the key-person graph (highest value, lowest data cost)
The industry runs on ~200 individuals. New entity kind `PERSON` with edges:
`LEADS`, `FOUNDED`, `BOARD_OF`, `INVESTS_VIA`, `DEPARTED_FOR`.
- Executives (Huang, Su, Altman, Amodei, Musk, Son, Wennink→Fouquet, Wei…),
  founders, and the researcher diaspora (OpenAI → Anthropic/SSI/Thinking
  Machines lineage is the industry's real org chart).
- **Talent flow is the second money flow** — departures predict new nodes.
- Sourcing: public record; hand-curated (this is moat, not drudgery).
- Lens: "People" — org constellations; select a person → every board seat,
  stake, and lineage edge lights up.

### 2. Capital entities — funds, sovereigns, CVCs
`FUND` entities: a16z, Sequoia, Thrive, Founders Fund; sovereigns (PIF,
Mubadala, GIC, Temasek); CVC arms (NVentures, M12, GV); crossovers.
AUM/fund-size as weight. Completes the money-flow picture — today we only
see corporate-to-lab flows.

### 3. The deal ledger — events with dates (unlocks time itself)
Rounds, M&A, IPOs, partnerships, capex announcements, export-control
actions as dated `EVENT` records referencing nodes/edges. Enables:
- **Time lens**: scrub the industry by date; watch the graph grow.
- Event annotations on price charts; "what changed this week" home feed.
- The current static `amount_usd_b` edges become sums over dated deals.

### 4. Facilities — where the buildout physically lands
`FACILITY` entities: Stargate Abilene, xAI Memphis, hyperscaler regions,
fabs (TSMC AZ/Kumamoto), with MW, capex, status, coordinates. Ties the
energy tier to real sites; the globe gets ground truth instead of HQ pins.

### 5. Governments & public money
State actors as nodes: US (CHIPS Act flows, BIS), EU, Japan (Rapidus
subsidy), China (Big Fund III ~$47B). Public money is the largest
underrepresented flow; export-control data already half-covers the actors.

### 6. Model artifacts & the application layer
- `MODEL` records (GPT/Claude/Gemini/Llama lineages: release date, est.
  training compute) — links labs to silicon demand concretely.
- Application/revenue layer (where AI revenue actually lands vs where capex
  goes): the **bubble-sensemaking tier**. Even coarse: aggregate AI capex
  vs aggregate AI application revenue, by quarter.

### 7. Bubble metrics — computed, not collected
Once 2–6 exist, derive: capex-to-revenue ratio by tier; **circularity
index** (money loops like NVDA→OpenAI→Oracle→NVDA are already visible as
graph cycles — measure them); concentration indices; private-valuation-to-
revenue multiples. These become a "Bubble" dashboard panel with honest
methodology notes.

## The lens system (UI contract)

One **lens bar**, consistent across Graph/Map/Geo views — lenses recolor
and reweight the same entities rather than being separate pages:

| Lens | Encodes | Status |
|---|---|---|
| Role | basket colors | shipped (default) |
| Session | live % change heat | spec'd (terminal-patterns §4) |
| Money | capital edges + weights | data shipped; dedicated lens pending |
| Chokepoint | authority intensity | shipped on Geo; generalize |
| Controls | export-control regimes | shipped on Geo; generalize |
| People | person constellations | needs tier 1 |
| Time | date scrubber | needs tier 3 |

## Sourcing honesty
Prices/fundamentals: feeds (licensed later). Deals/people/facilities: **no
good free API exists** — Crunchbase/PitchBook licenses are expensive; the
public record (filings, press, wikis) is free but manual. Hand-curation is
the defensible asset; the copilot can draft entries from public sources
for human confirmation (curation pipeline, not autopilot).

## Order of operations
People (1) → deal ledger (3) → lens bar with Money + Session → facilities
(4) → governments (5) → bubble metrics (7). Each is one PR-able unit
against this contract.
