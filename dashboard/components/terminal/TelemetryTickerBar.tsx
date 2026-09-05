'use client';

import React, { useEffect, useState } from 'react';
import fallbackTelemetry from '@/data/live_telemetry.json';
import { fetchTelemetry } from '@/lib/api';

const REFRESH_MS = 60_000;

const STATUS_COLORS: Record<string, string> = {
  SEVERE_BOTTLENECK: 'text-red-400',
  CRITICAL: 'text-red-400',
  CONSTRAINED: 'text-amber-400',
  TIGHT: 'text-amber-400',
  ALLOCATED: 'text-amber-400',
  SURGING: 'text-emerald-400',
  COMMITTED: 'text-emerald-400',
  OPTIMAL: 'text-emerald-400',
  BALANCED: 'text-zinc-500',
};

interface TelemetryEntry {
  ticker: string;
  market_data: { price: number | null; change_pct: number | null; currency: string | null; live: boolean };
  telemetry: { metric: string; value: string; status: string; lead_time_trend: string; data_source?: string };
}

export default function TelemetryTickerBar() {
  const [entries, setEntries] = useState<TelemetryEntry[]>(
    fallbackTelemetry.nodes as TelemetryEntry[]
  );
  const [apiConnected, setApiConnected] = useState(false);

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      const res = await fetchTelemetry();
      if (!stopped && res) {
        setEntries(res.nodes as unknown as TelemetryEntry[]);
        setApiConnected(true);
      } else if (!stopped) {
        setApiConnected(false);
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
  const marketDataAvailable = apiConnected && entries.some((n) => n.market_data.live);
  // Duplicate the strip so the marquee loops seamlessly
  const strip = [...nodes, ...nodes];

  return (
    <div className="w-full h-9 bg-[#060709] border-b border-white/10 overflow-hidden flex items-center shrink-0">
      <div
        className={`flex items-center gap-2 px-3 h-full z-10 border-r ${
          marketDataAvailable
            ? 'bg-emerald-500/10 border-emerald-500/20'
            : 'bg-amber-500/10 border-amber-500/20'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full animate-pulse ${
            marketDataAvailable ? 'bg-emerald-400' : 'bg-amber-400'
          }`}
        />
        <span
          className={`text-[10px] font-mono font-bold tracking-widest whitespace-nowrap ${
            marketDataAvailable ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          {marketDataAvailable ? 'MARKET DATA AVAILABLE' : apiConnected ? 'MARKET FEED DEGRADED' : 'CACHED SNAPSHOT'}
        </span>
      </div>
      <div className="relative flex-1 overflow-hidden h-full">
        <div className="ticker-marquee absolute flex items-center h-full gap-8 whitespace-nowrap pl-4">
          {strip.map((n, i) => {
            const chg = n.market_data.change_pct ?? 0;
            return (
              <span key={`${n.ticker}-${i}`} className="flex items-center gap-2 text-[11px] font-mono">
                <span className="font-bold text-zinc-100">{n.ticker}</span>
                {n.market_data.live && n.market_data.price != null && (
                  <span className={chg >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {n.market_data.price.toLocaleString()} {n.market_data.currency}{' '}
                    {chg >= 0 ? '▲' : '▼'}{Math.abs(chg).toFixed(2)}%
                  </span>
                )}
                <span className="text-zinc-500">{n.telemetry.metric}:</span>
                <span className="text-zinc-300">{n.telemetry.value}</span>
                <span className={`font-bold ${STATUS_COLORS[n.telemetry.status] ?? 'text-zinc-400'}`}>
                  [{n.telemetry.status}]
                </span>
                {(n.telemetry.data_source ?? 'FIXTURE_ESTIMATE') === 'FIXTURE_ESTIMATE' && (
                  <span className="text-amber-500 text-[9px]">[FIXTURE]</span>
                )}
                {n.telemetry.lead_time_trend === 'EXPANDING' && (
                  <span className="text-amber-400 text-[10px]">LEAD↗</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      <style jsx>{`
        .ticker-marquee {
          animation: ticker-scroll 45s linear infinite;
        }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
