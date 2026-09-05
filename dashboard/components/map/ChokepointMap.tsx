'use client';

/* The Chokepoint Map — symbolic power view of the pipeline.
   VISUAL-DATA-SYSTEM grammar: circles only; size encodes magnitude
   (live USD market cap); dashed = instrument (gold measuring halo on
   chokepoint authorities); solid lines = physical supply flow; one
   magenta focus per view (the selection). Labels carry knockout halos
   (paint-order stroke) — no text under lines. */

import React, { useMemo } from 'react';
import rawData from '@/data/live_telemetry.json';
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

/* Macro-columns: the pipeline read left → right */
const COLUMNS: { key: string; label: string; stages: string[] }[] = [
  { key: 'energy', label: 'Energy', stages: ['ENERGY_GRID'] },
  { key: 'design', label: 'Design & materials', stages: ['EDA_IP', 'RAW_MATERIALS_CHEMISTRY'] },
  { key: 'equipment', label: 'Equipment', stages: ['WFE_LITHOGRAPHY', 'INSPECTION_TESTING'] },
  { key: 'silicon', label: 'Silicon', stages: ['FOUNDRY', 'MEMORY_HBM'] },
  { key: 'package', label: 'Package & test', stages: ['DICING_PACKAGING_SUBSTRATE'] },
  {
    key: 'systems',
    label: 'Systems',
    stages: ['ODM_RACK_INTEGRATION', 'COOLING_THERMAL', 'OPTICAL_FABRIC', 'HYPERSCALE_DEPLOYMENT'],
  },
];

const VB_W = 1240;
const VB_H = 780;
const TOP = 64;
const BOTTOM = 60;
const R_MIN = 11;
const R_MAX = 56;

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

export default function ChokepointMap({ nodes, activeTicker, onSelect }: ChokepointMapProps) {
  const layout = useMemo(() => {
    const maxCap = Math.max(
      1,
      ...nodes.map((n) => n.market_data?.market_cap_usd ?? 0)
    );
    const radius = (n: MapNode) => {
      const cap = n.market_data?.market_cap_usd;
      if (!cap) return R_MIN; // unknown weight → smallest mark
      return r3(R_MIN + (R_MAX - R_MIN) * Math.sqrt(cap / maxCap));
    };

    const colW = VB_W / COLUMNS.length;
    const placed: Record<string, { x: number; y: number; r: number; node: MapNode }> = {};
    const columns = COLUMNS.map((col, ci) => {
      const members = nodes
        .filter((n) => col.stages.includes(n.stage))
        .sort(
          (a, b) =>
            (b.market_data?.market_cap_usd ?? 0) - (a.market_data?.market_cap_usd ?? 0)
        );
      const x = r3(colW * ci + colW / 2);
      // stack with breathing room for the under-labels (law zero)
      const gaps = 30;
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
      return { ...col, x, circles };
    });
    return { columns, placed };
  }, [nodes]);

  const edges = (rawData.edges as { source: string; target: string; criticality: string }[])
    .map((e) => {
      const s = layout.placed[e.source];
      const t = layout.placed[e.target];
      if (!s || !t) return null;
      const mx = r3((s.x + t.x) / 2);
      return {
        d: `M ${r3(s.x)} ${r3(s.y)} C ${mx} ${r3(s.y)}, ${mx} ${r3(t.y)}, ${r3(t.x)} ${r3(t.y)}`,
        critical: e.criticality === 'CRITICAL',
        key: `${e.source}-${e.target}`,
      };
    })
    .filter(Boolean) as { d: string; critical: boolean; key: string }[];

  return (
    <div
      className="relative w-full h-full overflow-auto data-grid-dark"
      style={{ background: 'var(--ink)' }}
    >
      <div className="px-6 pt-5">
        <div className="descent-eyebrow on-noir">The map / who holds the pipeline</div>
      </div>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        style={{ minWidth: 900, color: 'var(--cream)' }}
        role="img"
        aria-label="Supply chain power map: circle area encodes live USD market capitalization"
      >
        {/* flow — solid lines are the physical supply (culture) */}
        <g fill="none">
          {edges.map((e) => (
            <path
              key={e.key}
              d={e.d}
              stroke={e.critical ? 'var(--gold-matte)' : 'var(--plum)'}
              strokeOpacity={e.critical ? 0.55 : 0.45}
              strokeWidth={e.critical ? 1.8 : 1.1}
            />
          ))}
        </g>

        {/* column labels */}
        {layout.columns.map((col) => (
          <text
            key={col.key}
            x={r3(col.x)}
            y={34}
            textAnchor="middle"
            className="mono"
            style={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase' }}
            fill={dim(55)}
          >
            {col.label}
          </text>
        ))}

        {/* the marks */}
        {layout.columns.flatMap((col) =>
          col.circles.map(({ x, y, r, node }) => {
            const role = BASKET_ROLE_VARS[node.basket] ?? 'var(--plum)';
            const isAuthority = node.chokepoint_rating >= 0.9;
            const isFocus = node.ticker === activeTicker;
            const labelInside = r >= 26;
            return (
              <g
                key={node.id}
                onClick={() => onSelect(node)}
                style={{ cursor: 'pointer' }}
              >
                <title>{`${node.name} — crit ${(node.chokepoint_rating * 100).toFixed(0)}%`}</title>
                {/* dashed gold measuring halo = chokepoint authority */}
                {isAuthority && (
                  <circle
                    cx={x}
                    cy={y}
                    r={r3(r + 6)}
                    fill="none"
                    stroke="var(--gold)"
                    strokeWidth={1}
                    strokeDasharray="2.5 4"
                    opacity={0.9}
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={`color-mix(in oklab, ${role} 22%, var(--ink))`}
                  stroke={isFocus ? 'var(--magenta)' : role}
                  strokeWidth={isFocus ? 2 : 1.3}
                />
                <text
                  x={x}
                  y={labelInside ? y + 4 : r3(y + r + (isAuthority ? 22 : 16))}
                  textAnchor="middle"
                  className="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    paintOrder: 'stroke',
                    stroke: 'var(--ink)',
                    strokeWidth: 4,
                  }}
                  fill={isFocus ? 'var(--magenta)' : 'var(--cream)'}
                >
                  {node.ticker}
                </text>
              </g>
            );
          })
        )}
      </svg>

      {/* caption + legend — one line stating the claim */}
      <div className="px-6 pb-5 -mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="text-[13px]" style={{ color: dim(64) }}>
          Circle area = live market capitalization (USD-normalized). Dashed gold halo =
          chokepoint authority.
        </span>
        <span className="flex items-center gap-4">
          {Object.entries(BASKET_ROLE_VARS).map(([basket, roleVar]) => (
            <span key={basket} className="flex items-center gap-1.5 mono text-[11px]" style={{ color: dim(64) }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: roleVar }} />
              {basket.replace('BK_', '')}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
