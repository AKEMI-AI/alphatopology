'use client';

/* The Chokepoint Map — a zoomable instrument of the pipeline.
   Descend the taxonomy: stage clusters → companies → a company's
   interaction profile. VISUAL-DATA-SYSTEM grammar: circles only; size
   encodes magnitude (live USD market cap); dashed gold halo = chokepoint
   authority; solid ribbons = physical supply; one magenta focus. */

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import seedData from '@/data/nodes_seed.json';
import { BASKET_ROLE_VARS } from '@/components/graph/ChokepointNode';

const r3 = (n: number) => Math.round(n * 1000) / 1000;

interface MapNode {
  id: string;
  ticker: string;
  name: string;
  stage: string;
  basket: string;
  chokepoint_rating: number;
  market_data?: { market_cap_usd?: number | null; live?: boolean };
  [key: string]: unknown;
}

interface ChokepointMapProps {
  nodes: MapNode[];
  activeTicker: string;
  onSelect: (node: MapNode) => void;
}

const COLUMNS: { key: string; label: string; stages: string[] }[] = [
  { key: 'energy', label: 'Energy', stages: ['ENERGY_GRID'] },
  { key: 'design', label: 'Design & materials', stages: ['EDA_IP', 'RAW_MATERIALS_CHEMISTRY'] },
  { key: 'equipment', label: 'Equipment', stages: ['WFE_LITHOGRAPHY', 'INSPECTION_TESTING'] },
  { key: 'silicon', label: 'Silicon', stages: ['FOUNDRY', 'MEMORY_HBM'] },
  { key: 'package', label: 'Package & test', stages: ['DICING_PACKAGING_SUBSTRATE'] },
  { key: 'systems', label: 'Systems', stages: ['ODM_RACK_INTEGRATION', 'COOLING_THERMAL', 'OPTICAL_FABRIC'] },
  { key: 'hyperscale', label: 'Hyperscale', stages: ['HYPERSCALE_DEPLOYMENT'] },
];

const VB_W = 1400;
const VB_H = 900;
const TOP = 64;
const BOTTOM = 60;
const R_MIN = 10;
const R_MAX = 46;

/* Semantic zoom: below this scale the map resolves into stage clusters */
const CLUSTER_K = 0.85;
const K_MIN = 0.5;
const K_MAX = 3.5;

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

/* midpoint of the cubic used for ribbons (t = 0.5) */
const bezMid = (sx: number, sy: number, tx: number, ty: number) => {
  const mx = (sx + tx) / 2;
  return { x: r3((sx + 3 * mx + 3 * mx + tx) / 8), y: r3((sy + 3 * sy + 3 * ty + ty) / 8) };
};

export default function ChokepointMap({ nodes, activeTicker, onSelect }: ChokepointMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [t, setT] = useState({ k: 0.72, x: VB_W * 0.14, y: VB_H * 0.14 });
  const [hovered, setHovered] = useState<string | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDist = useRef<number | null>(null);

  const layout = useMemo(() => {
    const maxCap = Math.max(1, ...nodes.map((n) => n.market_data?.market_cap_usd ?? 0));
    const radius = (n: MapNode) => {
      const cap = n.market_data?.market_cap_usd;
      if (!cap) return R_MIN;
      return r3(R_MIN + (R_MAX - R_MIN) * Math.sqrt(cap / maxCap));
    };

    const colW = VB_W / COLUMNS.length;
    const placed: Record<string, { x: number; y: number; r: number; node: MapNode }> = {};
    let maxAgg = 1;
    const columns = COLUMNS.map((col, ci) => {
      const members = nodes
        .filter((n) => col.stages.includes(n.stage))
        .sort((a, b) => (b.market_data?.market_cap_usd ?? 0) - (a.market_data?.market_cap_usd ?? 0));
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
      const aggCap = members.reduce((s, m) => s + (m.market_data?.market_cap_usd ?? 0), 0);
      maxAgg = Math.max(maxAgg, aggCap);
      const authorities = members.filter((m) => m.chokepoint_rating >= 0.9).length;
      return { ...col, x, circles, aggCap, authorities, count: members.length };
    });
    return { columns, placed, maxAgg };
  }, [nodes]);

  const edges = useMemo(
    () =>
      (seedData.edges as { source: string; target: string; criticality: string; lead_time_days: number; relationship: string }[])
        .map((e) => {
          const s = layout.placed[e.source];
          const tt = layout.placed[e.target];
          if (!s || !tt) return null;
          const mx = r3((s.x + tt.x) / 2);
          return {
            ...e,
            d: `M ${r3(s.x)} ${r3(s.y)} C ${mx} ${r3(s.y)}, ${mx} ${r3(tt.y)}, ${r3(tt.x)} ${r3(tt.y)}`,
            mid: bezMid(s.x, s.y, tt.x, tt.y),
            key: `${e.source}-${e.target}`,
          };
        })
        .filter(Boolean) as {
        source: string; target: string; criticality: string; lead_time_days: number;
        relationship: string; d: string; mid: { x: number; y: number }; key: string;
      }[],
    [layout]
  );

  /* aggregated stage-to-stage ribbons for cluster level */
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

  const active = nodes.find((n) => n.ticker === activeTicker);
  const focusId = active?.id ?? null;
  const neighborIds = useMemo(() => {
    if (!focusId) return new Set<string>();
    const s = new Set<string>([focusId]);
    for (const e of edges) {
      if (e.source === focusId) s.add(e.target);
      if (e.target === focusId) s.add(e.source);
    }
    return s;
  }, [edges, focusId]);
  const profileOn = t.k >= 1.15 && !!focusId; // deepest layer: interaction profile
  const highlightId = hovered ?? (profileOn ? focusId : null);

  const clusterLevel = t.k < CLUSTER_K;
  // crossfade between taxonomy layers around the threshold
  const clusterOpacity = Math.max(0, Math.min(1, (CLUSTER_K + 0.15 - t.k) / 0.3));
  const companyOpacity = 1 - clusterOpacity;

  /* ── pan / zoom (wheel, drag, pinch) ── */
  const clientToLocal = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((cx - rect.left) / rect.width) * VB_W,
      y: ((cy - rect.top) / rect.height) * VB_H,
    };
  }, []);

  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      setT((prev) => {
        const k = Math.max(K_MIN, Math.min(K_MAX, prev.k * factor));
        const f = k / prev.k;
        return { k, x: px - (px - prev.x) * f, y: py - (py - prev.y) * f };
      });
    },
    []
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = clientToLocal(e.clientX, e.clientY);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0016));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [clientToLocal, zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchDist.current != null) {
        const c = clientToLocal((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        zoomAt(c.x, c.y, d / pinchDist.current);
      }
      pinchDist.current = d;
    } else if (pts.length === 1) {
      const svg = svgRef.current!;
      const rect = svg.getBoundingClientRect();
      const dx = ((e.clientX - prev.x) / rect.width) * VB_W;
      const dy = ((e.clientY - prev.y) / rect.height) * VB_H;
      setT((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;
  };

  const layerName = clusterLevel ? 'I · Stages' : profileOn ? 'III · Interaction profile' : 'II · Entities';

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
        <g transform={`translate(${r3(t.x)} ${r3(t.y)}) scale(${r3(t.k)})`}>
          {/* ── Layer I: stage clusters ── */}
          <g style={{ opacity: clusterOpacity, transition: 'opacity 240ms ease' }} pointerEvents={clusterLevel ? 'auto' : 'none'}>
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
              const domRole =
                [...roleCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'BK_INFRA';
              const roleVar = BASKET_ROLE_VARS[domRole] ?? 'var(--plum)';
              // alternate labels above/below so neighbors never collide (law zero)
              const above = ci % 2 === 0;
              const labelY = above ? VB_H / 2 - R - 34 : VB_H / 2 + R + 30;
              return (
                <g key={col.key} onClick={() => zoomAt(col.x, VB_H / 2, 1.8 / t.k)} style={{ cursor: 'zoom-in' }}>
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

          {/* ── Layer II/III: companies + interaction profile ── */}
          <g style={{ opacity: companyOpacity, transition: 'opacity 240ms ease' }} pointerEvents={clusterLevel ? 'none' : 'auto'}>
            <g fill="none">
              {edges.map((e) => {
                const touching = highlightId && (e.source === highlightId || e.target === highlightId);
                const faded = highlightId && !touching;
                return (
                  <path
                    key={e.key}
                    d={e.d}
                    stroke={touching ? 'var(--gold)' : e.criticality === 'CRITICAL' ? 'var(--gold-matte)' : 'var(--plum)'}
                    strokeOpacity={faded ? 0.08 : touching ? 0.95 : e.criticality === 'CRITICAL' ? 0.55 : 0.4}
                    strokeWidth={touching ? 2.2 : e.criticality === 'CRITICAL' ? 1.8 : 1.1}
                    style={{ transition: 'stroke-opacity 200ms ease' }}
                  />
                );
              })}
            </g>

            {/* lead-time labels on the focused node's ribbons (Layer III) */}
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
                    {e.lead_time_days}d · {e.relationship.replace(/_/g, ' ').toLowerCase()}
                  </text>
                ))}

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
                const labelInside = r >= 26;
                return (
                  <g
                    key={node.id}
                    onClick={() => onSelect(node)}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: 'pointer', opacity: inProfile ? 1 : 0.18, transition: 'opacity 200ms ease' }}
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
          </g>
        </g>
      </svg>

      {/* zoom HUD — descend the taxonomy */}
      <div className="absolute left-6 bottom-6 z-10 pointer-events-none">
        <div className="mono text-[11px]" style={{ color: dim(50) }}>
          Cam dist · {t.k.toFixed(2)}
        </div>
        <div className="mono text-[11px] mt-1" style={{ color: dim(70) }}>
          Layer {layerName}
        </div>
        <div className="text-[13px] mt-1.5 max-w-[240px]" style={{ color: dim(50) }}>
          Scroll / pinch to descend the taxonomy. Select an entity, then zoom in for its
          interaction profile.
        </div>
      </div>

      {/* caption + legend */}
      <div className="absolute right-6 bottom-6 z-10 pointer-events-none flex flex-col items-end gap-2">
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
