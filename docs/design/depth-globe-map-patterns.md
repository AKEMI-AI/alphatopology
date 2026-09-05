# Depth-Zoom Globe + Concept Map — Portable Interaction Spec

A framework-light extraction of the interaction and visual patterns worth reusing in a
financial agent dashboard. No product branding, no domain data — only the mechanics.

Stack assumed: React 19 + TypeScript, `three` / `@react-three/fiber` / `@react-three/drei`
for the sphere, plain SVG for the 2D map, Tailwind for chrome. All of it is portable;
the math below is framework-agnostic.

---

## 1. Core idea: one continuous depth axis

The whole experience is built on a single scalar — **camera distance** (3D) or **scale**
(2D) — that everything else derives from: which layer is visible, which labels render,
which panels populate. Never treat zoom levels as discrete modes with hard cuts. Instead:

```
input (wheel / pinch / button / programmatic) → target ref (mutated instantly, no React state)
                                              ↓
                              rAF or useFrame lerps current → target
                                              ↓
                          derived layer + opacity + label visibility per frame
```

Two rules that make it feel expensive:

1. **Input writes to a ref, never to state.** State updates at wheel-event frequency
   cause dropped frames and jitter. The ref is the intent; the animation loop is the truth.
2. **The rendered value chases the target with a constant-rate lerp** (`cur += (tgt-cur)*k`).
   `k ≈ 0.08` for camera distance, `k ≈ 0.18` for 2D pan/zoom. Snap to target and stop the
   loop once the delta drops below an epsilon so idle costs nothing.

### Layer thresholds

Define depth bands on the same scalar, with derived opacity ramps rather than boolean
switches, so crossing a boundary is a cross-fade, not a pop.

```ts
const CAM_MIN_DIST = 4.5;     // hard floor — do not let the camera reach the origin
const CAM_MAX_DIST = 26;      // outer ceiling
const CAM_DEFAULT  = 18;

const L1_MIN = 17;  // dist > 17      → macro layer (top-level entities)
const L2_MIN = 9;   // 9 .. 17        → mid layer (groups)
                    // dist < 9       → detail layer (individual items)
```

For a financial dashboard the natural mapping is:
`L1 = asset classes / portfolios`, `L2 = sectors or strategies`, `L3 = individual
positions, orders, or agent decisions`.

### The zoom floor sentinel

Rather than let deep zoom crush into a blank interior, fire a one-shot callback when the
target distance parks at the floor, and hand off to a different view (a flat map, a table,
a detail pane). Latch it so it fires once, and unlatch only after the user pulls back
meaningfully (`target > FLOOR + 1.5`).

```ts
if (!floorFired.current && target <= CAM_MIN_DIST + 0.05 && newLen <= CAM_MIN_DIST + 0.25) {
  floorFired.current = true;
  onZoomFloor();                       // e.g. swap to the flat detail view
} else if (target > CAM_MIN_DIST + 1.5) {
  floorFired.current = false;
}
```

This "scroll all the way in and you fall through into another view" transition is the
single most distinctive move in the original design. It reads as depth, not navigation.

---

## 2. The 3D sphere

### Shell radii

Three nested shells share one origin; each depth band lives on its own radius so zooming
literally travels between them.

```ts
const R          = 5;          // outer shell — macro nodes
const R_GROUP    = R * 0.70;   // mid shell
const R_ITEM     = R * 0.42;   // inner point cloud
```

Place a node from spherical coords:

```ts
const sph = (theta: number, phi: number, r = R) => new THREE.Vector3(
  r * Math.sin(phi) * Math.cos(theta),
  r * Math.cos(phi),
  r * Math.sin(phi) * Math.sin(theta),
);
```

Node radius should encode magnitude with a compressive curve so large values dominate
without erasing small ones: `radius = 0.65 + curve(value01) * 0.75`, where `curve` is
`sqrt`, `linear`, or `pow` — expose it as a tuning knob.

### Wheel + pinch input

React's `onWheel` is passive; `preventDefault()` there is silently ignored. Attach natively.

```ts
useEffect(() => {
  const el = gl.domElement;                       // or your container element
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    targetZoom.current = clamp(
      targetZoom.current + e.deltaY * 0.012,      // deltaY>0 → zoom out
      CAM_MIN_DIST, CAM_MAX_DIST,
    );
    focusActive.current = false;                  // user input cancels in-flight fly-to
  };
  el.addEventListener("wheel", onWheel, { passive: false });

  // Two-finger pinch → ratio applied to the starting distance.
  let startDist = 0, startZoom = 0;
  const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX,
                                            t[0].clientY - t[1].clientY) || 1;
  const onStart = (e: TouchEvent) => {
    if (e.touches.length < 2) return;
    e.preventDefault(); startDist = dist(e.touches); startZoom = targetZoom.current;
  };
  const onMove = (e: TouchEvent) => {
    if (e.touches.length < 2 || !startDist) return;
    e.preventDefault();
    targetZoom.current = clamp(startZoom * (startDist / dist(e.touches)),
                               CAM_MIN_DIST, CAM_MAX_DIST);
  };
  /* ... register touchstart/touchmove/touchend, all passive:false ... */
}, [gl]);
```

Normalize `deltaMode` if you support Firefox line-scrolling:
`const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1)`.

### Per-frame camera lerp

```ts
useFrame((state) => {
  if (focusActive.current) return;                 // fly-to owns the camera
  const cur = vTmp.copy(state.camera.position);
  const len = Math.max(cur.length(), 1e-4);
  const dir = cur.divideScalar(len);
  const next = THREE.MathUtils.lerp(len, clamp(targetZoom.current, MIN, MAX), 0.08);
  state.camera.position.copy(dir).multiplyScalar(next);
});
```

Note it scales the *existing* direction vector — orbit rotation stays untouched, so zoom
and rotate compose cleanly.

### Programmatic zoom (HUD buttons, agent-driven focus)

Pass a command object with an incrementing id so repeats of the same distance still fire:

```ts
zoomCommand?: { id: number; dist: number }
```

The receiving effect writes `targetZoom.current = clamp(dist)` and clears the focus latch.
Same path as user input, so the motion is identical — never animate the camera directly
from a button handler.

### Click-to-focus fly-to

On selection, lerp both `camera.position` toward a destination *inside* the next layer and
`controls.target` toward the node. Mark `arrived` when both deltas fall under an epsilon,
then release control back to the zoom lerp. Any wheel event mid-flight cancels it — never
trap the user in an animation.

### Label legibility on a sphere

Three stacked filters, applied every frame:

1. **Layer gate** — only the active band's labels are candidates.
2. **Camera-facing cone** — dot the node's world direction against the camera direction;
   outside a ~60° cone, fade toward 0. Never fully to 0 for the focused set, or the globe
   feels broken.
3. **Screen-space declutter** — project candidates to screen coords, sort by camera
   distance, and drop any whose rect overlaps a kept one. Nearest wins.

Throttle expensive per-frame loops (`distanceTo` across all nodes, DOM measurement) to
every 6th frame — ~10 Hz is indistinguishable and frees a lot of CPU.

---

## 3. The 2D map (SVG, pan / zoom / rotate)

Single view object drives one SVG transform:

```ts
type View = { tx: number; ty: number; scale: number; rot: number };
// <g transform={`translate(${tx},${ty}) scale(${scale}) rotate(${rot},${CX},${CY})`}>
```

Keep three refs: `viewRef` (rendered), `targetRef` (intent), `rafRef` (loop handle).
`glideTo(updater)` eases; `snapTo(updater)` is instant and is used *during drag*, where the
pointer itself is the animation. Mixing them is what makes it feel liquid rather than laggy.

```ts
const k = 0.18;
next = { tx: cur.tx + (tgt.tx - cur.tx) * k, /* ...same for ty, scale, rot */ };
const done = Math.abs(next.tx - tgt.tx) < 0.05 && Math.abs(next.scale - tgt.scale) < 5e-4;
if (done) { setView(tgt); rafRef.current = null; return; }   // stop the loop when settled
```

### Cursor-anchored zoom (the part people get wrong)

Scale alone zooms about the transform origin and throws the content under the cursor off
screen. Recompute the translation so the anchor point is stationary:

```ts
const rect = el.getBoundingClientRect();          // untransformed container
const mx = e.clientX - rect.left, my = e.clientY - rect.top;
const newScale = clamp(v.scale * Math.exp(-dy * intensity), MIN_SCALE, MAX_SCALE);
const k = newScale / v.scale;
return { ...v, scale: newScale, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k };
```

`intensity = 0.0022` for wheel; `0.012` when `e.ctrlKey` (trackpad pinch sends tiny deltas
with ctrlKey set — without `preventDefault` the browser page-zooms instead).

The same formula, anchored at the container center, powers `+` / `−` buttons.

### Gesture matrix

| Input | Action |
|---|---|
| Drag | Pan (immediate, `snapTo`) |
| Shift/Alt + drag | Rotate about the layout center |
| Wheel | Cursor-anchored zoom (eased) |
| Trackpad pinch (`ctrlKey`) | Same, amplified |
| Two-finger touch | Pinch zoom + pan about the midpoint |
| Double-tap (touch/pen) | Toggle between fit and ~2.2× at the tap point |
| `+` `-` `0` | Zoom in / out / fit-to-view |
| Arrows | Pan ±120px, eased |
| `Esc` | Clear selection — always provide an escape from a focused state |

Track pointers in a `Map<pointerId, {x,y}>` and use `setPointerCapture`. Detect double-tap
with a 300 ms / 30 px window on non-mouse pointers only.

### Fit-to-view

```ts
const fill = rect.width < 640 ? 1.55 : 0.92;   // zoom in harder on mobile so labels read
const scale = Math.min(rect.width / W, rect.height / H) * fill;
glideTo(() => ({ tx: rect.width/2 - (W/2)*scale, ty: rect.height/2 - (H/2)*scale, scale, rot: 0 }));
```

Run it instantly (`snap`) on first mount so the initial paint isn't a slide-in, and on
window resize.

### Node rendering order

Render in strict z-order: relationship links first, then node circles, then labels last.
Labels for large hubs sit *below* the circle, not inside it, and get a halo via
`paint-order: stroke; stroke: <bg-color>; stroke-width: 5px;` so lines never cut through
type. This single change did more for legibility than any color work.

### Hover emphasis

On hub hover: connected links get higher opacity, +stroke-width, and a drop-shadow;
everything unrelated drops to ~0.15 opacity. Emphasis is *relative dimming*, not
highlighting — the eye follows the surviving contrast.

---

## 4. Adaptive quality

Detect a device tier once at mount and scale geometry cost, not visual clarity. Labels,
halos, and hover glows always stay at full fidelity; density and resolution flex.

```ts
let score = 0;
score += cores >= 8 ? 2 : cores >= 4 ? 1 : 0;
score += deviceMemory >= 8 ? 2 : deviceMemory >= 4 ? 1 : 0;
score += isMobileUA ? 0 : 2;
score += devicePixelRatio >= 2 ? 1 : 0;
const tier = score <= 2 ? "low" : score <= 5 ? "medium" : "high";
```

| Knob | low | medium | high |
|---|---|---|---|
| `dprMax` | 1 | 1.5 | min(dpr, 2) |
| `antialias` | false | true | true |
| `pointStride` (render every Nth point) | 3 | 2 | 1 |
| `shellDetail` (icosahedron subdivision) | 2 | 3 | 4 |
| `maxTransients` (concurrent pulse rings) | 5 | 9 | 14 |
| `spriteDensity` | 0.55 | 0.8 | 1 |

Also downgrade `high → medium` when `prefers-reduced-motion: reduce` matches.

Two gotchas: the detector must be SSR-safe (return the high tier when `window` is
undefined, then re-detect in an effect), and if you stride the point cloud you must remap
click indices back to the full dataset, or selection silently targets the wrong record.

---

## 5. Live-data motion primitives

These are what make a dashboard feel like it is *running* rather than *loaded*.

**Pulse rings on events.** On each inbound event, push `{pos, born: performance.now(), color,
dur: 2200}` onto a fixed-length ring buffer capped at the tier's `maxTransients`. Per frame,
`t = (now - born) / dur`, `eased = 1 - (1-t)^2.4`; scale `0.4 → 6.9`, opacity `(1-t)*0.7`.
Pre-allocate the meshes and toggle `visible` — never mount/unmount per event.

**Breathing intensity blobs.** Radial-gradient sprites whose scale is
`base(value) × (0.92 + sin(t*1.3 + i*0.7)*0.08) × focusMultiplier`, damped toward the target
with `THREE.MathUtils.damp(cur, target, 4, dt)`. Damping means a sudden data change glides
in instead of snapping — critical when rows arrive from a live subscription.

Always clamp frame delta (`Math.min(dt, 0.066)`) so a backgrounded tab doesn't produce one
enormous jump on refocus.

**Focus coupling.** A single `activeId` in context drives everything at once: the globe
node brightens, unrelated blobs drop to 0.35 opacity, the map dims non-connected links, and
the side panels filter. One piece of state, whole-screen response.

---

## 6. Chrome and surface treatment

Strip the warm/cream palette if it doesn't suit finance — the *structure* is what transfers.

- **Neumorphic glass surfaces**: `backdrop-filter: blur(22px) saturate(140%)`, a translucent
  base, a 1px light border, and a four-part shadow stack — two outer diffuse (one below-right
  dark, one above-left light) plus two `inset` hairlines. This is what reads as physical.
- **Accent bloom**: a `::after` pseudo-element with `inset: -14px -10px -2px -10px`, a radial
  gradient at `50% 18%`, `filter: blur(14px)`, `z-index: -1`. A soft halo behind the surface
  rather than a border glow. Requires `border-radius: inherit` or it escapes square corners.
- **Full pill rounding** (`9999px`) on all floating chrome, with opt-in overrides via a
  class modifier for larger drawers (`.rounded-2xl` → `1rem`).
- **Transition curve**: `cubic-bezier(0.34, 1.56, 0.64, 1)` at 500 ms — a slight overshoot
  that makes surfaces feel like they settle.
- **Pressed state** for active toggles: invert the shadow stack (insets become the outer
  values) rather than changing background color.

### HUD layout rules learned the hard way

- Floating controls must never overlap a titled region. Give the zoom stepper its own
  vertical rail on the mid-left edge with `+`, a numeric readout, and `−`.
- A draggable assistant orb should *snap* to the nearest of four corners on release, not
  free-float, and should fade out entirely while its own drawer is open.
- Mobile: convert any wrapping chip row into a horizontally scrollable strip with a
  gradient mask on both edges. Wrapping rows eat vertical space and break the layout.
- Render client-positioned floating elements only after mount, or you get hydration
  mismatches under SSR.

---

## 7. Suggested mapping to a financial agent dashboard

| Pattern here | Dashboard use |
|---|---|
| 3-shell sphere + depth bands | Portfolio → sector/strategy → position/order |
| Zoom-floor handoff | Scroll fully into a position → flat detail/blotter view |
| Cursor-anchored SVG map | Correlation or exposure graph; agent decision tree |
| Pulse rings | Fills, alerts, agent actions landing in real time |
| Breathing blobs | Rolling exposure or volatility by region/sector |
| `activeId` focus coupling | Select a ticker anywhere → whole dashboard filters |
| Adaptive quality tiers | Keeps a dense point cloud interactive on laptops |

---

## 8. Implementation order

1. Depth scalar + rAF/useFrame lerp loop + zoom clamps. Verify motion with placeholder cubes.
2. Layer thresholds and cross-fade opacity ramps.
3. Wheel, pinch, keyboard, and programmatic input — all writing to the same target ref.
4. Label declutter (layer gate → facing cone → screen-space overlap).
5. Fly-to on select, with input cancellation.
6. Zoom-floor handoff to the second view.
7. Adaptive quality tiers.
8. Live-event pulses and damped value transitions.
9. Surface treatment and HUD placement last — it is the cheapest layer to iterate on.
