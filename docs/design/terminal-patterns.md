# Terminal Patterns — implementable spec

Mechanics extracted from `reference-board.md`, in implementation order.
Everything renders in the Culturas skin (`DESIGN-BIBLE.md` governs type,
color, surfaces). This file grows a section per pattern as each lands.

## 1. Command palette (implemented)

The Bloomberg insight: the terminal is *addressed*, not navigated.

- **Invocation:** ⌘K / Ctrl+K anywhere; also the masthead search chip. Esc closes.
- **Grammar:** `QUERY [CODE]`
  - `QUERY` fuzzy-matches ticker, then name (rank: ticker prefix > ticker
    substring > name substring). Enter selects the entity everywhere (shared
    selection context) and opens the inspector on small screens.
  - `CODE` (last token) jumps views: `g|graph`, `m|map`, `geo`, `led|ledger`.
    Bare codes switch view without changing selection.
  - Examples: `nvda` → select NVIDIA · `nvda geo` → select + globe ·
    `map` → map view.
- **Rows are monitor-grid DNA** (TradingView): role dot, ticker in mono,
  name muted, **live price + signed change right-aligned in tabular
  numerals** — color spent only on the signed value.
- **Keyboard:** ↑/↓ move, Enter commits, everything reachable without a mouse.
- **Deep links:** selection and view write `#TICKER/view`; the hash restores
  on load — every state is addressable (Bloomberg function-code equivalent).
- Recent selections shown when the query is empty (muscle-memory loop).

## 2. Monitor grid home (next)

Answer-first landing surface: watchlist table with preset column lenses
(Overview / Physical / Valuation / Forecast), sparkline column, tabular
numerals, semantic-only color. See reference-board §2/§6.

## 3. Ambient verbs: Watchlist · Alert · Compare (planned)

Pinned on every entity surface (stockanalysis §4). Alerts creatable from any
number in one click.

## 4. Session heat mode on the map (planned)

Color-by toggle: role ⇄ live signed change, Finviz-style, legend always
visible when color carries data.
