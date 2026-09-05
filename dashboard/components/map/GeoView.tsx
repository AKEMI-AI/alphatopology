'use client';

/* Geo view — where the pipeline's power physically sits.
   Rows per country; circle area = live USD market cap; dashed gold ring =
   chokepoint authority (crit ≥ 0.9). One magenta claim per view: the
   East-Asia concentration figure. */

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { BASKET_ROLE_VARS } from '@/components/graph/ChokepointNode';

const GlobeView = dynamic(() => import('@/components/geo/GlobeView'), { ssr: false });

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  JP: 'Japan',
  TW: 'Taiwan',
  KR: 'South Korea',
  NL: 'Netherlands',
  FR: 'France',
  GB: 'United Kingdom',
};

const EAST_ASIA = new Set(['TW', 'KR', 'JP']);

interface GeoNode {
  id: string;
  ticker: string;
  name: string;
  basket: string;
  country?: string;
  chokepoint_rating: number;
  market_data?: { market_cap_usd?: number | null };
  [key: string]: unknown;
}

interface GeoViewProps {
  nodes: GeoNode[];
  activeTicker: string;
  onSelect: (node: GeoNode) => void;
}

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

const fmtCap = (v: number) =>
  v >= 1e12 ? `$${(v / 1e12).toFixed(1)}T` : `$${Math.round(v / 1e9)}B`;

export default function GeoView({ nodes, activeTicker, onSelect }: GeoViewProps) {
  const [mode, setMode] = useState<'globe' | 'ledger'>('globe');
  const { rows, eastAsiaAuthorityShare } = useMemo(() => {
    const byCountry = new Map<string, GeoNode[]>();
    for (const n of nodes) {
      const c = n.country ?? '??';
      byCountry.set(c, [...(byCountry.get(c) ?? []), n]);
    }
    const maxCap = Math.max(1, ...nodes.map((n) => n.market_data?.market_cap_usd ?? 0));

    const rows = [...byCountry.entries()]
      .map(([code, members]) => {
        const cap = members.reduce((s, m) => s + (m.market_data?.market_cap_usd ?? 0), 0);
        const authorities = members.filter((m) => m.chokepoint_rating >= 0.9);
        return {
          code,
          name: COUNTRY_NAMES[code] ?? code,
          members: members.sort(
            (a, b) => (b.market_data?.market_cap_usd ?? 0) - (a.market_data?.market_cap_usd ?? 0)
          ),
          cap,
          authorities: authorities.length,
        };
      })
      .sort((a, b) => b.cap - a.cap);

    const totalAuthorities = nodes.filter((n) => n.chokepoint_rating >= 0.9).length;
    const eastAsia = nodes.filter(
      (n) => n.chokepoint_rating >= 0.9 && EAST_ASIA.has(n.country ?? '')
    ).length;

    return {
      rows,
      maxCap,
      eastAsiaAuthorityShare: totalAuthorities
        ? Math.round((eastAsia / totalAuthorities) * 100)
        : 0,
    };
  }, [nodes]);

  const maxCap = Math.max(1, ...nodes.map((n) => n.market_data?.market_cap_usd ?? 0));
  const diameter = (n: GeoNode) => {
    const cap = n.market_data?.market_cap_usd;
    if (!cap) return 14;
    return Math.round(14 + 44 * Math.sqrt(cap / maxCap));
  };

  const subToggle = (
    <div
      className="absolute top-4 right-6 z-20 flex items-center gap-1 p-0.5 rounded-full"
      style={{ border: '1px solid color-mix(in oklab, var(--cream) 14%, transparent)', background: 'color-mix(in oklab, var(--ink) 70%, transparent)' }}
    >
      {(['globe', 'ledger'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className="mono px-3 py-1 text-[11px] rounded-full transition-colors cursor-pointer capitalize"
          style={{
            color: mode === m ? 'var(--ink)' : dim(70),
            background: mode === m ? 'var(--cream)' : 'transparent',
          }}
        >
          {m}
        </button>
      ))}
    </div>
  );

  if (mode === 'globe') {
    return (
      <div className="relative w-full h-full">
        {subToggle}
        <GlobeView
          nodes={nodes}
          activeTicker={activeTicker}
          onSelect={onSelect}
          onZoomFloor={() => setMode('ledger')}
        />
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden lg:block">
          <p className="text-[15px]" style={{ color: dim(75) }}>
            <span className="descent-living-word">{`${eastAsiaAuthorityShare}%`}</span>{' '}
            of chokepoint authorities sit in TW · KR · JP
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-y-auto data-grid-dark"
      style={{ background: 'var(--ink)' }}
    >
      {subToggle}
      <div className="px-6 pt-5 pb-2">
        <div className="descent-eyebrow on-noir">Geography / where the power sits</div>
        <p className="mt-3 text-[16px] max-w-2xl" style={{ color: dim(80) }}>
          <span
            className="descent-living-word"
            style={{ fontSize: '1.15em' }}
          >{`${eastAsiaAuthorityShare}%`}</span>{' '}
          of the pipeline&apos;s chokepoint authorities sit in Taiwan, South Korea, and Japan —
          inside a single geopolitical weather system.
        </p>
      </div>

      <div className="px-6 pb-6 space-y-3">
        {rows.map((row) => (
          <div key={row.code} className="glass-electric p-4">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div className="flex items-baseline gap-3 min-w-0">
                <span className="display text-[22px]" style={{ color: 'var(--cream)' }}>
                  {row.name}
                </span>
                <span className="mono text-[11px]" style={{ color: dim(50) }}>
                  {row.code} · {row.members.length} entities
                </span>
              </div>
              <div className="flex items-baseline gap-5">
                <span className="mono text-[11px]" style={{ color: dim(60) }}>
                  Cap <strong style={{ color: 'var(--cream)', fontWeight: 600 }}>{fmtCap(row.cap)}</strong>
                </span>
                <span className="mono text-[11px]" style={{ color: 'var(--gold-matte)' }}>
                  {row.authorities > 0
                    ? `${row.authorities} chokepoint${row.authorities > 1 ? 's' : ''}`
                    : '—'}
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-end gap-3 flex-wrap">
              {row.members.map((m) => {
                const d = diameter(m);
                const role = BASKET_ROLE_VARS[m.basket] ?? 'var(--plum)';
                const isAuthority = m.chokepoint_rating >= 0.9;
                const isFocus = m.ticker === activeTicker;
                return (
                  <button
                    key={m.id}
                    onClick={() => onSelect(m)}
                    className="flex flex-col items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                    title={`${m.name} — crit ${(m.chokepoint_rating * 100).toFixed(0)}%`}
                  >
                    <span
                      className="rounded-full inline-block"
                      style={{
                        width: d,
                        height: d,
                        background: `color-mix(in oklab, ${role} 22%, var(--ink))`,
                        border: `${isFocus ? 2 : 1.3}px solid ${isFocus ? 'var(--magenta)' : role}`,
                        outline: isAuthority ? '1px dashed var(--gold)' : undefined,
                        outlineOffset: 4,
                      }}
                    />
                    <span
                      className="mono text-[11px]"
                      style={{ color: isFocus ? 'var(--magenta)' : dim(70) }}
                    >
                      {m.ticker}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 pb-5 text-[13px]" style={{ color: dim(55) }}>
        Circle area = live market capitalization (USD-normalized). Dashed gold ring = chokepoint
        authority (crit ≥ 90%).
      </div>
    </div>
  );
}
