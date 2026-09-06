'use client';

/* Command palette — the terminal is addressed, not navigated.
   Spec: docs/design/terminal-patterns.md §1. Grammar: `QUERY [CODE]`.
   Rows carry monitor-grid DNA: role dot, mono ticker, live price +
   signed change right-aligned in tabular numerals. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BASKET_ROLE_VARS } from '@/components/graph/ChokepointNode';

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

export interface PaletteNode {
  id: string;
  ticker: string;
  name: string;
  basket: string;
  market_data?: { price?: number | null; change_pct?: number | null; currency?: string | null };
  [key: string]: unknown;
}

const VIEW_CODES: Record<string, string> = {
  g: 'graph', graph: 'graph',
  m: 'map', map: 'map',
  geo: 'geo', globe: 'geo',
  b: 'book', book: 'book',
  f: 'flows', flows: 'flows', money: 'flows',
  mkt: 'market', market: 'market', pulse: 'market',
  n: 'news', news: 'news', signal: 'news',
  led: 'geo', ledger: 'geo',
};

interface CommandPaletteProps {
  nodes: PaletteNode[];
  onSelect: (ticker: string) => void;
  onView: (view: string) => void;
}

interface Row {
  kind: 'entity' | 'view';
  node?: PaletteNode;
  view?: string;
  label: string;
  code?: string;
}

export default function CommandPalette({ nodes, onSelect, onView }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQ('');
        setCursor(0);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const rows: Row[] = useMemo(() => {
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const last = tokens[tokens.length - 1];
    const viewFromCode = last ? VIEW_CODES[last] : undefined;
    const entityTokens = viewFromCode ? tokens.slice(0, -1) : tokens;
    const query = entityTokens.join(' ');

    // bare view code → view command row first
    const viewRows: Row[] =
      viewFromCode && entityTokens.length === 0
        ? [{ kind: 'view', view: viewFromCode, label: `Go to ${viewFromCode} view`, code: last }]
        : [];

    let matched: PaletteNode[];
    if (!query) {
      matched = recents
        .map((t) => nodes.find((n) => n.ticker === t))
        .filter(Boolean) as PaletteNode[];
      if (matched.length === 0) matched = nodes.slice(0, 6);
    } else {
      const score = (n: PaletteNode) => {
        const t = n.ticker.toLowerCase();
        const name = n.name.toLowerCase();
        if (t === query) return 0;
        if (t.startsWith(query)) return 1;
        if (t.includes(query)) return 2;
        if (name.startsWith(query)) return 3;
        if (name.includes(query)) return 4;
        return 99;
      };
      matched = nodes
        .map((n) => [score(n), n] as const)
        .filter(([s]) => s < 99)
        .sort((a, b) => a[0] - b[0])
        .slice(0, 8)
        .map(([, n]) => n);
    }

    return [
      ...viewRows,
      ...matched.map((n) => ({
        kind: 'entity' as const,
        node: n,
        label: n.name,
        code: viewFromCode,
      })),
    ];
  }, [q, nodes, recents]);

  const commit = (row: Row) => {
    if (row.kind === 'view' && row.view) {
      onView(row.view);
      window.location.hash = `/${row.view}`;
    } else if (row.node) {
      onSelect(row.node.ticker);
      const view = row.code ? VIEW_CODES[row.code] : undefined;
      if (view) onView(view);
      window.location.hash = `${row.node.ticker}${view ? `/${view}` : ''}`;
      setRecents((r) => [row.node!.ticker, ...r.filter((t) => t !== row.node!.ticker)].slice(0, 6));
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4"
      style={{ background: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}
      onClick={() => setOpen(false)}
    >
      <div
        className="glass-electric w-full max-w-[560px] overflow-hidden !rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, rows.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === 'Enter' && rows[cursor]) {
              commit(rows[cursor]);
            }
          }}
          placeholder="Ticker, company, or view — e.g. nvda geo"
          className="w-full bg-transparent px-5 py-4 text-[17px] focus:outline-none"
          style={{
            color: 'var(--cream)',
            borderBottom: '1px solid color-mix(in oklab, var(--gold) 25%, transparent)',
          }}
        />

        <div className="max-h-[46vh] overflow-y-auto py-1.5">
          {rows.length === 0 && (
            <div className="px-5 py-4 text-[14px]" style={{ color: dim(50) }}>
              No match — try a ticker (nvda, 4063.t) or a view (map, geo).
            </div>
          )}
          {rows.map((row, i) => {
            const active = i === cursor;
            if (row.kind === 'view') {
              return (
                <button
                  key={`view-${row.view}`}
                  onClick={() => commit(row)}
                  onMouseEnter={() => setCursor(i)}
                  className="w-full flex items-center gap-3 px-5 py-2.5 text-left cursor-pointer"
                  style={{
                    background: active ? 'color-mix(in oklab, var(--cream) 8%, transparent)' : 'transparent',
                  }}
                >
                  <span className="mono text-[11px] px-1.5 py-0.5 rounded" style={{ color: 'var(--gold-matte)', border: `1px solid color-mix(in oklab, var(--gold) 35%, transparent)` }}>
                    {row.code}
                  </span>
                  <span className="text-[15px]" style={{ color: 'var(--cream)' }}>{row.label}</span>
                </button>
              );
            }
            const n = row.node!;
            const chg = n.market_data?.change_pct;
            const price = n.market_data?.price;
            const role = BASKET_ROLE_VARS[n.basket] ?? 'var(--plum)';
            return (
              <button
                key={n.id}
                onClick={() => commit(row)}
                onMouseEnter={() => setCursor(i)}
                className="w-full flex items-baseline gap-3 px-5 py-2.5 text-left cursor-pointer"
                style={{
                  background: active ? 'color-mix(in oklab, var(--cream) 8%, transparent)' : 'transparent',
                }}
              >
                <span className="w-2 h-2 rounded-full self-center shrink-0" style={{ background: role }} />
                <span className="mono text-[13px] shrink-0 w-[84px]" style={{ color: 'var(--cream)' }}>
                  {n.ticker}
                </span>
                <span className="text-[14px] truncate flex-1 min-w-0" style={{ color: dim(65) }}>
                  {n.name}
                  {row.code && (
                    <span className="mono text-[11px] ml-2" style={{ color: 'var(--gold-matte)' }}>
                      → {VIEW_CODES[row.code]}
                    </span>
                  )}
                </span>
                {price != null && (
                  <span
                    className="mono text-[13px] shrink-0 text-right tabular-nums"
                    style={{ color: dim(85) }}
                  >
                    {price.toLocaleString()}
                    {chg != null && (
                      <span
                        className="ml-2"
                        style={{ color: chg >= 0 ? 'var(--neon)' : 'var(--terracotta)' }}
                      >
                        {chg >= 0 ? '+' : ''}
                        {chg.toFixed(2)}%
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div
          className="flex items-center gap-4 px-5 py-2.5 mono text-[11px]"
          style={{
            color: dim(45),
            borderTop: '1px solid color-mix(in oklab, var(--cream) 8%, transparent)',
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
          <span className="ml-auto">ticker + view code jumps: nvda geo</span>
        </div>
      </div>
    </div>
  );
}
