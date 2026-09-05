'use client';

/* The Book — full paper-portfolio dashboard view.
   Stat tiles → equity curve → positions (click = inspect) | ticket,
   allocation by basket, trade log. Simulation only: virtual cash,
   delayed quotes, nothing ever reaches a market. */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
import { API_BASE } from '@/lib/api';
import { BASKET_ROLE_VARS } from '@/components/graph/ChokepointNode';

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

const num = (v: number | null | undefined, digits = 2) => {
  if (v == null) return '—';
  const n = v || 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const signOf = (v: number | null | undefined) => ((v || 0) >= 0 ? '+' : '');
const pnlColor = (v: number | null | undefined) =>
  v == null ? dim(50) : (v || 0) >= 0 ? 'var(--neon)' : 'var(--terracotta)';

interface Position {
  ticker: string;
  qty: number;
  avg_cost: number | null;
  mark: number | null;
  unrealized_pnl: number | null;
  realized_pnl: number;
}
interface Portfolio {
  cash: number;
  starting_cash: number;
  equity: number;
  return_pct: number;
  positions: Position[];
  unrealized_pnl_total: number;
  trade_count: number;
}
interface Trade {
  ts: number;
  ticker: string;
  side: string;
  qty: number;
  price: number;
  currency: string | null;
}

interface BookNode {
  ticker: string;
  name: string;
  basket: string;
  [key: string]: unknown;
}

interface BookViewProps {
  nodes: BookNode[];
  activeTicker: string;
  onSelect: (ticker: string) => void;
}

function EquityChart({ version }: { version: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const tokens = getComputedStyle(document.documentElement);
    const t = (name: string, fb: string) => tokens.getPropertyValue(name).trim() || fb;
    const chart = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: t('--cream', '#F2F0EC') + '99',
        fontFamily: t('--font-sans', 'sans-serif'),
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(242,240,236,0.04)' },
        horzLines: { color: 'rgba(242,240,236,0.04)' },
      },
      width: ref.current.clientWidth,
      height: 220,
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      handleScroll: false,
      handleScale: false,
    });
    const gold = t('--gold-matte', '#B5A06A');
    const series = chart.addSeries(AreaSeries, {
      lineColor: gold,
      lineWidth: 2,
      topColor: 'rgba(181,160,106,0.25)',
      bottomColor: 'rgba(181,160,106,0.0)',
      crosshairMarkerVisible: false,
    });
    let disposed = false;
    fetch(`${API_BASE}/sim/equity`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (disposed) return;
        const curve = data?.curve ?? [];
        if (curve.length === 0) {
          setNote('No trades yet — fill a paper ticket and the curve begins.');
          return;
        }
        if (curve.length === 1) {
          setNote('Day one on the books — the curve grows with each market day.');
        }
        series.setData(curve);
        chart.timeScale().fitContent();
      })
      .catch(() => setNote('Equity history unavailable — is the API running?'));
    const onResize = () => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    };
    window.addEventListener('resize', onResize);
    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      chart.remove();
    };
  }, [version]);

  return (
    <div className="relative">
      <div ref={ref} className="w-full h-[220px]" />
      {note && (
        <div className="absolute inset-x-0 top-2 text-center text-[13px]" style={{ color: dim(50) }}>
          {note}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, valueColor, sub }: { label: string; value: React.ReactNode; valueColor?: string; sub?: string }) {
  return (
    <div className="glass-electric p-3.5 min-w-0">
      <div className="mono text-[11px]" style={{ color: dim(55) }}>{label}</div>
      <div className="display text-[24px] md:text-[28px] mt-1 tabular-nums truncate" style={{ color: valueColor ?? 'var(--cream)' }}>
        {value}
      </div>
      {sub && (
        <div className="mono text-[11px] mt-0.5" style={{ color: dim(45) }}>{sub}</div>
      )}
    </div>
  );
}

export default function BookView({ nodes, activeTicker, onSelect }: BookViewProps) {
  const [book, setBook] = useState<Portfolio | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [version, setVersion] = useState(0); // bump refreshes the equity chart
  const [ticker, setTicker] = useState(activeTicker);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState('10');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [p, tr] = await Promise.all([
        fetch(`${API_BASE}/sim/portfolio`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_BASE}/sim/trades`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
      ]);
      setBook(p);
      setTrades(tr);
    } catch {
      setBook(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const placeOrder = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/sim/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, side, qty: Number(qty) }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setMsg(`Paper ${side} ${qty} ${ticker} filled @ ${num(data.fill_price)} ${data.currency ?? ''}`);
        refresh();
        setVersion((v) => v + 1);
      } else {
        setMsg(data?.detail ?? 'Order rejected');
      }
    } catch {
      setMsg(`Could not reach the API at ${API_BASE}`);
    } finally {
      setBusy(false);
    }
  };

  const nodeMeta = (t: string) => nodes.find((n) => n.ticker === t);
  const grossValue = (book?.positions ?? []).reduce(
    (s, p) => s + (p.mark != null ? p.mark * p.qty : 0),
    0
  );
  const allocation = Object.entries(
    (book?.positions ?? []).reduce<Record<string, number>>((acc, p) => {
      if (p.mark == null || p.qty <= 0) return acc;
      const basket = nodeMeta(p.ticker)?.basket ?? 'BK_INFRA';
      acc[basket] = (acc[basket] ?? 0) + p.mark * p.qty;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="w-full h-full overflow-y-auto data-grid-dark" style={{ background: 'var(--ink)' }}>
      <div className="px-4 md:px-6 pt-5 pb-8 max-w-[1200px] mx-auto">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div className="descent-eyebrow on-noir">The book / paper portfolio</div>
          <div className="mono text-[11px]" style={{ color: dim(40) }}>
            Simulation only — virtual cash, delayed quotes, nothing reaches a market
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <Tile label="Equity" value={`$${num(book?.equity, 0)}`} />
          <Tile label="Cash" value={`$${num(book?.cash, 0)}`} />
          <Tile
            label="Unrealized P&L"
            value={`${signOf(book?.unrealized_pnl_total)}${num(book?.unrealized_pnl_total, 0)}`}
            valueColor={pnlColor(book?.unrealized_pnl_total)}
          />
          <Tile
            label="Return"
            value={`${signOf(book?.return_pct)}${num(book?.return_pct, 2)}%`}
            valueColor={pnlColor(book?.return_pct)}
            sub={book ? `${book.trade_count} fills` : undefined}
          />
        </div>

        {/* Equity curve */}
        <div className="glass-electric p-4 mt-4">
          <div className="descent-eyebrow on-noir mb-2">Equity curve</div>
          <EquityChart version={version} />
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-4 mt-4 items-start">
          {/* Positions */}
          <div className="glass-electric p-4 min-w-0">
            <div className="descent-eyebrow on-noir mb-2.5">Positions</div>
            {book && book.positions.filter((p) => p.qty > 0).length === 0 && (
              <div className="text-[14px] py-2" style={{ color: dim(55) }}>
                Nothing on the book. Fill a ticket and start playing the thesis.
              </div>
            )}
            {book && book.positions.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] min-w-[520px]">
                  <thead>
                    <tr className="mono text-[11px]" style={{ color: dim(45) }}>
                      <th className="text-left font-normal pb-1.5">Ticker</th>
                      <th className="text-right font-normal pb-1.5">Qty</th>
                      <th className="text-right font-normal pb-1.5">Avg</th>
                      <th className="text-right font-normal pb-1.5">Mark</th>
                      <th className="text-right font-normal pb-1.5">Weight</th>
                      <th className="text-right font-normal pb-1.5">Unrlzd</th>
                      <th className="text-right font-normal pb-1.5">Rlzd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {book.positions.map((p) => {
                      const meta = nodeMeta(p.ticker);
                      const role = meta ? BASKET_ROLE_VARS[meta.basket] : 'var(--plum)';
                      const weight =
                        grossValue > 0 && p.mark != null && p.qty > 0
                          ? ((p.mark * p.qty) / grossValue) * 100
                          : null;
                      return (
                        <tr
                          key={p.ticker}
                          onClick={() => onSelect(p.ticker)}
                          className="cursor-pointer"
                          style={{ borderTop: `1px solid ${dim(8)}` }}
                          title={meta?.name}
                        >
                          <td className="py-2">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: role }} />
                              <span className="mono" style={{ color: 'var(--cream)' }}>{p.ticker}</span>
                            </span>
                          </td>
                          <td className="text-right tabular-nums" style={{ color: dim(80) }}>{p.qty}</td>
                          <td className="text-right tabular-nums" style={{ color: dim(80) }}>{num(p.avg_cost)}</td>
                          <td className="text-right tabular-nums" style={{ color: dim(80) }}>{num(p.mark)}</td>
                          <td className="text-right tabular-nums" style={{ color: dim(65) }}>
                            {weight != null ? `${weight.toFixed(1)}%` : '—'}
                          </td>
                          <td className="text-right tabular-nums" style={{ color: pnlColor(p.unrealized_pnl) }}>
                            {p.unrealized_pnl != null ? signOf(p.unrealized_pnl) : ''}
                            {num(p.unrealized_pnl)}
                          </td>
                          <td className="text-right tabular-nums" style={{ color: p.realized_pnl >= 0 ? dim(80) : 'var(--terracotta)' }}>
                            {num(p.realized_pnl)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mono text-[11px] mt-3" style={{ color: dim(40) }}>
              Click a position to inspect the company. Non-USD fills are not yet FX-converted in totals.
            </div>
          </div>

          <div className="space-y-4 min-w-0">
            {/* Ticket */}
            <div className="glass-electric p-4">
              <div className="descent-eyebrow on-noir mb-2.5">Paper ticket</div>
              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="mono text-[13px] px-3 py-2 rounded-lg cursor-pointer flex-1 min-w-0"
                  style={{
                    background: 'color-mix(in oklab, var(--cream) 6%, transparent)',
                    border: `1px solid ${dim(14)}`,
                    color: 'var(--cream)',
                  }}
                >
                  {nodes.map((n) => (
                    <option key={n.ticker} value={n.ticker} style={{ background: 'var(--ink)' }}>
                      {n.ticker} — {n.name}
                    </option>
                  ))}
                </select>
                <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${dim(14)}` }}>
                  {(['BUY', 'SELL'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSide(s)}
                      className="mono text-[12px] px-3.5 py-2 cursor-pointer"
                      style={{
                        background:
                          side === s
                            ? s === 'BUY'
                              ? 'color-mix(in oklab, var(--neon) 25%, var(--ink))'
                              : 'color-mix(in oklab, var(--terracotta) 30%, var(--ink))'
                            : 'transparent',
                        color: side === s ? 'var(--cream)' : dim(55),
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))}
                  inputMode="decimal"
                  className="mono text-[13px] w-20 px-3 py-2 rounded-lg text-right tabular-nums focus:outline-none"
                  style={{
                    background: 'color-mix(in oklab, var(--cream) 6%, transparent)',
                    border: `1px solid ${dim(14)}`,
                    color: 'var(--cream)',
                  }}
                />
                <button
                  onClick={placeOrder}
                  disabled={busy || !qty}
                  className="mono text-[12px] px-4 py-2 rounded-full cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--cream)', color: 'var(--ink)' }}
                >
                  {busy ? 'Filling…' : 'Fill'}
                </button>
              </div>
              {msg && (
                <div className="mt-2.5 text-[13px]" style={{ color: dim(75) }}>{msg}</div>
              )}
            </div>

            {/* Allocation by basket */}
            <div className="glass-electric p-4">
              <div className="descent-eyebrow on-noir mb-2.5">Allocation</div>
              {allocation.length === 0 && (
                <div className="text-[13px]" style={{ color: dim(50) }}>No holdings yet.</div>
              )}
              {allocation.map(([basket, value]) => {
                const pct = grossValue > 0 ? (value / grossValue) * 100 : 0;
                const role = BASKET_ROLE_VARS[basket] ?? 'var(--plum)';
                return (
                  <div key={basket} className="mb-2">
                    <div className="flex items-baseline justify-between mono text-[11px]" style={{ color: dim(65) }}>
                      <span>{basket.replace('BK_', '')}</span>
                      <span className="tabular-nums">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1 rounded-full mt-1 overflow-hidden" style={{ background: dim(8) }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: role }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Trade log */}
            <div className="glass-electric p-4">
              <div className="descent-eyebrow on-noir mb-2.5">Trade log</div>
              {trades.length === 0 && (
                <div className="text-[13px]" style={{ color: dim(50) }}>No fills yet.</div>
              )}
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                {trades.map((t, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-[12px]">
                    <span className="mono shrink-0" style={{ color: dim(45) }}>
                      {new Date(t.ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span
                      className="mono shrink-0"
                      style={{ color: t.side === 'BUY' ? 'var(--neon)' : 'var(--terracotta)' }}
                    >
                      {t.side}
                    </span>
                    <span className="mono" style={{ color: 'var(--cream)' }}>{t.ticker}</span>
                    <span className="tabular-nums ml-auto" style={{ color: dim(70) }}>
                      {t.qty} @ {num(t.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
