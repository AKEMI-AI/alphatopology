'use client';

/* The Book — paper-trading portfolio panel. Positions marked to live
   quotes + a paper order ticket. Simulation only: fills at delayed
   quotes against virtual cash, no brokerage anywhere. */

import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

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
  positions: Position[];
  unrealized_pnl_total: number;
  trade_count: number;
}

interface BookDrawerProps {
  open: boolean;
  onClose: () => void;
  tickers: string[];
  defaultTicker: string;
}

const num = (v: number | null | undefined, digits = 2) => {
  if (v == null) return '—';
  const n = v || 0; // normalizes -0
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const signOf = (v: number | null | undefined) => ((v || 0) >= 0 ? '+' : '');

export default function BookDrawer({ open, onClose, tickers, defaultTicker }: BookDrawerProps) {
  const [book, setBook] = useState<Portfolio | null>(null);
  const [ticker, setTicker] = useState(defaultTicker);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState('10');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/sim/portfolio`, { cache: 'no-store' });
      if (res.ok) setBook(await res.json());
    } catch {
      setBook(null);
    }
  }, []);

  useEffect(() => {
    if (open) {
      refresh();
      setTicker(defaultTicker);
    }
  }, [open, refresh, defaultTicker]);

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
      } else {
        setMsg(data?.detail ?? 'Order rejected');
      }
    } catch {
      setMsg(`Could not reach the API at ${API_BASE}`);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const totalPnl = book ? book.unrealized_pnl_total : null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-start justify-center pt-[9vh] px-4"
      style={{ background: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}
      onClick={onClose}
    >
      <div
        className="glass-electric w-full max-w-[640px] max-h-[80vh] overflow-y-auto !rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-baseline justify-between px-5 py-4"
          style={{ borderBottom: '1px solid color-mix(in oklab, var(--gold) 25%, transparent)' }}
        >
          <div>
            <div className="descent-eyebrow on-noir">The book / paper account</div>
            {book && (
              <div className="mt-1.5 flex items-baseline gap-5">
                <span className="display text-[24px]" style={{ color: 'var(--cream)' }}>
                  ${num(book.cash, 0)} <span className="text-[14px]" style={{ color: dim(50) }}>cash</span>
                </span>
                {totalPnl != null && (
                  <span
                    className="mono text-[13px] tabular-nums"
                    style={{ color: (totalPnl || 0) >= 0 ? 'var(--neon)' : 'var(--terracotta)' }}
                  >
                    {signOf(totalPnl)}
                    {num(totalPnl)} unrealized
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="mono text-[11px] cursor-pointer bg-transparent border-0"
            style={{ color: dim(55) }}
          >
            Close
          </button>
        </div>

        {/* positions — monitor-grid rules: tabular numerals, semantic color */}
        <div className="px-5 py-3">
          {!book && (
            <div className="text-[14px] py-2" style={{ color: dim(55) }}>
              Book unavailable — is the API running on :8000?
            </div>
          )}
          {book && book.positions.length === 0 && (
            <div className="text-[14px] py-2" style={{ color: dim(55) }}>
              No positions yet. Fill a paper ticket below — simulated fills at delayed quotes,
              no real orders anywhere.
            </div>
          )}
          {book && book.positions.length > 0 && (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="mono text-[11px]" style={{ color: dim(45) }}>
                  <th className="text-left font-normal pb-1.5">Ticker</th>
                  <th className="text-right font-normal pb-1.5">Qty</th>
                  <th className="text-right font-normal pb-1.5">Avg</th>
                  <th className="text-right font-normal pb-1.5">Mark</th>
                  <th className="text-right font-normal pb-1.5">Unrlzd</th>
                  <th className="text-right font-normal pb-1.5">Rlzd</th>
                </tr>
              </thead>
              <tbody>
                {book.positions.map((p) => (
                  <tr key={p.ticker} style={{ borderTop: `1px solid ${dim(8)}` }}>
                    <td className="mono py-1.5" style={{ color: 'var(--cream)' }}>{p.ticker}</td>
                    <td className="text-right tabular-nums py-1.5" style={{ color: dim(80) }}>{p.qty}</td>
                    <td className="text-right tabular-nums py-1.5" style={{ color: dim(80) }}>{num(p.avg_cost)}</td>
                    <td className="text-right tabular-nums py-1.5" style={{ color: dim(80) }}>{num(p.mark)}</td>
                    <td
                      className="text-right tabular-nums py-1.5"
                      style={{
                        color:
                          p.unrealized_pnl == null ? dim(50)
                          : p.unrealized_pnl >= 0 ? 'var(--neon)' : 'var(--terracotta)',
                      }}
                    >
                      {p.unrealized_pnl != null ? signOf(p.unrealized_pnl) : ''}
                      {num(p.unrealized_pnl)}
                    </td>
                    <td
                      className="text-right tabular-nums py-1.5"
                      style={{ color: p.realized_pnl >= 0 ? dim(80) : 'var(--terracotta)' }}
                    >
                      {num(p.realized_pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* paper order ticket */}
        <div
          className="px-5 py-4"
          style={{ borderTop: '1px solid color-mix(in oklab, var(--gold) 20%, transparent)' }}
        >
          <div className="descent-eyebrow on-noir mb-2.5">Paper ticket</div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="mono text-[13px] px-3 py-2 rounded-lg cursor-pointer"
              style={{
                background: 'color-mix(in oklab, var(--cream) 6%, transparent)',
                border: `1px solid ${dim(14)}`,
                color: 'var(--cream)',
              }}
            >
              {tickers.map((t) => (
                <option key={t} value={t} style={{ background: 'var(--ink)' }}>
                  {t}
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
              {busy ? 'Filling…' : 'Fill paper order'}
            </button>
          </div>
          {msg && (
            <div className="mt-2.5 text-[13px]" style={{ color: dim(75) }}>
              {msg}
            </div>
          )}
          <div className="mono text-[11px] mt-3" style={{ color: dim(40) }}>
            Simulation only — virtual cash, delayed quotes, nothing reaches a market.
          </div>
        </div>
      </div>
    </div>
  );
}
