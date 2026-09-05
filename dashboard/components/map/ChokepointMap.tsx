'use client';

/* The Chokepoint Map — a zoomable instrument of the pipeline.
   Interaction engine per docs/design/depth-globe-map-patterns.md:
   one continuous depth scalar; input writes to a target ref, a rAF loop
   chases it (glide) while drag snaps; cursor-anchored zoom; layer
   cross-fades derived from scale; zoom-floor handoff to the graph view.
   Visual grammar per VISUAL-DATA-SYSTEM: circles only, size = magnitude,
   dashed gold halo = authority, one magenta focus. */

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import seedData from '@/data/nodes_seed.json';
import snapshotData from '@/data/industry_snapshots.json';
import { BASKET_ROLE_VARS } from '@/components/graph/ChokepointNode';

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface MapNode {
  id: string;
  ticker: string;
  name: string;
  stage: string;
  basket: string;
  chokepoint_rating: number;
  market_data?: { market_cap_usd?: number | null; live?: boolean };
  entity_type?: string;
  valuation_usd_b?: number | null;
  [key: string]: unknown;
}

interface ChokepointMapProps {
  nodes: MapNode[];
  activeTicker: string;
  onSelect: (node: MapNode) => void;
  onZoomFloor?: () => void; // fall through the map into the next view
}

const COLUMNS: { key: string; label: string; stages: string[] }[] = [
  { key: 'energy', label: 'Energy', stages: ['ENERGY_GRID'] },
  { key: 'design', label: 'Design & materials', stages: ['EDA_IP', 'RAW_MATERIALS_CHEMISTRY'] },
  { key: 'equipment', label: 'Equipment', stages: ['WFE_LITHOGRAPHY', 'INSPECTION_TESTING'] },
  { key: 'silicon', label: 'Silicon', stages: ['FOUNDRY', 'MEMORY_HBM'] },
  { key: 'package', label: 'Package & test', stages: ['DICING_PACKAGING_SUBSTRATE'] },
  { key: 'systems', label: 'Systems', stages: ['ODM_RACK_INTEGRATION', 'COOLING_THERMAL', 'OPTICAL_FABRIC', 'ROBOTICS'] },
  { key: 'hyperscale', label: 'Hyperscale', stages: ['HYPERSCALE_DEPLOYMENT'] },
  { key: 'models', label: 'Models', stages: ['FOUNDATION_MODELS'] },
];

const VB_W = 1400;
const VB_H = 900;
const TOP = 64;
const BOTTOM = 60;
const R_MIN = 10;
const R_MAX = 46;

/* one continuous depth axis */
const K_MIN = 0.45;
const K_MAX = 3.2;
const K_DEFAULT = 0.72;
const CLUSTER_K = 0.85; // below → Layer I
const PROFILE_K = 1.15; // above, with a selection → Layer III
const FLOOR_K = K_MAX - 0.1;
const GLIDE = 0.18;
const EPS = 5e-4;

type View = { tx: number; ty: number; k: number };

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

interface ForceSnapshot {
  id: string;
  title: string;
  summary: string;
  thesis_impact: string;
  watch: { item: string; why: string }[];
  affected_nodes: string[];
}
const FORCES = snapshotData.snapshots as ForceSnapshot[];
const FORCE_LABELS: Record<string, string> = {
  POWER_WALL: 'Power',
  HBM_SUPERCYCLE: 'HBM',
  CIRCULAR_FINANCING: 'Money loops',
  EXPORT_CONTROL_REGIME: 'Controls',
  PACKAGING_BOTTLENECK: 'Packaging',
  TALENT_DIASPORA: 'Talent',
  ROBOTICS_EMBODIMENT: 'Robotics',
  MACRO_LIQUIDITY: 'Macro',
};

const bezMid = (sx: number, sy: number, tx: number, ty: number) => {
  const mx = (sx + tx) / 2;
  return { x: r3((sx + 3 * mx + 3 * mx + tx) / 8), y: r3((sy + 3 * sy + 3 * ty + ty) / 8) };
};

const defaultView = (): View => ({ k: K_DEFAULT, tx: VB_W * 0.14, ty: VB_H * 0.14 });

export default function ChokepointMap({ nodes, activeTicker, onSelect, onZoomFloor }: ChokepointMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const clusterRef = useRef<SVGGElement>(null);
  const companyRef = useRef<SVGGElement>(null);
  const hudCamRef = useRef<HTMLSpanElement>(null);

  const viewRef = useRef<View>(defaultView());
  const targetRef = useRef<View>(defaultView());
  const rafRef = useRef<number | null>(null);
  const floorFired = useRef(false);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDist = useRef<number | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  const [hovered, setHovered] = useState<string | null>(null);
  const [forceId, setForceId] = useState<string | null>(null);
  // low-frequency semantic state; only changes at threshold crossings
  const [band, setBand] = useState<'cluster' | 'company' | 'profile'>('cluster');

  const force = forceId ? FORCES.find((f) => f.id === forceId) ?? null : null;
  const forceSet = useMemo(() => new Set(force?.affected_nodes ?? []), [force]);

  const active = nodes.find((n) => n.ticker === activeTicker);
  const focusId = active?.id ?? null;
  const focusIdRef = useRef(focusId);
  focusIdRef.current = focusId;

  /* ── layout (unchanged grammar) ── */
  const layout = useMemo(() => {
    const weightOf = (n: MapNode) =>
      n.market_data?.market_cap_usd ?? (n.valuation_usd_b ? n.valuation_usd_b * 1e9 : 0);
    const maxCap = Math.max(1, ...nodes.map(weightOf));
    const radius = (n: MapNode) => {
      const w = weightOf(n);
      if (!w) return R_MIN;
      return r3(R_MIN + (R_MAX - R_MIN) * Math.sqrt(w / maxCap));
    };
    const colW = VB_W / COLUMNS.length;
    const placed: Record<string, { x: number; y: number; r: number; node: MapNode }> = {};
    let maxAgg = 1;
    const columns = COLUMNS.map((col, ci) => {
      const members = nodes
        .filter((n) => col.stages.includes(n.stage))
        .sort((a, b) => (b.market_data?.market_cap_usd ?? (b.valuation_usd_b ?? 0) * 1e9) - (a.market_data?.market_cap_usd ?? (a.valuation_usd_b ?? 0) * 1e9));
      const x = r3(colW * ci + colW / 2);
      const gaps = 26;
      const total = members.reduce((s, m) => s + radius(m) * 2 + gaps, -gaps);
      let y = TOP + (VB_H - TOP - BOTTOM - total) / 2;
      const circles = members.map((m) => {
        const r = radius(m);
        const cy = r3(y + r);
        y += r * 2 + gaps;
        const c = { x, y: cy, r, node: m };
        placed[m.id] = c;
        return c;
      });
      const aggCap = members.reduce((s, m) => s + (m.market_data?.market_cap_usd ?? (m.valuation_usd_b ?? 0) * 1e9), 0);
      maxAgg = Math.max(maxAgg, aggCap);
      const authorities = members.filter((m) => m.chokepoint_rating >= 0.9).length;
      return { ...col, x, circles, aggCap, authorities, count: members.length };
    });
    return { columns, placed, maxAgg };
  }, [nodes]);

  const edges = useMemo(
    () =>
      (seedData.edges as { source: string; target: string; criticality: string; lead_time_days: number; relationship: string; amount_usd_b?: number }[])
        .map((e) => {
          const s = layout.placed[e.source];
          const tt = layout.placed[e.target];
          if (!s || !tt) return null;
          const mx = r3((s.x + tt.x) / 2);
          return {
            ...e,
            d: `M ${r3(s.x)} ${r3(s.y)} C ${mx} ${r3(s.y)}, ${mx} ${r3(tt.y)}, ${r3(tt.x)} ${r3(tt.y)}`,
            mid: bezMid(s.x, s.y, tt.x, tt.y),
            key: `${e.source}-${e.target}:${e.relationship}`,
          };
        })
        .filter(Boolean) as {
        source: string; target: string; criticality: string; lead_time_days: number;
        relationship: string; amount_usd_b?: number; d: string;
        mid: { x: number; y: number }; key: string;
      }[],
    [layout]
  );

  const clusterEdges = useMemo(() => {
    const colOf: Record<string, number> = {};
    layout.columns.forEach((c, i) => c.circles.forEach(({ node }) => (colOf[node.id] = i)));
    const agg = new Map<string, { a: number; b: number; n: number; critical: boolean }>();
    for (const e of edges) {
      const a = colOf[e.source], b = colOf[e.target];
      if (a == null || b == null || a === b) continue;
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      const cur = agg.get(key) ?? { a: Math.min(a, b), b: Math.max(a, b), n: 0, critical: false };
      cur.n += 1;
      cur.critical = cur.critical || e.criticality === 'CRITICAL';
      agg.set(key, cur);
    }
    return [...agg.values()];
  }, [edges, layout]);

  const neighborIds = useMemo(() => {
    if (!focusId) return new Set<string>();
    const s = new Set<string>([focusId]);
    for (const e of edges) {
      if (e.source === focusId) s.add(e.target);
      if (e.target === focusId) s.add(e.source);
    }
    return s;
  }, [edges, focusId]);

  /* ── the animation loop: rendered view chases the target ── */
  const applyFrame = useCallback((v: View) => {
    worldRef.current?.setAttribute('transform', `translate(${r3(v.tx)} ${r3(v.ty)}) scale(${r3(v.k)})`);
    const clusterOpacity = clamp((CLUSTER_K + 0.15 - v.k) / 0.3, 0, 1);
    if (clusterRef.current) {
      clusterRef.current.style.opacity = String(r3(clusterOpacity));
      clusterRef.current.style.pointerEvents = v.k < CLUSTER_K ? 'auto' : 'none';
    }
    if (companyRef.current) {
      companyRef.current.style.opacity = String(r3(1 - clusterOpacity));
      companyRef.current.style.pointerEvents = v.k < CLUSTER_K ? 'none' : 'auto';
    }
    if (hudCamRef.current) hudCamRef.current.textContent = v.k.toFixed(2);
  }, []);

  const syncBand = useCallback((k: number) => {
    const next = k < CLUSTER_K ? 'cluster' : k >= PROFILE_K && focusIdRef.current ? 'profile' : 'company';
    setBand((prev) => (prev === next ? prev : next));
  }, []);

  const tick = useCallback(() => {
    const cur = viewRef.current;
    const tgt = targetRef.current;
    const next: View = {
      tx: cur.tx + (tgt.tx - cur.tx) * GLIDE,
      ty: cur.ty + (tgt.ty - cur.ty) * GLIDE,
      k: cur.k + (tgt.k - cur.k) * GLIDE,
    };
    const done =
      Math.abs(next.tx - tgt.tx) < 0.05 &&
      Math.abs(next.ty - tgt.ty) < 0.05 &&
      Math.abs(next.k - tgt.k) < EPS;
    viewRef.current = done ? { ...tgt } : next;
    applyFrame(viewRef.current);
    syncBand(viewRef.current.k);

    // zoom-floor sentinel: fully in + a focus → fall through to the next view
    if (!floorFired.current && tgt.k >= FLOOR_K && viewRef.current.k >= FLOOR_K - 0.15) {
      if (focusIdRef.current && onZoomFloor) {
        floorFired.current = true;
        onZoomFloor();
      }
    } else if (tgt.k < FLOOR_K - 0.6) {
      floorFired.current = false;
    }

    if (done) {
      rafRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [applyFrame, syncBand, onZoomFloor]);

  const kick = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const glideTo = useCallback(
    (updater: (v: View) => View) => {
      targetRef.current = updater(targetRef.current);
      targetRef.current.k = clamp(targetRef.current.k, K_MIN, K_MAX);
      kick();
    },
    [kick]
  );

  const snapTo = useCallback(
    (updater: (v: View) => View) => {
      const v = updater(viewRef.current);
      v.k = clamp(v.k, K_MIN, K_MAX);
      viewRef.current = v;
      targetRef.current = { ...v };
      applyFrame(v);
      syncBand(v.k);
    },
    [applyFrame, syncBand]
  );

  /* first paint + Esc/keyboard */
  useEffect(() => {
    snapTo(() => defaultView());
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === '+' || e.key === '=') zoomAtCenter(1.35);
      else if (e.key === '-') zoomAtCenter(1 / 1.35);
      else if (e.key === '0') glideTo(() => defaultView());
      else if (e.key === 'Escape') {
        setHovered(null);
        glideTo(() => defaultView());
      } else if (e.key.startsWith('Arrow')) {
        const d = 120;
        glideTo((v) => ({
          ...v,
          tx: v.tx + (e.key === 'ArrowLeft' ? d : e.key === 'ArrowRight' ? -d : 0),
          ty: v.ty + (e.key === 'ArrowUp' ? d : e.key === 'ArrowDown' ? -d : 0),
        }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientToLocal = useCallback((cx: number, cy: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: ((cx - rect.left) / rect.width) * VB_W, y: ((cy - rect.top) / rect.height) * VB_H };
  }, []);

  const anchoredZoom = useCallback(
    (px: number, py: number, factor: number, snap = false) => {
      const apply = (v: View): View => {
        const k = clamp(v.k * factor, K_MIN, K_MAX);
        const f = k / v.k;
        return { k, tx: px - (px - v.tx) * f, ty: py - (py - v.ty) * f };
      };
      (snap ? snapTo : glideTo)(apply);
    },
    [glideTo, snapTo]
  );

  const zoomAtCenter = useCallback(
    (factor: number) => anchoredZoom(VB_W / 2, VB_H / 2, factor),
    [anchoredZoom]
  );

  /* wheel — native listener (React onWheel is passive) */
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const intensity = e.ctrlKey ? 0.012 : 0.0022; // trackpad pinch sends ctrlKey
      const p = clientToLocal(e.clientX, e.clientY);
      anchoredZoom(p.x, p.y, Math.exp(-dy * intensity));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clientToLocal, anchoredZoom]);

  /* drag pan (snap — the pointer is the animation), pinch, double-tap */
  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType !== 'mouse') {
      const now = performance.now();
      const prev = lastTap.current;
      if (prev && now - prev.t < 300 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30) {
        const p = clientToLocal(e.clientX, e.clientY);
        const zoomedIn = viewRef.current.k > K_DEFAULT * 1.6;
        if (zoomedIn) glideTo(() => defaultView());
        else anchoredZoom(p.x, p.y, 2.2 / viewRef.current.k);
        lastTap.current = null;
        return;
      }
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      if (pinchDist.current != null) {
        const c = clientToLocal((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        anchoredZoom(c.x, c.y, d / pinchDist.current, true);
      }
      pinchDist.current = d;
    } else if (pts.length === 1) {
      const rect = svgRef.current!.getBoundingClientRect();
      const dx = ((e.clientX - prev.x) / rect.width) * VB_W;
      const dy = ((e.clientY - prev.y) / rect.height) * VB_H;
      snapTo((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;
  };

  const profileOn = band === 'profile';
  const highlightId = hovered ?? (profileOn ? focusId : null);
  const layerName =
    band === 'cluster' ? 'I · Stages' : band === 'profile' ? 'III · Interaction profile' : 'II · Entities';

  return (
    <div className="relative w-full h-full overflow-hidden data-grid-dark" style={{ background: 'var(--ink)' }}>
      <div className="absolute top-4 left-6 z-10 pointer-events-none">
        <div className="descent-eyebrow on-noir">The map / who holds the pipeline</div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-full touch-none cursor-grab active:cursor-grabbing select-none"
        style={{ color: 'var(--cream)' }}
        role="img"
        aria-label="Zoomable supply chain power map"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <g ref={worldRef}>
          {/* ── Layer I: stage clusters ── */}
          <g ref={clusterRef}>
            {clusterEdges.map((ce) => {
              const a = layout.columns[ce.a], b = layout.columns[ce.b];
              const y = VB_H / 2;
              return (
                <path
                  key={`${ce.a}-${ce.b}`}
                  d={`M ${a.x} ${y} C ${(a.x + b.x) / 2} ${y - 60}, ${(a.x + b.x) / 2} ${y - 60}, ${b.x} ${y}`}
                  fill="none"
                  stroke={ce.critical ? 'var(--gold-matte)' : 'var(--plum)'}
                  strokeOpacity={0.5}
                  strokeWidth={r3(1 + ce.n * 0.8)}
                />
              );
            })}
            {layout.columns.map((col, ci) => {
              const R = r3(60 + 150 * Math.sqrt(col.aggCap / layout.maxAgg));
              const roleCounts = new Map<string, number>();
              col.circles.forEach(({ node }) =>
                roleCounts.set(node.basket, (roleCounts.get(node.basket) ?? 0) + 1)
              );
              const domRole = [...roleCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'BK_INFRA';
              const roleVar = BASKET_ROLE_VARS[domRole] ?? 'var(--plum)';
              const above = ci % 2 === 0;
              const labelY = above ? VB_H / 2 - R - 34 : VB_H / 2 + R + 30;
              return (
                <g key={col.key} onClick={() => anchoredZoom(col.x, VB_H / 2, 1.4 / viewRef.current.k)} style={{ cursor: 'zoom-in' }}>
                  <circle
                    cx={col.x} cy={VB_H / 2} r={R}
                    fill={`color-mix(in oklab, ${roleVar} 13%, transparent)`}
                    stroke={`color-mix(in oklab, ${roleVar} 45%, transparent)`}
                    strokeWidth={1.2}
                  />
                  <text
                    x={col.x} y={labelY} textAnchor="middle" className="mono"
                    style={{ fontSize: 15, letterSpacing: '0.2em', textTransform: 'uppercase', paintOrder: 'stroke', stroke: 'var(--ink)', strokeWidth: 5 }}
                    fill="var(--cream)"
                  >
                    {col.label}
                  </text>
                  <text
                    x={col.x} y={labelY + 20} textAnchor="middle" className="mono"
                    style={{ fontSize: 12, letterSpacing: '0.16em', paintOrder: 'stroke', stroke: 'var(--ink)', strokeWidth: 4 }}
                    fill={dim(60)}
                  >
                    {col.count} entities · {col.authorities > 0 ? `${col.authorities} choke` : 'no choke'}
                  </text>
                </g>
              );
            })}
          </g>

          {/* ── Layer II/III: links first, then circles, labels last ── */}
          <g ref={companyRef}>
            <g fill="none">
              {edges.map((e) => {
                const touching = highlightId && (e.source === highlightId || e.target === highlightId);
                const faded = highlightId && !touching;
                const capital = e.amount_usd_b != null;
                const capW = capital ? r3(1 + Math.log10(e.amount_usd_b! + 1) * 1.1) : 0;
                const forceLit = force && forceSet.has(e.source) && forceSet.has(e.target);
                const forceFaded = force && !forceLit;
                return (
                  <path
                    key={e.key}
                    d={e.d}
                    stroke={
                      capital ? 'var(--gold-matte)'
                      : touching ? 'var(--gold)'
                      : e.criticality === 'CRITICAL' ? 'var(--gold-matte)' : 'var(--plum)'
                    }
                    strokeDasharray={capital ? '5 4' : undefined}
                    strokeOpacity={
                      faded || forceFaded ? 0.06
                      : touching ? 0.95
                      : forceLit ? 0.85
                      : capital ? 0.6 : e.criticality === 'CRITICAL' ? 0.55 : 0.4
                    }
                    strokeWidth={
                      touching ? Math.max(2.2, capW)
                      : forceLit ? Math.max(2, capW)
                      : capital ? capW : e.criticality === 'CRITICAL' ? 1.8 : 1.1
                    }
                    style={{ transition: 'stroke-opacity 450ms ease, stroke-width 450ms ease' }}
                  />
                );
              })}
            </g>

            {layout.columns.map((col) => (
              <text
                key={col.key} x={col.x} y={34} textAnchor="middle" className="mono"
                style={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase' }}
                fill={dim(55)}
              >
                {col.label}
              </text>
            ))}

            {layout.columns.flatMap((col) =>
              col.circles.map(({ x, y, r, node }) => {
                const role = BASKET_ROLE_VARS[node.basket] ?? 'var(--plum)';
                const isAuthority = node.chokepoint_rating >= 0.9;
                const isFocus = node.ticker === activeTicker;
                const inProfile = !highlightId || neighborIds.has(node.id) || node.id === highlightId || hovered === node.id;
                const inForce = !force || forceSet.has(node.id) || hovered === node.id;
                const labelInside = r >= 26;
                return (
                  <g
                    key={node.id}
                    onClick={() => onSelect(node)}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: 'pointer', opacity: inProfile && inForce ? 1 : 0.12, transition: 'opacity 450ms ease' }}
                  >
                    <title>{`${node.name} — crit ${(node.chokepoint_rating * 100).toFixed(0)}%`}</title>
                    {isAuthority && (
                      <circle cx={x} cy={y} r={r3(r + 6)} fill="none" stroke="var(--gold)" strokeWidth={1} strokeDasharray="2.5 4" opacity={0.9} />
                    )}
                    <circle
                      cx={x} cy={y} r={r}
                      fill={`color-mix(in oklab, ${role} 22%, var(--ink))`}
                      stroke={isFocus ? 'var(--magenta)' : hovered === node.id ? 'var(--gold)' : role}
                      strokeWidth={isFocus ? 2 : 1.3}
                      strokeDasharray={node.entity_type === 'PRIVATE' ? '3 2.5' : undefined}
                    />
                    <text
                      x={x}
                      y={labelInside ? y + 4 : r3(y + r + (isAuthority ? 22 : 16))}
                      textAnchor="middle" className="mono"
                      style={{ fontSize: 11, letterSpacing: '0.12em', paintOrder: 'stroke', stroke: 'var(--ink)', strokeWidth: 4 }}
                      fill={isFocus ? 'var(--magenta)' : 'var(--cream)'}
                    >
                      {node.ticker}
                    </text>
                  </g>
                );
              })
            )}

            {/* lead-time labels on the focused ribbons — labels render last */}
            {profileOn &&
              edges
                .filter((e) => e.source === focusId || e.target === focusId)
                .map((e) => (
                  <text
                    key={`lbl-${e.key}`}
                    x={e.mid.x} y={e.mid.y - 6} textAnchor="middle" className="mono"
                    style={{ fontSize: 10, letterSpacing: '0.1em', paintOrder: 'stroke', stroke: 'var(--ink)', strokeWidth: 4 }}
                    fill="var(--gold-matte)"
                  >
                    {e.amount_usd_b != null ? `$${e.amount_usd_b}B` : `${e.lead_time_days}d`} · {e.relationship.replace(/_/g, ' ').toLowerCase()}
                  </text>
                ))}
          </g>
        </g>
      </svg>

      {/* zoom rail — own vertical strip, never overlapping titled regions */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-2">
        <button
          onClick={() => zoomAtCenter(1.35)}
          className="glass-electric w-9 h-9 !rounded-full mono text-[14px] cursor-pointer"
          style={{ color: 'var(--cream)' }}
          aria-label="Zoom in"
        >
          +
        </button>
        <span ref={hudCamRef} className="mono text-[11px]" style={{ color: dim(55) }}>
          {K_DEFAULT.toFixed(2)}
        </span>
        <button
          onClick={() => zoomAtCenter(1 / 1.35)}
          className="glass-electric w-9 h-9 !rounded-full mono text-[14px] cursor-pointer"
          style={{ color: 'var(--cream)' }}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => glideTo(() => defaultView())}
          className="mono text-[11px] mt-1 cursor-pointer bg-transparent border-0"
          style={{ color: dim(55) }}
        >
          Reset
        </button>
      </div>

      {/* Forces lens — snapshots as morphing overlays */}
      <div className="absolute top-12 left-6 right-6 md:right-auto z-10 flex flex-nowrap md:flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setForceId(null)}
          className="mono px-2.5 py-1 text-[11px] rounded-full cursor-pointer shrink-0"
          style={{
            color: !forceId ? 'var(--ink)' : dim(60),
            background: !forceId ? 'var(--cream)' : 'color-mix(in oklab, var(--ink) 60%, transparent)',
            border: `1px solid ${!forceId ? 'var(--cream)' : dim(14)}`,
          }}
        >
          All
        </button>
        {FORCES.map((f) => {
          const on = forceId === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setForceId(on ? null : f.id)}
              className="mono px-2.5 py-1 text-[11px] rounded-full cursor-pointer shrink-0"
              style={{
                color: on ? 'var(--ink)' : 'var(--gold-matte)',
                background: on ? 'var(--gold-matte)' : 'color-mix(in oklab, var(--ink) 60%, transparent)',
                border: `1px solid color-mix(in oklab, var(--gold) ${on ? 80 : 35}%, transparent)`,
              }}
            >
              {FORCE_LABELS[f.id] ?? f.title}
            </button>
          );
        })}
      </div>

      {/* HUD — force narrative, or layer + descent hint */}
      <div className="absolute left-6 bottom-6 z-10 pointer-events-none hidden sm:block max-w-[340px]">
        {force ? (
          <div className="glass-electric p-3.5 pointer-events-auto">
            <div className="descent-eyebrow on-noir">Force / {FORCE_LABELS[force.id]}</div>
            <div className="display text-[22px] mt-1.5" style={{ color: 'var(--cream)' }}>
              {force.title}
            </div>
            <div className="text-[13px] mt-1.5" style={{ color: dim(75) }}>
              {force.thesis_impact}
            </div>
            {force.watch[0] && (
              <div className="mono text-[11px] mt-2 pt-2" style={{ color: dim(50), borderTop: `1px solid ${dim(10)}` }}>
                Watch · {force.watch[0].item}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mono text-[11px]" style={{ color: dim(70) }}>
              Layer {layerName}
            </div>
            <div className="text-[13px] mt-1.5 max-w-[250px]" style={{ color: dim(50) }}>
              Scroll / pinch to descend the taxonomy. Pick a force above to see its story on
              the map. Zoom fully into a selected entity to fall through into the graph.
            </div>
          </>
        )}
      </div>

      <div className="absolute right-6 bottom-6 z-10 pointer-events-none hidden md:flex flex-col items-end gap-2">
        <span className="flex items-center gap-4">
          {Object.entries(BASKET_ROLE_VARS).map(([basket, roleVar]) => (
            <span key={basket} className="flex items-center gap-1.5 mono text-[11px]" style={{ color: dim(64) }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: roleVar }} />
              {basket.replace('BK_', '')}
            </span>
          ))}
        </span>
        <span className="text-[13px]" style={{ color: dim(55) }}>
          Circle area = live market cap (USD). Dashed gold halo = chokepoint authority.
        </span>
      </div>
    </div>
  );
}
