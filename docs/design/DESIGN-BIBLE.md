# Culturas — Design Bible

> **For Claude Code.** A single-file, copy-paste-ready specification of the Culturas visual, typographic, motion, and interaction system. Feed this file to Claude Code (or any agent) as the source of truth when designing or building anything Culturas-branded — landing pages, decks, product UI, docs, one-offs.
>
> _The website is the brand._ Every rule here is extracted from the running site (`culturaswebsite.lovable.app`). Live captures live in `docs/brand/assets/`. Font files live in `docs/brand/fonts/`.

---

## 0 · How to use this file with Claude Code

1. Drop this MD into the repo you want Claude Code to design in (e.g. `docs/DESIGN-BIBLE.md`).
2. Also copy the two font families (below) into that repo's `public/fonts/` or `assets/fonts/`.
3. Prompt Claude Code with: _"Design within `docs/DESIGN-BIBLE.md`. Never invent fonts, colors, or motion outside this file. Pull tokens from the CSS block in §5."_
4. When Claude Code proposes a screen, hold it against §12 (**Checklist**). If any item fails, reject.

Companion files in this repo:

- `docs/brand/culturas-brand-guidelines.md` — narrative brand doc (voice, palette, palette hex, cadence)
- `docs/brand/culturas-brand-guidelines.pdf` — cinematic HD PDF with live section captures
- `docs/brand/assets/` — 1920×1080 site captures + palette/type specimens
- `docs/brand/fonts/` — `GeneralSans-{300,400,500,600,700}.ttf`, `InstrumentSerif-{Regular,Italic}.ttf`

---

## 1 · Brand one-liners

| Surface | Line |
| --- | --- |
| Product | **The cultural data layer.** |
| Foundation | **Steward the story.** |
| Opening hero | **Culture, mapped.** |
| House aphorism | **Targeting is not understanding.** |

Voice: concrete verbs (_Map. Read. Act. Steward._). Say what the platform **reveals**, not what it _does_. One italic serif word per line, max — in magenta or gold.

---

## 2 · Fonts — the whole system is two families

### General Sans (Fontshare / Indian Type Foundry — Frode Bo Helland)

- **License:** SIL OFL (free commercial + personal)
- **Download:** https://www.fontshare.com/fonts/general-sans
- **Weights used:** 300, 400, 500, 600, 700
- **CDN:**
  ```html
  <link
    rel="stylesheet"
    href="https://api.fontshare.com/v2/css?f[]=general-sans@300,400,500,600,700&display=swap"
  />
  ```
- **Role:** UI, body, headlines, eyebrows, and the "mono" treatment (uppercase, letterspaced General Sans — we do **not** use a monospace family).

### Instrument Serif (Google Fonts — Rodrigo Fuenzalida)

- **License:** SIL OFL
- **Download:** https://fonts.google.com/specimen/Instrument+Serif
- **Styles used:** 400 regular, 400 italic
- **CDN:**
  ```html
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
  />
  ```
- **Role:** Wordmark, display titles, editorial pages, and the single italic accent word in sans+serif duets.

### Wordmark

- Wordmark literal: **`Culturas.`** — Instrument Serif 400. **The trailing period is part of the mark.**
- Never bold. Never drop the period. Never swap to a comma.
- On dark surfaces the period may render in `--gold` (`#9A7B2F`). On light surfaces the period stays ink.

### The three headline voices (never mix on one screen)

| Voice | Use it on | Type treatment |
| --- | --- | --- |
| **Bold sans** | Platform / Product / Enterprise | General Sans 700, tight tracking |
| **Sans + serif duet** | Home / Agencies / editorial | Sans 700 headline with one italic serif word (magenta or gold) |
| **Full serif** | Foundation / About / Manifesto | Instrument Serif 400, editorial rhythm, generous leading |

---

## 3 · Typography scale (locked)

| Role | Family | Weight | Size / Leading | Notes |
| --- | --- | --- | --- | --- |
| Display | Instrument Serif | 400 | `clamp(3rem, 8vw, 12.5rem)` / 0.95 | Hero titles, editorial |
| Headline | General Sans | 700 | `clamp(2.25rem, 6vw, 7.5rem)` / 1.0 | Platform / Enterprise |
| Sub-headline | General Sans | 600 | `clamp(1.5rem, 3vw, 3rem)` / 1.1 | Section titles |
| Duet accent | Instrument Serif italic | 400 | inline with sans | 1 italic word max, magenta or gold |
| Body | General Sans | 400–500 | **16px min** – 22px / 1.55 | Never `text-sm` for real copy |
| Eyebrow / Mono | General Sans | 500 | 11–14px · UPPERCASE · `letter-spacing: 0.24em` | Section tags, chart footers |
| Caption | General Sans | 400 | **11px min** / 1.4 | Micro |

**Legibility — non-negotiable**

1. Min body **16px**. Min caption **11px**. Never smaller.
2. On saturated fills, text is **ink or cream** — never the fill color itself. No magenta text on magenta.
3. Small text on dark glass = `text-cream`, not `cream/60`.
4. Fluid root font: `html { font-size: clamp(15px, 0.75vw + 13px, 17px); }`.

---

## 4 · Palette

Every color is a CSS variable. **Never hardcode hex in a component.** Copy the token block from §5.

### Grounds (allowed for large surfaces)

| Token | Hex | Role |
| --- | --- | --- |
| `--cream` | `#F2F0EC` | Stone white — default light ground |
| `--ink` | `#1A1418` | Warm noir — default dark ground |
| `--parchment` | `#ECE1C7` | Editorial aged parchment |
| `--parchment-deep` | `#D9C79D` | Parchment shadow |
| `--plum` / `--ink-soft` | `#4A3848` | Oxidized plum, support depth |

### Instruments (large-surface warmth)

| Token | Hex | Role |
| --- | --- | --- |
| `--gold-matte` | `#B5A06A` | Burnished matte gold |
| `--gold-matte-deep` | `#9A8A5A` | Matte gold shadow |
| `--terracotta` | `#E8783A` | Warm terracotta pop |
| `--terracotta-deep` | `#C95E32` | Deep burnt orange |

### Accents (NEVER full-bleed fields — one word, one rim, one hairline)

| Token | Hex | Role |
| --- | --- | --- |
| `--magenta` | `#F0257E` | Signal magenta — **the voice** |
| `--magenta-soft` | `#F76BA6` | Softened signal |
| `--gold` | `#9A7B2F` | Instrument metal — accent punctuation, dark-surface period |
| `--neon` | `#C9F227` | Live lime — kinetic accent, highlights only |

### Legend role mapping (locked — never remap)

- Belonging → **magenta**
- Ritual → **neon**
- Trust → **gold**
- Meaning → **cream / plum**
- Language → **magenta-soft**

### Forbidden combos

- Magenta ground with cream/white body copy.
- Neon ground with any body copy.
- Purple / indigo gradients on white (generic AI aesthetic — banned).
- Any hex literal in a component. Use tokens.

---

## 5 · CSS token block (copy verbatim)

Paste this into `src/styles.css` (or your global stylesheet) and load the two fonts from §2. Tailwind v4 users: it maps `--color-*` automatically.

```css
:root {
  /* Type */
  --font-display: "Instrument Serif", ui-serif, Georgia, serif;
  --font-sans: "General Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "General Sans", ui-sans-serif, system-ui, sans-serif;

  /* Grounds */
  --cream: #F2F0EC;
  --ink: #1A1418;
  --ink-soft: #4A3848;
  --plum: #4A3848;
  --parchment: #ECE1C7;
  --parchment-deep: #D9C79D;

  /* Instruments */
  --gold-matte: #B5A06A;
  --gold-matte-deep: #9A8A5A;
  --terracotta: #E8783A;
  --terracotta-deep: #C95E32;

  /* Accents */
  --magenta: #F0257E;
  --magenta-soft: #F76BA6;
  --gold: #9A7B2F;
  --neon: #C9F227;

  /* Semantic */
  --background: var(--cream);
  --foreground: var(--ink);
  --accent: var(--magenta);
  --ring: var(--magenta);
  --radius: 0.5rem;
}

.dark {
  --background: var(--ink);
  --foreground: var(--cream);
}

html { font-size: clamp(15px, 0.75vw + 13px, 17px); }
body { font-family: var(--font-sans); color: var(--foreground); background: var(--background); }
h1, h2, h3, .display { font-family: var(--font-display); font-weight: 400; letter-spacing: -0.01em; }
.mono { font-family: var(--font-mono); font-weight: 500; text-transform: uppercase; letter-spacing: 0.24em; }
```

---

## 6 · Liquid Glass — the signature surface

Every tech / data / platform surface uses one of these two grounds.

### Glass · frost (light)

Translucent card on a dark ground with a soft radial signal wash behind it. Neon lime allowed as italic accent only.

```css
.glass-frost {
  background: color-mix(in oklab, var(--cream) 88%, transparent);
  backdrop-filter: blur(24px) saturate(140%);
  border: 1px solid color-mix(in oklab, var(--ink) 8%, transparent);
  border-radius: 20px;
  box-shadow:
    inset 0 1px 0 color-mix(in oklab, white 60%, transparent),
    0 20px 60px -30px color-mix(in oklab, var(--ink) 40%, transparent);
}
```

### Glass · electric (dark)

Warmer glass with a holographic rim and a magenta hairline glow on the lower inner edge. Reserved for CTAs and hero moments.

```css
.glass-electric {
  background: color-mix(in oklab, var(--ink) 72%, transparent);
  backdrop-filter: blur(28px) saturate(160%);
  border: 1px solid color-mix(in oklab, var(--gold) 30%, transparent);
  border-radius: 20px;
  box-shadow:
    inset 0 1px 0 color-mix(in oklab, var(--gold-matte) 40%, transparent),
    inset 0 -1px 0 color-mix(in oklab, var(--magenta) 35%, transparent),
    0 30px 80px -30px color-mix(in oklab, var(--magenta) 25%, transparent);
}
```

### Data grids (behind glass)

- `.data-grid` — light mode, faint ink lines 8% at 32px cadence
- `.data-grid-dark` — dark mode, faint cream lines 6% at 32px cadence

### Liquid Metal CTA — the primary button system

Pill-shaped, glass surface, inset highlight top, neon or magenta rim below.

```tsx
// <LiquidMetalCTA variant="glass" | "electric">
// glass = frost pill with neon rim (default)
// electric = darker pill with magenta wash + gold hairline
```

Rules:

- Every primary CTA site-wide uses this component. Never hand-roll.
- Cream primary + glass secondary for dual-CTA hero moments.
- Height ≥ 48px, `padding: 14px 28px`, `border-radius: 999px`.

---

## 7 · Component patterns

### LiquidMetal Section Kit

Every page section composes from these:

- `<SectionShell>` — top/bottom padding rhythm (`py-[clamp(96px, 12vw, 220px)]`), ground handling
- `<Eyebrow tone="magenta|gold|neon">` — uppercase mono tag above titles
- `<PalletteDivider>` — 1px hairline that graduates cream → gold → magenta → plum
- `<LightupCard>` — glass card with scroll-triggered glow reveal

### Diptych (canonical before/after)

Frost card + palette divider + electric card. Each half carries:

1. Mono eyebrow
2. Serif title
3. `chip-*` tag
4. Viz (light on frost, dark on electric)
5. `stat-figure` KPI tiles
6. Mono footer with one bolded word

```
┌─ glass-frost ────────┐   ▬▬▬   ┌─ glass-electric ─────┐
│ eyebrow · title      │         │ eyebrow · title      │
│ chip                 │         │ chip                 │
│ viz (light)          │         │ viz (dark)           │
│ KPI tiles            │         │ KPI tiles            │
│ footer, **word**     │         │ footer, **word**     │
└──────────────────────┘         └──────────────────────┘
```

### CinematicVideoCTA (final CTA pattern)

Stadium-rounded card, full-bleed looping video, desaturated scrim, multi-hue neon halo bleeding **outside** the borders, centered display serif, two `LiquidMetalCTA` pills below. Halo variants: `spectrum`, `gold-neon`, `magenta-neon`.

### Cinematic scroll sequences

- **Culturegraph coalesce** — pixels scatter → migrate to Fibonacci sphere → wireframe globe with gold/magenta/neon accent nodes. Ends interactively over a Living / Cited / Threaded row.
- **Tile-fall opening** — spiral dissolve, not fade.
- **ScrollPhone** — 3D device pinned right, content scrolls left. Dark gradient behind copy for legibility.
- **CulturegraphSphere** — reusable constellation mark. See §5 role mapping for node colors.

---

## 8 · Motion language

- All motion is **scroll-driven** or **frame-driven**. Never CSS `animate-*` loops on substantive elements.
- **The Descent** — global scroll-motion module. Fade-up (0.3s) or spring-scale on entry. Never bounce.
- **Sequence hero videos** double-play (scroll-scrubbed second pass). Foundation and About both use this runway.
- **Hover on data**: nodes scale + glow gold, connected edges highlight, tilt parallax follows cursor.
- **SVG hygiene**: round coordinates to **3 decimals** — prevents hydration mismatch under SSR.
- **Reduce motion**: honor `prefers-reduced-motion` by disabling scroll-scrub and parallax; keep fade-ins.

---

## 9 · Layout & responsive

- Container: `max-w-[1400px]`, side padding `px-6 lg:px-10`.
- Section spacing: `py-[clamp(96px, 12vw, 220px)]`.
- Header rows on mobile: `grid-cols-[minmax(0,1fr)_auto]`, promote to `flex` at `sm:`.
- Every text container in a flex row: `min-w-0`.
- Every fixed-size icon/avatar in a flex row: `shrink-0`.
- Global overflow: `html, body { overflow-x: clip; }` (never `overflow-hidden` on `<body>`).
- Mobile audit: sticky stages must be tested at 375, 390, 430, 768, 1024, 1440, 1920.

---

## 10 · Interaction & UX rhythms (the "feel")

The site is meant to feel like _descending into a platform_, not scrolling a marketing page. To reproduce that feeling:

1. **Descent, not scroll.** Every section is a stage the visitor enters. Pin, reveal, resolve, release.
2. **Coherence-through-chaos.** Data always starts scattered (pixels, dots, tiles) and _cohere_ into a legible artifact (sphere, map, brief). This is the site's core metaphor — use it whenever you introduce a data concept.
3. **Live artifacts, not screenshots.** Prefer live SVG/canvas primitives over static PNGs. If a screenshot must appear, it lives inside a `ScrollPhone` frame with UI chrome.
4. **Interactive after resolution.** Once a coalesced object lands, it must be hoverable/clickable. Static end-states break the promise.
5. **Editorial pauses.** Break dense sections with a full-serif interlude (Instrument Serif, centered, one idea).
6. **Signature moments use magenta.** Everything else uses gold, neon, cream, plum. Magenta is scarce on purpose.
7. **CTAs are events.** Every primary CTA is a `LiquidMetalCTA`. Final page CTAs are `CinematicVideoCTA` with a halo.

---

## 11 · Voice — do / don't

**Do**

- Concrete verbs: _Map. Read. Act. Steward._
- One italic serif word per headline, max.
- Name the artifact: _brief, map, dashboard, API._
- Say what Culturas _reveals_.

**Don't**

- Purple/indigo gradients on white.
- Interchangeable hero/nav/footer layouts.
- Bold the wordmark or drop its period.
- Magenta as a ground with body copy on top.
- `text-sm` for anything a reader is expected to read.
- Static screenshots where a live SVG could stand in.

---

## 12 · Checklist — reject any screen that fails these

- [ ] Uses **only** General Sans and Instrument Serif — no third family.
- [ ] All colors reference CSS tokens — no hex literals in components.
- [ ] Magenta appears only as a single word, single rim, or single hairline — never as a ground.
- [ ] Body copy ≥ 16px. Captions ≥ 11px.
- [ ] On saturated fills, text is ink or cream.
- [ ] Every primary CTA is a `LiquidMetalCTA`.
- [ ] Every data surface is `glass-frost` (light) or `glass-electric` (dark) on a data grid.
- [ ] Every section has one clear stage: eyebrow → title → artifact → footer.
- [ ] Any data intro uses coherence-through-chaos (scatter → resolve).
- [ ] Final CTA sits inside a `CinematicVideoCTA` halo card.
- [ ] Wordmark is Instrument Serif 400, unbolded, period intact.
- [ ] SVG coords rounded to 3 decimals; `prefers-reduced-motion` honored.
- [ ] Mobile tested at 375/390/430/768/1024/1440/1920.

---

## 13 · File index — where the visual evidence lives

Repository: `culturaswebsite` (this repo). Everything an agent needs to reproduce the system:

| Path | What it is |
| --- | --- |
| `docs/brand/DESIGN-BIBLE.md` | **This file.** The portable spec. |
| `docs/brand/culturas-brand-guidelines.md` | Narrative brand doc with live captures |
| `docs/brand/culturas-brand-guidelines.pdf` | Cinematic HD PDF export |
| `docs/brand/assets/01-opening-hero.png` … `13-liquid-glass.png` | 1920×1080 site captures |
| `docs/brand/assets/10-logo-wordmark.png` | Wordmark specimen |
| `docs/brand/assets/11-type-specimen.png` | Type specimen (both families in use) |
| `docs/brand/assets/12-palette.png` | Palette with tokens + hex |
| `docs/brand/fonts/GeneralSans-{300,400,500,600,700}.ttf` | General Sans binaries |
| `docs/brand/fonts/InstrumentSerif-{Regular,Italic}.ttf` | Instrument Serif binaries |
| `docs/brand/capture.py` | Regenerate captures from the running site |
| `docs/brand/build-pdf.py` | Rebuild the cinematic PDF |
| `src/styles.css` | Live token source of truth (mirrored in §5) |
| `src/components/LiquidMetalCTA.tsx` | Primary CTA component |
| `src/components/system/CinematicVideoCTA.tsx` | Final CTA pattern |
| `src/components/system/LiveStage.tsx` | Standardized carousel |
| `src/components/CulturegraphSphere.tsx` | Reusable constellation mark |
| `src/components/culturegraphics/CulturegraphicCoalesce.tsx` | Canonical scatter → resolve sequence |

To regenerate everything from the running site:

```bash
python3 docs/brand/capture.py       # refresh 1920×1080 captures
python3 docs/brand/build-pdf.py     # rebuild the cinematic PDF
```

---

_This is the Design Bible. If a design decision isn't answered here, it isn't Culturas yet._
