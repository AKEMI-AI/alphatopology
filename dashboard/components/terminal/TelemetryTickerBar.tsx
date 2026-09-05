'use client';

import React, { useEffect, useState } from 'react';
import fallbackTelemetry from '@/data/live_telemetry.json';
import { fetchTelemetry } from '@/lib/api';

const REFRESH_MS = 60_000;

/* Status → token. Terracotta = stressed, gold-matte = tight/allocated,
   neon = live/healthy. Magenta is never spent here. */
const STATUS_VARS: Record<string, string> = {
  SEVERE_BOTTLENECK: 'var(--terracotta)',
  CRITICAL: 'var(--terracotta)',
  CONSTRAINED: 'var(--gold-matte)',
  TIGHT: 'var(--gold-matte)',
  ALLOCATED: 'var(--gold-matte)',
  SURGING: 'var(--neon)',
  COMMITTED: 'var(--neon)',
  OPTIMAL: 'var(--neon)',
};

interface TelemetryEntry {
  ticker: string;
  market_data: { price: number | null; change_pct: number | null; currency: string | null; live: boolean };
  telemetry: { metric: string; value: string; status: string; lead_time_trend: string };
}

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

export default function TelemetryTickerBar() {
  const [entries, setEntries] = useState<TelemetryEntry[]>(
    fallbackTelemetry.nodes as TelemetryEntry[]
  );
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      const res = await fetchTelemetry();
      if (!stopped && res) {
        setEntries(res.nodes as unknown as TelemetryEntry[]);
        setIsLive(true);
      } else if (!stopped) {
        setIsLive(false);
      }
    };
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  const nodes = entries.filter((n) => n.telemetry.status !== 'BALANCED');
  // Duplicate the strip so the marquee loops seamlessly
  const strip = [...nodes, ...nodes];

  return (
    <div
      className="w-full h-9 overflow-hidden flex items-center shrink-0"
      style={{
        background: 'color-mix(in oklab, var(--ink) 88%, var(--plum))',
        borderBottom: '1px solid color-mix(in oklab, var(--cream) 8%, transparent)',
      }}
    >
      <div
        className="flex items-center gap-2 px-3 h-full z-10 shrink-0"
        style={{ borderRight: '1px solid color-mix(in oklab, var(--gold) 30%, transparent)' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: isLive ? 'var(--neon)' : 'var(--gold-matte)' }}
        />
        <span
          className="mono text-[11px] whitespace-nowrap"
          style={{ color: isLive ? 'var(--neon)' : 'var(--gold-matte)' }}
        >
          {isLive ? 'Signal' : 'Cached'}
        </span>
      </div>
      <div className="relative flex-1 overflow-hidden h-full">
        <div className="ticker-marquee absolute flex items-center h-full gap-8 whitespace-nowrap pl-4">
          {strip.map((n, i) => {
            const chgVal = n.market_data.change_pct ?? 0;
            return (
              <span key={`${n.ticker}-${i}`} className="flex items-center gap-2 text-[12px]">
                <span className="mono text-[11px]" style={{ color: 'var(--cream)' }}>
                  {n.ticker}
                </span>
                {n.market_data.live && n.market_data.price != null && (
                  <span
                    style={{ color: chgVal >= 0 ? 'var(--neon)' : 'var(--terracotta)' }}
                  >
                    {n.market_data.price.toLocaleString()} {n.market_data.currency}{' '}
                    {chgVal >= 0 ? '▲' : '▼'}
                    {Math.abs(chgVal).toFixed(2)}%
                  </span>
                )}
                <span style={{ color: dim(50) }}>{n.telemetry.metric}</span>
                <span style={{ color: dim(85) }}>{n.telemetry.value}</span>
                <span style={{ color: STATUS_VARS[n.telemetry.status] ?? dim(60) }}>
                  {n.telemetry.status.replace(/_/g, ' ').toLowerCase()}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
