# The Culturas Visual Data System — master specification (v11)

> **What this file is.** The complete, portable specification of how
> Culturas speaks in diagrams, infographics, and data visualization —
> across the website, decks, print, and the product platform. Hand this
> file to ANY tool, designer, agency, or AI that produces Culturas visual
> work. If a visual contradicts this file, the visual is wrong.
>
> **Living sources of truth** (this file summarizes them):
> - Generators & laws: `design/diagram-kit/` (all plates are Python-generated;
>   SVGs are never hand-edited)
> - Symbol & lexicon: `design/culturegraph-symbol.md`
> - The rendered guide: `design/visual-system-guide.html`
>   (published artifact: claude.ai/code/artifact/64b141a5-36f6-4ac6-a8b6-ea99370ef71c)
> - Brand canon: `docs/design.md` + the `culturas-brand` skill (overrides all)

---

## 1. The palette (locked — no new hues, ever)

| Role | Name | Hex |
|---|---|---|
| Ground | Stone white | `#F2F0EC` |
| Ink | Warm noir | `#1A1418` |
| Brand dark surface | Matte black (the Grain) | `#101013` |
| The voice (ONE focus per view) | Signal magenta | `#F0257E` |
| Technology / live | Live lime | `#C9F227` |
| Trust / instrument metal | Burnished gold | `#9A7B2F` |
| Dormant / membranes | Oxidized plum | `#4A3848` |

**The spectrum** (data roles only — never chrome, never fields):
magenta · identity — lime · technology — violet `#8B5CF6` · society —
orange `#FF8A2A` · economy — amber `#F5C518` · environment — coral
`#FF5A3C` · change.

**Platform UI register exception:** the product's primary is ORANGE
`#FF8A2A` (CTA gradient orange→amber). Marketing voice stays magenta.

## 2. Law zero — legibility

Legibility beats everything. **No text may ever be covered, crossed, or
crowded**: no line, leader, ribbon, pill border, or dot touches a text
box; no text over text; no words cut off by a canvas edge; breathing room
between neighboring labels. Labels that must sit over fields (network
hubs, flow columns, maps) carry a knockout halo
(`paint-order="stroke"; stroke: var(--halo)` = the surface color).
Every generated plate must pass `design/diagram-kit/lint_legibility.py`
(text/text, line/text, ribbon/text, dot/text — z-order aware) with
`ALL CLEAN` before it ships. Human double-pass on top of the machine pass.

## 3. The Eleven Laws (compressed)

1. **Structure is currentColor** at bold weights (1.4px default stroke) —
   plates adapt to light/dark via the wrapper's ink color.
2. **Gold eyebrows** label sections; gold = trust and the instrument.
3. **One gold authority per cluster**; trust is the gold circle.
4. **Canon colors verbatim** — no tints, no new hues.
5. **One magenta focus per view**, allowed one bloom.
6. **Chips before the graph, nodes inside it** (chips = raw signal;
   nodes = structured meaning).
7. **The Sphere of Signal is the ONLY drawing of the CultureGraph**;
   the glyph is its small-scale form.
8. **Dashed = instrument, solid = culture; circles only** — dots are
   never squares; periods on display type are circular
   (`.dot` CSS class in HTML; magenta bullet tspan in SVG).
9. **One transformation per diagram, real numbers only**
   (12.4M signals/day · 3,800+ worlds · 480K creators · 62 categories).
10. **Glass/liquid lives inside plates only** + registration frames
    (corner dots + gold plate code, e.g. `CV · 00`).
11. **No orphan marks; size encodes magnitude** — every dot, ring, and
    line means something, and bigger = more.

## 4. The mark hierarchy

person (solid rounded figure) → node → **cluster mark** (one ring) →
**Culturegraphic mark** (nested rings; size = hold) → region (dashed
lens) → **the Sphere** (fib-lattice network on a sphere: faint signal
nodes, few gold authorities, 1–2 living-edge nodes magenta/lime, dotted
measuring halo). The **glyph stamp** (liquid-gradient seal) marks
territory. The glyph works at 24px; the Sphere never shrinks below ~300px.

## 5. Surfaces & finishes

- **Liquid Edge** — the neon border: conic gradient
  magenta→gold/orange→lime on a transparent border (cards 2.2–2.6px,
  hero tiles ~3px, stamps heavier), inner 1px white glass rim, 18s
  rotation (reduced-motion safe). Cards, tiles, framed figures — never
  body text.
- **The Grain** — matte black `#101013` + white-alpha turbulence +
  drifting liquid-metal sheen. Brand-moment surfaces only.
- **Metal buttons** — matte black capsule, liquid rim, top sheen.
- **Dot wheels & dot lines** — radial dot wheels and repeating
  magenta/gold/lime dot lines as ornament (never data).

## 6. Lines & dots carry meaning

- **Semantic lines:** a line is drawn like the information it carries —
  emerging = thick, glowing, energy dots coursing, ends in a pulse;
  stabilizing = settles to a steady rail; new wave = surges late;
  fading = thins and dissolves into dots.
- **Heat-map dots (maps):** on terrains/topographies, dots are circular
  heat readings — radius encodes the value, soft ~2.1× halo under a
  solid core. Never uniform confetti.

## 7. Typography

Inter Tight everywhere (system carries hierarchy by size/spacing, not
weight-shouting). Instrument Serif *italic* solely for the poetic
register (orbit names, aphorisms, the magenta italic word). Gold
eyebrows: 13–18px, letter-spacing ~.18em, uppercase. Captions: one line
stating the claim, ~64% ink. Display headlines end in a circular period.

## 8. The four registers (one grammar, four dresses)

- **Web:** stone ground, liquid edges, neon accents — the primary voice.
- **Deck:** the web aesthetic (clean white + neons); plates D1–D6.
- **Paper:** archival parchment register — print/PDF only.
- **Platform (UI):** translucent glass panels, orange primary, plates
  P1–P8; product motion = live code recorded (Remotion), never AI video.

## 9. The plate library (all generated, never hand-drawn)

- **Numbered 01–10:** pipeline, sharpness, evidence, delivery, mapscan,
  wrong read, home pipeline, signal layers, cell drilldown (the
  benchmark — lens-chain grammar).
- **Symbol:** sphere · glyph · extraction · anatomy (mock).
- **Platform P1–P8:** propagation, momentum, topography, attention
  ecology, loop, identity ecosystem, terrains (3), dimensions (CV·00).
- **Deck D1–D6:** compounding loop, stack, lineage, wedge, ask-the-graph,
  every-signal.
- **Forms F1–F4:** category network, the flow, the projection, memory
  spiral.

## 10. Producing new work — the only workflow

1. Diagrams are **generated from Python** (`design/diagram-kit/*.py`),
   deterministic seeds — never hand-edited SVGs, never AI-image diagrams.
2. Regenerate → `python3 lint_legibility.py` must print **ALL CLEAN** →
   visual double-pass → re-inline into the guide → export.
3. Web embeds are **byte-exact**: components ship via
   `design/lovable-export/` (code-editor or GitHub — the AI never
   rewrites an SVG). Wrapper contract: the figure sets `color` to the
   surface ink (`#1A1418` light / `#F2F0EC` dark) AND `--halo` to the
   surface background.
4. New diagram types must be modeled on the Cell Drilldown lens-chain
   grammar and obey every law above; when in doubt, the guide artifact
   is the reference rendering.
5. Motion: entrance reveals ~1s `cubic-bezier(.22,1,.36,1)`, 110ms
   staggers, reveal once, always reduced-motion safe.

## 11. Never

AI-generated diagram images · hand-tweaked SVG exports · square dots ·
new hues or tinted palette drift · spectrum colors as chrome · two
spheres on one page · a plate placed without a claim to prove · text
over anything, anything over text · camel/beige grounds on the web ·
decorative marks with no meaning · Lovable output pasted into this repo.
