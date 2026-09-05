# Terminal Reference Board — curated 2026-09-05

Live-captured survey of the dashboards that have worked in financial
intelligence, distilled to the mechanics worth adopting. Companion to
`depth-globe-map-patterns.md`; feeds the forthcoming `terminal-patterns.md`
spec. Patterns only — we implement everything in the Culturas skin, never
imitate anyone's visual identity.

---

## 1. Finviz — the map view (finviz.com/map.ashx) · live-captured

The canonical market treemap: **size = market cap, color = signed daily
change**, three-level nesting (sector → industry → ticker) with labels that
scale with tile size so the biggest names read first.

**Observed:**
- One glance answers "what moved today and how big is it" — no interaction needed.
- View-mode rail on the left: Map / Bubbles / Matrix — same data, three geometries.
- Hover = detail card + a new AI one-liner ("Why is it moving") per tile.
- Wheel zooms, double-click opens the entity; the color scale legend (-3%…+3%) is always visible.

**Adopt:**
- A **color-by toggle on our Map view**: current mode (role colors) ⇄ "session"
  mode where circle stroke/fill intensity encodes live % change. One toggle,
  the whole thesis becomes a daily heat read.
- Hover one-liners on nodes: telemetry status + change in a sentence.
- Always-visible color legend when color carries data.

## 2. TradingView — screener & alerts (tradingview.com/screener) · live-captured

8,133 rows scrolling at full speed. The best modern expression of terminal
density.

**Observed:**
- **Right-aligned tabular numerals everywhere**; color used *only* for signed
  values (+green/−red); units (USD) in a muted small cap after the number.
- Column-preset dropdown ("Overview" → Performance, Valuation, …) — one table,
  many lenses, user never rebuilds columns by hand.
- View-mode toggle: dense table ⇄ sparkline rows ⇄ cards.
- Filters live as removable chips with a count badge, not buried in a form.
- (Known from product) Alerts are created from any price level in one click
  and managed in a single rail; alert lines are draggable on the chart.

**Adopt:**
- The **monitor grid** for our watchlist/home: preset column lenses
  (Overview / Physical / Valuation / Forecast), tabular numerals, semantic-only
  color, sparkline column.
- Filter chips with counts (we already half-have this in the basket chips).
- Inline alert creation from any number.

## 3. OpenBB — the workspace (openbb.co) · live-captured

**Strategic note: OpenBB open-sourced its entire product suite (Aug 25 2026,
permissive license).** Their workspace is now a *legally adaptable codebase*,
not just visual inspiration — worth a dedicated evaluation pass.

**Observed:**
- Widget-grid dashboards where every widget binds to a shared symbol context
  (change the ticker once, every panel follows) — our `activeTicker` focus
  coupling, validated as the professional pattern.
- Tabbed workspaces per analysis mode: Overview / Financials / Technical /
  Comparison / Ownership / Calendar / Estimates.
- **Copilot embedded in the workspace**, answering with step-by-step reasoning
  and structured tables inline — the AI is a panel among panels, not a separate
  chat product. Their pitch: "dashboards that analysts and AI agents can use
  together."
- Data-source agnosticism as identity: any vendor/CSV/DB/API into one surface.

**Adopt:**
- Widget/panel architecture with shared symbol context when we outgrow the
  fixed inspector; tabbed lenses on the entity page.
- Copilot answers rendered as structured panels (tables, mini-charts), not
  only prose — our copilot's tool outputs are already structured JSON.
- **Action:** evaluate their open-source workspace repo for adoptable
  components/patterns before building our own widget grid from scratch.

## 4. stockanalysis.com — the entity page (·/stocks/nvda) · live-captured

The cleanest single-security page on the public web.

**Observed:**
- Price hero: giant tabular figure + signed change + after-hours quote — the
  answer first, everything else below.
- Horizontal section tabs (Overview / Financials / Forecast / Statistics /
  Metrics / Dividends) — the whole company is one navigable page, not a maze.
- The three verbs pinned at top: **Watchlist · Alerts · Compare.**
- Period pills (1D…Max) directly under the chart; zero chrome elsewhere.

**Adopt:**
- Our inspector's eventual full-page form: price hero → tabs → three verbs.
- "Compare" as a first-class action (two nodes side-by-side — upstream vs
  downstream is *our* native comparison).

## 5. Bloomberg Terminal — the canon (patterns from documented practice)

Not visitable; the patterns are well documented and stable for decades.

- **The command line is the interface**: `NVDA <Equity> GP <GO>` — every
  screen addressable by mnemonic; muscle memory beats navigation. → our ⌘K
  palette with function codes (`up`, `dis`, `geo`, `sim`).
- **Launchpad**: user-composed multi-panel layouts that persist per workflow;
  panels link on a shared security context (their "group" colors literally
  wire panels together — selection coupling made visible).
- **Function-code deep links**: a screen = entity + lens. Ours should be
  URL-addressable: `/n/NVDA/upstream`, `/view/geo?focus=TW`.
- Density norms: 4-up/6-up grids, every panel titled, zero decorative pixels;
  color = semantics (amber = editable field, red/green = signed data).

## 6. Koyfin — dashboards (koyfin.com) · visited, marketing-only capture

Known product patterns (verify in-app when we have an account): analyst-grade
**comparative charting** (multi-ticker ratio/spread charts with recession
shading), dashboard tiles composed from a chart library, "My Dashboards" as
the landing surface, watchlists with sparklines + grouped fundamentals
columns. The modern middle ground between Bloomberg density and consumer
legibility — closest overall aesthetic ancestor for our monitor grid.

---

## Distilled: the ten patterns that recur across every winner

1. Answer-first surfaces (what changed / how big) — zero interaction required.
2. Command line / palette as primary navigation; screens addressable by code.
3. One shared selection context; every panel follows it.
4. Tabular numerals, right-aligned; color spent **only** on signed data & alerts.
5. Preset column/view lenses instead of user-built configuration.
6. Size-encodes-magnitude geometry views (treemap/bubbles) beside tables.
7. Watchlist · Alert · Compare as ambient verbs on every entity.
8. Sparklines inline wherever a number has a history.
9. Copilot embedded as a structured panel, not a separate chat.
10. Persistent user-composed layouts (the Launchpad idea) — the end-state, not the start.

**Build order against our roadmap:** command palette (2) → monitor-grid home
(1,4,5,8) → alerts + compare verbs (7) → session color-mode on the map (6) →
copilot structured panels (9) → OpenBB-repo evaluation before any widget-grid
work (3,10).
