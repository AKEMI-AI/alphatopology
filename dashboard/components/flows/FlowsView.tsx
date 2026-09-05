'use client';

/* The Money Machine — circular interconnection view of AI capital flows.
   Bloomberg-diagram grammar in the Culturas skin: circles sized by market
   value/valuation, directed arrows typed by deal kind, dollar labels that
   reveal with depth (semantic zoom), flow animated along the ribbons.
   Depth engine per docs/design/depth-globe-map-patterns.md (trimmed). */

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import seedData from '@/data/nodes_seed.json';

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

interface FlowNode {
  id: string;
  ticker: string;
  name: string;
  stage: string;
  entity_type?: string;
  valuation_usd_b?: number | null;
  market_data?: { market_cap_usd?: number | null };
  [key: string]: unknown;
}

interface FlowsViewProps {
  nodes: FlowNode[];
  activeTicker: string;
  onSelect: (node: FlowNode) => void;
}

type FlowKind = 'investment' | 'vc' | 'services' | 'hardware';

const KIND_META: Record<FlowKind, { label: string; varName: string }> = {
  hardware: { label: 'Hardware / chips', varName: 'var(--spectrum-orange)' },
  investment: { label: 'Investment', varName: 'var(--neon)' },
  services: { label: 'Compute / services', varName: 'var(--spectrum-violet)' },
  vc: { label: 'Venture round', varName: 'var(--gold-matte)' },
};

function classify(rel: string): FlowKind | null {
  if (/TRAY|RACK/.test(rel)) return null; // physical assembly — lives on the map, not here
  if (/CAPITAL_ROUND/.test(rel)) return 'vc';
  if (/CAPITAL|BACKSTOP/.test(rel)) return 'investment';
  if (/COMPUTE_CONTRACT|STARGATE|AZURE|TPU|TRAINIUM|GPU_CLOUD|COMPUTE_SUPPLY/.test(rel)) return 'services';
  if (/GPU_SUPPLY|DOJO|ROBOT_COMPUTE/.test(rel)) return 'hardware';
  return null;
}

const VB_W = 1240;
const VB_H = 900;
const CX = VB_W / 2;
const CY = VB_H / 2 + 10;
const RING = 330;
const K_MIN = 0.7;
const K_MAX = 2.6;
const K_DEFAULT = 0.92;
const GLIDE = 0.18;

type View = { tx: number; ty: number; k: number };
const defaultView = (): View => ({ k: K_DEFAULT, tx: VB_W * 0.04, ty: VB_H * 0.04 });

export default function FlowsView({ nodes, activeTicker, onSelect }: FlowsViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const labelsRef = useRef<SVGGElement>(null);
  const viewRef = useRef<View>(defaultView());
  const targetRef = useRef<View>(defaultView());
  const rafRef = useRef<number | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const [hovered, setHovered] = useState<string | null>(null);

  /* the cast: everyone touching a typed money/compute flow */
  const { flows, placed, maxW } = useMemo(() => {
    const rawEdges = seedData.edges as {
      source: string; target: string; relationship: string; amount_usd_b?: number;
    }[];
    const flows = rawEdges
      .map((e) => ({ ...e, kind: classify(e.relationship) }))
      .filter((e): e is typeof e & { kind: FlowKind } => e.kind != null);
    const castIds = new Set(flows.flatMap((e) => [e.source, e.target]));
    const cast = nodes.filter((n) => castIds.has(n.id));

    const weightOf = (n: FlowNode) =>
      n.market_data?.market_cap_usd ?? (n.valuation_usd_b ? n.valuation_usd_b * 1e9 : 5e9);
    const maxW = Math.max(1, ...cast.map(weightOf));

    // center = highest flow degree (NVIDIA in practice); others on the ring
    const degree = new Map<string, number>();
    for (const e of flows) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    const sorted = [...cast].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));
    const center = sorted[0];
    const ring = sorted.slice(1).sort((a, b) => a.stage.localeCompare(b.stage) || a.id.localeCompare(b.id));

    const placed: Record<string, { x: number; y: number; r: number; node: FlowNode }> = {};
    const rOf = (n: FlowNode) => r3(16 + 52 * Math.sqrt(weightOf(n) / maxW));
    if (center) placed[center.id] = { x: CX, y: CY, r: rOf(center), node: center };
    ring.forEach((n, i) => {
      const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
      placed[n.id] = {
        x: r3(CX + RING * Math.cos(a)),
        y: r3(CY + RING * 0.82 * Math.sin(a)),
        r: rOf(n),
        node: n,
      };
    });
    return { flows, placed, maxW };
  }, [nodes]);

  const focusId = nodes.find((n) => n.ticker === activeTicker)?.id ?? null;
  const highlightId = hovered ?? focusId;

  /* depth engine (trimmed): wheel-anchored zoom + drag pan + label reveal */
  const applyFrame = useCallback((v: View) => {
    worldRef.current?.setAttribute('transform', `translate(${r3(v.tx)} ${r3(v.ty)}) scale(${r3(v.k)})`);
    if (labelsRef.current) {
      labelsRef.current.style.opacity = String(r3(clamp((v.k - 1.02) / 0.25, 0, 1)));
    }
  }, []);

  const kick = useCallback(() => {
    if (rafRef.current != null) return;
    const tick = () => {
      const cur = viewRef.current, tgt = targetRef.current;
      const next = {
        tx: cur.tx + (tgt.tx - cur.tx) * GLIDE,
        ty: cur.ty + (tgt.ty - cur.ty) * GLIDE,
        k: cur.k + (tgt.k - cur.k) * GLIDE,
      };
      const done = Math.abs(next.tx - tgt.tx) < 0.05 && Math.abs(next.k - tgt.k) < 5e-4;
      viewRef.current = done ? { ...tgt } : next;
      applyFrame(viewRef.current);
      rafRef.current = done ? null : requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [applyFrame]);

  const clientToLocal = useCallback((cx: number, cy: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: ((cx - rect.left) / rect.width) * VB_W, y: ((cy - rect.top) / rect.height) * VB_H };
  }, []);

  useEffect(() => {
    applyFrame(viewRef.current);
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      const factor = Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0022));
      const p = clientToLocal(e.clientX, e.clientY);
      const t = targetRef.current;
      const k = clamp(t.k * factor, K_MIN, K_MAX);
      const f = k / t.k;
      targetRef.current = { k, tx: p.x - (p.x - t.tx) * f, ty: p.y - (p.y - t.ty) * f };
      kick();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [clientToLocal, kick, applyFrame]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || pointers.current.size !== 1) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = svgRef.current!.getBoundingClientRect();
    const dx = ((e.clientX - prev.x) / rect.width) * VB_W;
    const dy = ((e.clientY - prev.y) / rect.height) * VB_H;
    viewRef.current = { ...viewRef.current, tx: viewRef.current.tx + dx, ty: viewRef.current.ty + dy };
    targetRef.current = { ...viewRef.current };
    applyFrame(viewRef.current);
  };
  const onPointerUp = (e: React.PointerEvent) => pointers.current.delete(e.pointerId);

  /* arrow path: curve bowed toward/away from center for legibility */
  const pathFor = (sId: string, tId: string, i: number) => {
    const s = placed[sId], t = placed[tId];
    if (!s || !t) return null;
    const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
    // bow perpendicular; alternate side per index to separate parallel flows
    const dx = t.x - s.x, dy = t.y - s.y;
    const len = Math.hypot(dx, dy) || 1;
    const side = i % 2 === 0 ? 1 : -1;
    const bow = 0.16 * len * side;
    const px = mx - (dy / len) * bow, py = my + (dx / len) * bow;
    // trim ends to circle edges
    const trim = (from: { x: number; y: number }, to: { x: number; y: number }, r: number) => {
      const ddx = to.x - from.x, ddy = to.y - from.y, l = Math.hypot(ddx, ddy) || 1;
      return { x: from.x + (ddx / l) * r, y: from.y + (ddy / l) * r };
    };
    const a = trim(s, { x: px, y: py }, s.r + 3);
    const b = trim(t, { x: px, y: py }, t.r + 8);
    return { d: `M ${r3(a.x)} ${r3(a.y)} Q ${r3(px)} ${r3(py)} ${r3(b.x)} ${r3(b.y)}`, mid: { x: r3(px), y: r3(py) } };
  };

  return (
    <div className="relative w-full h-full overflow-hidden data-grid-dark" style={{ background: 'var(--ink)' }}>
      <div className="absolute top-4 left-6 z-10 pointer-events-none">
        <div className="descent-eyebrow on-noir">The money machine / who funds whom</div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-full touch-none cursor-grab active:cursor-grabbing select-none"
        role="img"
        aria-label="AI capital flow diagram: circles sized by value, arrows typed by deal kind"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          {(Object.keys(KIND_META) as FlowKind[]).map((k) => (
            <marker
              key={k}
              id={`arrow-${k}`}
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill={KIND_META[k].varName} />
            </marker>
          ))}
        </defs>

        <g ref={worldRef}>
          {/* flows — animated dash drift in the direction of the money */}
          <g fill="none">
            {flows.map((e, i) => {
              const p = pathFor(e.source, e.target, i);
              if (!p) return null;
              const touching = highlightId && (e.source === highlightId || e.target === highlightId);
              const faded = highlightId && !touching;
              const w = e.amount_usd_b != null ? r3(1.2 + Math.log10(e.amount_usd_b + 1) * 1.15) : 1.4;
              return (
                <path
                  key={`${e.source}-${e.target}-${e.relationship}`}
                  d={p.d}
                  className="flow-dash"
                  stroke={KIND_META[e.kind].varName}
                  strokeOpacity={faded ? 0.07 : touching ? 0.95 : 0.6}
                  strokeWidth={touching ? Math.max(2.4, w) : w}
                  markerEnd={`url(#arrow-${e.kind})`}
                  style={{ transition: 'stroke-opacity 400ms ease' }}
                />
              );
            })}
          </g>

          {/* dollar labels — revealed with depth */}
          <g ref={labelsRef} style={{ opacity: 0 }} pointerEvents="none">
            {flows.map((e, i) => {
              const p = pathFor(e.source, e.target, i);
              if (!p) return null;
              const faded = highlightId && !(e.source === highlightId || e.target === highlightId);
              if (faded) return null;
              return (
                <text
                  key={`lbl-${e.source}-${e.target}-${e.relationship}`}
                  x={p.mid.x}
                  y={p.mid.y}
                  textAnchor="middle"
                  className="mono"
                  style={{ fontSize: 11, letterSpacing: '0.08em', paintOrder: 'stroke', stroke: 'var(--ink)', strokeWidth: 4 }}
                  fill={KIND_META[e.kind].varName}
                >
                  {e.amount_usd_b != null ? `$${e.amount_usd_b}B` : e.relationship.replace(/_/g, ' ').toLowerCase()}
                </text>
              );
            })}
          </g>

          {/* the cast */}
          {Object.values(placed).map(({ x, y, r, node }) => {
            const isFocus = node.id === focusId;
            const dimmed = highlightId && node.id !== highlightId &&
              !flows.some((e) => (e.source === highlightId && e.target === node.id) || (e.target === highlightId && e.source === node.id));
            const w = node.market_data?.market_cap_usd ?? (node.valuation_usd_b ? node.valuation_usd_b * 1e9 : null);
            const valueLabel = w
              ? w >= 1e12 ? `$${(w / 1e12).toFixed(1)}T` : `$${Math.round(w / 1e9)}B`
              : '—';
            return (
              <g
                key={node.id}
                onClick={() => onSelect(node)}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer', opacity: dimmed ? 0.22 : 1, transition: 'opacity 400ms ease' }}
              >
                <title>{node.name}</title>
                <circle
                  cx={x} cy={y} r={r}
                  fill="color-mix(in oklab, var(--cream) 7%, var(--ink))"
                  stroke={isFocus ? 'var(--magenta)' : hovered === node.id ? 'var(--gold)' : dim(30)}
                  strokeWidth={isFocus ? 2 : 1.2}
                  strokeDasharray={node.entity_type === 'PRIVATE' ? '3 2.5' : undefined}
                />
                <text
                  x={x} y={r > 30 ? y - 2 : y + r + 14}
                  textAnchor="middle" className="mono"
                  style={{ fontSize: 12, letterSpacing: '0.1em', paintOrder: 'stroke', stroke: 'var(--ink)', strokeWidth: 4 }}
                  fill={isFocus ? 'var(--magenta)' : 'var(--cream)'}
                >
                  {node.ticker}
                </text>
                <text
                  x={x} y={r > 30 ? y + 14 : y + r + 28}
                  textAnchor="middle" className="mono"
                  style={{ fontSize: 11, paintOrder: 'stroke', stroke: 'var(--ink)', strokeWidth: 4 }}
                  fill={dim(60)}
                >
                  {valueLabel}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* legend + caption */}
      <div className="absolute left-6 bottom-6 z-10 pointer-events-none">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 max-w-[420px]">
          {(Object.keys(KIND_META) as FlowKind[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5 mono text-[11px]" style={{ color: dim(64) }}>
              <span className="inline-block w-4 h-[2px]" style={{ background: KIND_META[k].varName }} />
              {KIND_META[k].label}
            </span>
          ))}
        </div>
        <div className="text-[13px] mt-2 max-w-[380px]" style={{ color: dim(50) }}>
          Circles sized by market value (dashed = private, last round). Scroll to descend —
          dollar amounts reveal with depth. Documented commitments; verify before citing.
        </div>
      </div>
    </div>
  );
}
