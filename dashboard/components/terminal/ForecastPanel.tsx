'use client';

import React, { useEffect, useState } from 'react';
import { fetchForecast, Forecast } from '@/lib/api';

const REC_COLORS: Record<string, string> = {
  strong_buy: 'text-emerald-400',
  buy: 'text-emerald-400',
  hold: 'text-amber-400',
  underperform: 'text-red-400',
  sell: 'text-red-400',
};

function fmt(v: number | null, digits = 1, suffix = ''): string {
  if (v == null) return '—';
  return v.toFixed(digits) + suffix;
}

export default function ForecastPanel({ ticker }: { ticker: string }) {
  const [fc, setFc] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    fetchForecast(ticker).then((res) => {
      if (!stale) {
        setFc(res);
        setLoading(false);
      }
    });
    return () => {
      stale = true;
    };
  }, [ticker]);

  if (loading) {
    return (
      <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-[11px] font-mono text-zinc-500">
        Loading analyst consensus…
      </div>
    );
  }

  if (!fc || (fc.target_mean == null && fc.forward_pe == null)) {
    return (
      <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-[11px] font-mono text-zinc-500">
        No analyst coverage data for {ticker} on the free feed.
      </div>
    );
  }

  const upside =
    fc.target_mean != null && fc.current_price != null
      ? ((fc.target_mean / fc.current_price - 1) * 100)
      : null;

  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-mono text-zinc-400 uppercase">Street Forecast</div>
        {fc.recommendation && (
          <span
            className={`text-[10px] font-mono font-bold uppercase ${
              REC_COLORS[fc.recommendation] ?? 'text-zinc-300'
            }`}
          >
            {fc.recommendation.replace('_', ' ')}
            {fc.analyst_count != null && (
              <span className="text-zinc-500 font-normal"> ({fc.analyst_count})</span>
            )}
          </span>
        )}
      </div>

      {fc.target_mean != null && (
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-mono text-zinc-500">TARGET (LOW/MEAN/HIGH)</span>
          <span className="text-xs font-mono text-zinc-200">
            {fmt(fc.target_low, 0)} / <span className="text-amber-400 font-bold">{fmt(fc.target_mean, 0)}</span> / {fmt(fc.target_high, 0)}
          </span>
        </div>
      )}

      {upside != null && (
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-mono text-zinc-500">IMPLIED UPSIDE</span>
          <span className={`text-xs font-mono font-bold ${upside >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {upside >= 0 ? '+' : ''}{upside.toFixed(1)}%
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-white/5">
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-zinc-500">FWD P/E</span>
          <span className="text-zinc-200">{fmt(fc.forward_pe)}</span>
        </div>
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-zinc-500">TTM P/E</span>
          <span className="text-zinc-200">{fmt(fc.trailing_pe)}</span>
        </div>
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-zinc-500">EV/EBITDA</span>
          <span className="text-zinc-200">{fmt(fc.ev_to_ebitda)}</span>
        </div>
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-zinc-500">REV GRW</span>
          <span className="text-zinc-200">
            {fc.revenue_growth != null ? `${(fc.revenue_growth * 100).toFixed(0)}%` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
