'use client';

import React, { useEffect, useState } from 'react';
import { fetchForecast, Forecast } from '@/lib/api';

const REC_VARS: Record<string, string> = {
  strong_buy: 'var(--neon)',
  buy: 'var(--neon)',
  hold: 'var(--gold-matte)',
  underperform: 'var(--terracotta)',
  sell: 'var(--terracotta)',
};

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

function fmt(v: number | null, digits = 1, suffix = ''): string {
  if (v == null) return '—';
  return v.toFixed(digits) + suffix;
}

function Row({ label, value, valueColor }: { label: string; value: React.ReactNode; valueColor?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="mono text-[11px] shrink-0" style={{ color: dim(55) }}>
        {label}
      </span>
      <span className="text-[15px] text-right" style={{ color: valueColor ?? 'var(--cream)' }}>
        {value}
      </span>
    </div>
  );
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
      <div className="glass-electric p-3.5 text-[13px]" style={{ color: dim(55) }}>
        Loading street consensus…
      </div>
    );
  }

  if (!fc || (fc.target_mean == null && fc.forward_pe == null)) {
    return (
      <div className="glass-electric p-3.5 text-[13px]" style={{ color: dim(55) }}>
        No analyst coverage for {ticker} on the free feed.
      </div>
    );
  }

  const upside =
    fc.target_mean != null && fc.current_price != null
      ? (fc.target_mean / fc.current_price - 1) * 100
      : null;

  return (
    <div className="glass-electric p-3.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="descent-eyebrow on-noir">Street forecast</span>
        {fc.recommendation && (
          <span
            className="mono text-[11px]"
            style={{ color: REC_VARS[fc.recommendation] ?? dim(80) }}
          >
            {fc.recommendation.replace('_', ' ')}
            {fc.analyst_count != null && <span style={{ color: dim(45) }}> · {fc.analyst_count}</span>}
          </span>
        )}
      </div>

      {fc.target_mean != null && (
        <Row
          label="Target low / mean / high"
          value={
            <>
              {fmt(fc.target_low, 0)} /{' '}
              <span style={{ color: 'var(--gold-matte)', fontWeight: 500 }}>
                {fmt(fc.target_mean, 0)}
              </span>{' '}
              / {fmt(fc.target_high, 0)}
            </>
          }
        />
      )}

      {upside != null && (
        <Row
          label="Implied upside"
          value={`${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`}
          valueColor={upside >= 0 ? 'var(--neon)' : 'var(--terracotta)'}
        />
      )}

      <div
        className="space-y-1.5 pt-2"
        style={{ borderTop: '1px solid color-mix(in oklab, var(--gold) 20%, transparent)' }}
      >
        <Row label="Fwd / TTM P/E" value={`${fmt(fc.forward_pe)} / ${fmt(fc.trailing_pe)}`} />
        <Row label="EV/EBITDA" value={fmt(fc.ev_to_ebitda)} />
        <Row
          label="Revenue growth"
          value={fc.revenue_growth != null ? `${(fc.revenue_growth * 100).toFixed(0)}%` : '—'}
        />
      </div>
    </div>
  );
}
