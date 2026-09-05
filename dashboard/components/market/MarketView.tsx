'use client';

/* The Market view — terminal-patterns §2 monitor grid.
   Multi-horizon money movement (1D / 1W / 1M) across the whole universe:
   tabular numerals, semantic-only color, sparklines, sortable columns,
   basket filter chips. Click a row to inspect the company. */

import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { BASKET_ROLE_VARS } from '@/components/graph/ChokepointNode';

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

interface MoverRow {
  id: string;
  ticker: string;
  name: string;
  basket: string;
  stage: string;
  price: number | null;
  currency: string | null;
  d1: number | null;
  w1: number | null;
  m1: number | null;
  spark: number[];
}

type SortKey = 'd1' | 'w1' | 'm1' | 'ticker';

const pnl = (v: number | null | undefined) =>
  v == null ? dim(40) : v >= 0 ? 'var(--neon)' : 'var(--terracotta)';

const fmtRet = (v: number | null | undefined) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values || values.length < 2) return <span style={{ color: dim(30) }}>—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 72, h = 20;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.4} />
    </svg>
  );
}

const BASKETS = ['ALL', 'BK_CHOKE', 'BK_FRONT', 'BK_BACK', 'BK_FABLESS', 'BK_INFRA', 'BK_MODELS'];

export default function MarketView({
  activeTicker,
  onSelect,
}: {
  activeTicker: string;
  onSelect: (ticker: string) => void;
}) {
  const [rows, setRows] = useState<MoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('d1');
  const [desc, setDesc] = useState(true);
  const [basket, setBasket] = useState('ALL');

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/market/movers`, { cache: 'no-store' });
        if (!stopped && res.ok) setRows((await res.json()).rows);
      } catch {
        /* API down — empty state below */
      } finally {
        if (!stopped) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 120_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  const sorted = useMemo(() => {
    const filtered = rows.filter((r) => basket === 'ALL' || r.basket === basket);
    return [...filtered].sort((a, b) => {
      if (sortKey === 'ticker') return desc ? b.ticker.localeCompare(a.ticker) : a.ticker.localeCompare(b.ticker);
      const av = a[sortKey] ?? -1e9;
      const bv = b[sortKey] ?? -1e9;
      return desc ? bv - av : av - bv;
    });
  }, [rows, sortKey, desc, basket]);

  const header = (key: SortKey, label: string) => (
    <th
      className="text-right font-normal pb-2 cursor-pointer select-none mono text-[11px]"
      style={{ color: sortKey === key ? 'var(--gold-matte)' : dim(45) }}
      onClick={() => {
        if (sortKey === key) setDesc((d) => !d);
        else {
          setSortKey(key);
          setDesc(true);
        }
      }}
    >
      {label} {sortKey === key ? (desc ? '↓' : '↑') : ''}
    </th>
  );

  return (
    <div className="w-full h-full overflow-y-auto data-grid-dark" style={{ background: 'var(--ink)' }}>
      <div className="px-4 md:px-6 pt-5 pb-8 max-w-[1100px] mx-auto">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div className="descent-eyebrow on-noir">The market / money in motion</div>
          <div className="mono text-[11px]" style={{ color: dim(40) }}>
            Delayed quotes · returns from daily closes · refreshes ~2 min
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-4 flex-wrap">
          {BASKETS.map((b) => {
            const on = basket === b;
            const roleVar = BASKET_ROLE_VARS[b];
            return (
              <button
                key={b}
                onClick={() => setBasket(b)}
                className="mono px-2.5 py-1 text-[11px] rounded-full cursor-pointer"
                style={{
                  color: on ? 'var(--ink)' : dim(65),
                  background: on ? 'var(--cream)' : 'color-mix(in oklab, var(--ink) 60%, transparent)',
                  border: `1px solid ${on ? 'var(--cream)' : roleVar ? `color-mix(in oklab, ${roleVar} 40%, transparent)` : dim(14)}`,
                }}
              >
                {b.replace('BK_', '')}
              </button>
            );
          })}
        </div>

        <div className="glass-electric p-4 mt-4 overflow-x-auto">
          {loading && (
            <div className="text-[14px] py-4" style={{ color: dim(55) }}>
              Computing returns across the universe…
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="text-[14px] py-4" style={{ color: dim(55) }}>
              Market data unavailable — is the API running on :8000?
            </div>
          )}
          {rows.length > 0 && (
            <table className="w-full text-[13px] min-w-[760px]">
              <thead>
                <tr>
                  <th
                    className="text-left font-normal pb-2 cursor-pointer select-none mono text-[11px]"
                    style={{ color: sortKey === 'ticker' ? 'var(--gold-matte)' : dim(45) }}
                    onClick={() => {
                      if (sortKey === 'ticker') setDesc((d) => !d);
                      else {
                        setSortKey('ticker');
                        setDesc(false);
                      }
                    }}
                  >
                    Ticker
                  </th>
                  <th className="text-left font-normal pb-2 mono text-[11px]" style={{ color: dim(45) }}>
                    Name
                  </th>
                  <th className="text-right font-normal pb-2 mono text-[11px]" style={{ color: dim(45) }}>
                    Price
                  </th>
                  {header('d1', '1D')}
                  {header('w1', '1W')}
                  {header('m1', '1M')}
                  <th className="text-right font-normal pb-2 mono text-[11px]" style={{ color: dim(45) }}>
                    1M trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const role = BASKET_ROLE_VARS[r.basket] ?? 'var(--plum)';
                  const active = r.ticker === activeTicker;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onSelect(r.ticker)}
                      className="cursor-pointer"
                      style={{
                        borderTop: `1px solid ${dim(7)}`,
                        background: active ? 'color-mix(in oklab, var(--cream) 5%, transparent)' : 'transparent',
                      }}
                    >
                      <td className="py-1.5">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: role }} />
                          <span className="mono" style={{ color: active ? 'var(--magenta)' : 'var(--cream)' }}>
                            {r.ticker}
                          </span>
                        </span>
                      </td>
                      <td className="truncate max-w-[190px]" style={{ color: dim(60) }}>{r.name}</td>
                      <td className="text-right tabular-nums" style={{ color: dim(80) }}>
                        {r.price != null ? r.price.toLocaleString() : '—'}
                      </td>
                      <td className="text-right tabular-nums" style={{ color: pnl(r.d1) }}>{fmtRet(r.d1)}</td>
                      <td className="text-right tabular-nums" style={{ color: pnl(r.w1) }}>{fmtRet(r.w1)}</td>
                      <td className="text-right tabular-nums" style={{ color: pnl(r.m1) }}>{fmtRet(r.m1)}</td>
                      <td className="pl-4">
                        <div className="flex justify-end">
                          <Sparkline
                            values={r.spark}
                            color={(r.m1 ?? 0) >= 0 ? 'var(--neon)' : 'var(--terracotta)'}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
