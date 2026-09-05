'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import fallbackTelemetry from '@/data/live_telemetry.json';
import MiniPriceChart from '@/components/terminal/MiniPriceChart';
import ForecastPanel from '@/components/terminal/ForecastPanel';
import TelemetryTickerBar from '@/components/terminal/TelemetryTickerBar';
import CopilotDrawer from '@/components/copilot/CopilotDrawer';
import CommandPalette from '@/components/terminal/CommandPalette';
import KeyPeoplePanel from '@/components/terminal/KeyPeoplePanel';
import ForcesPanel from '@/components/terminal/ForcesPanel';
import { fetchTelemetry, TelemetryNode } from '@/lib/api';
import type { ChokepointNodeData } from '@/components/graph/ChokepointNode';

// Dynamic import with SSR disabled for optimal canvas rendering
const TopologyGraph = dynamic(() => import('@/components/graph/TopologyGraph'), { ssr: false });
const ChokepointMap = dynamic(() => import('@/components/map/ChokepointMap'), { ssr: false });
const GeoView = dynamic(() => import('@/components/map/GeoView'), { ssr: false });
const BookView = dynamic(() => import('@/components/book/BookView'), { ssr: false });

const REFRESH_MS = 60_000;

const VIEWS = [
  { key: 'graph', label: 'Graph' },
  { key: 'map', label: 'Map' },
  { key: 'geo', label: 'Geo' },
  { key: 'book', label: 'Book' },
] as const;
type ViewKey = (typeof VIEWS)[number]['key'];

type FullNode = TelemetryNode & {
  layer: number;
  chokepoint_rating: number;
  stage: string;
  basket: string;
  entity_type?: string;
  valuation_usd_b?: number | null;
  [key: string]: unknown;
};

function substitutionRisk(rating: number): { label: string; varName: string } {
  if (rating >= 0.95) return { label: 'Near zero', varName: 'var(--terracotta)' };
  if (rating >= 0.85) return { label: 'Low', varName: 'var(--gold-matte)' };
  return { label: 'Moderate', varName: 'var(--neon)' };
}

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

function InspectorContent({
  activeNode,
  chg,
  subRisk,
}: {
  activeNode: FullNode;
  chg: number | null | undefined;
  subRisk: { label: string; varName: string };
}) {
  return (
    <>
      <div className="space-y-4">
        {/* Stage header: eyebrow → title */}
        <div
          className="pb-3"
          style={{ borderBottom: '1px solid color-mix(in oklab, var(--cream) 10%, transparent)' }}
        >
          <div className="descent-eyebrow on-noir">
            Node inspector / Layer {activeNode.layer}
          </div>
          <div className="mt-2 flex items-baseline gap-3 min-w-0">
            <h2 className="display text-[26px] lg:text-[32px] leading-none truncate">
              {activeNode.name}
            </h2>
          </div>
          <div className="mt-1 mono text-[12px]" style={{ color: dim(60) }}>
            {activeNode.ticker}
            {activeNode.market_data?.currency ? ` · ${activeNode.market_data.currency}` : ''}
          </div>
        </div>

        {/* Private entity: valuation instead of tape */}
        {activeNode.entity_type === 'PRIVATE' && (
          <div className="glass-electric p-3.5">
            <div className="descent-eyebrow on-noir mb-1.5">Private entity</div>
            <div className="display text-[28px]" style={{ color: 'var(--gold-matte)' }}>
              ${activeNode.valuation_usd_b ?? '—'}B
            </div>
            <div className="mono text-[11px] mt-1" style={{ color: dim(45) }}>
              Last documented round / secondary — no public tape
            </div>
          </div>
        )}

        {/* Price artifact */}
        {activeNode.entity_type !== 'PRIVATE' && (
        <div className="glass-electric p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="descent-eyebrow on-noir">30d price</span>
            {chg != null && (
              <span
                className="mono text-[12px]"
                style={{ color: chg >= 0 ? 'var(--neon)' : 'var(--terracotta)' }}
              >
                {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}% 1d
              </span>
            )}
          </div>
          <MiniPriceChart ticker={activeNode.ticker} />
        </div>
        )}

        {/* Street forecast */}
        {activeNode.entity_type !== 'PRIVATE' && <ForecastPanel ticker={activeNode.ticker} />}

        {/* Key people (public-record roles) */}
        <KeyPeoplePanel orgId={activeNode.id} />

        {/* Industry snapshots touching this entity */}
        <ForcesPanel orgId={activeNode.id} stage={activeNode.stage} />

        {/* Physical telemetry */}
        <div className="glass-electric p-3.5">
          <div className="descent-eyebrow on-noir mb-2.5">Physical supply telemetry</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <div className="min-w-0">
              <div className="mono text-[11px]" style={{ color: dim(55) }}>
                Constraint
              </div>
              <div className="text-[15px] mt-0.5" style={{ color: 'var(--cream)' }}>
                {activeNode.telemetry.metric}
              </div>
            </div>
            <div className="min-w-0">
              <div className="mono text-[11px]" style={{ color: dim(55) }}>
                Run-rate
              </div>
              <div className="text-[15px] mt-0.5" style={{ color: 'var(--gold-matte)' }}>
                {activeNode.telemetry.value}
              </div>
            </div>
            <div className="min-w-0">
              <div className="mono text-[11px]" style={{ color: dim(55) }}>
                Status
              </div>
              <div className="text-[15px] mt-0.5" style={{ color: 'var(--terracotta)' }}>
                {activeNode.telemetry.status.replace(/_/g, ' ')}
              </div>
            </div>
            <div className="min-w-0">
              <div className="mono text-[11px]" style={{ color: dim(55) }}>
                Lead-time
              </div>
              <div className="text-[15px] mt-0.5" style={{ color: 'var(--cream)' }}>
                {activeNode.telemetry.lead_time_trend}
              </div>
            </div>
          </div>
          <div
            className="mt-3 pt-2 mono text-[11px]"
            style={{
              borderTop: '1px solid color-mix(in oklab, var(--gold) 20%, transparent)',
              color: dim(45),
            }}
          >
            Fixture estimate — feed integration pending
          </div>
        </div>

        {/* Moat */}
        <div className="glass-electric p-3.5">
          <div className="descent-eyebrow on-noir mb-2">Chokepoint density</div>
          <div className="flex items-center justify-between text-[15px]">
            <span style={{ color: dim(80) }}>Substitution risk</span>
            <span style={{ color: subRisk.varName, fontWeight: 500 }}>{subRisk.label}</span>
          </div>
          <div
            className="w-full h-1 rounded-full mt-2.5 overflow-hidden"
            style={{ background: 'color-mix(in oklab, var(--cream) 10%, transparent)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${activeNode.chokepoint_rating * 100}%`,
                background: 'var(--gold-matte)',
              }}
            />
          </div>
        </div>
      </div>

      <button
        className="descent-pill mt-5 w-full justify-center shrink-0"
        onClick={() => alert(`Running dislocation arbitrage scan for ${activeNode.ticker}…`)}
      >
        Run dislocation scan
      </button>
    </>
  );
}

export default function TerminalPage() {
  const [view, setView] = useState<ViewKey>('graph');
  const [activeTicker, setActiveTicker] = useState<string>('NVDA');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [telemetryNodes, setTelemetryNodes] = useState<FullNode[]>(
    fallbackTelemetry.nodes as unknown as FullNode[]
  );
  const [live, setLive] = useState(false);

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      const res = await fetchTelemetry();
      if (!stopped && res) {
        setTelemetryNodes(res.nodes as unknown as FullNode[]);
        setLive(true);
      } else if (!stopped) {
        setLive(false);
      }
    };
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  const activeNode =
    telemetryNodes.find((n) => n.ticker === activeTicker) || telemetryNodes[0];
  const chokepointCount = telemetryNodes.filter((n) => n.chokepoint_rating >= 0.95).length;
  const subRisk = substitutionRisk(activeNode.chokepoint_rating);
  const chg = activeNode.market_data?.change_pct;

  // On small screens a node tap opens the inspector bottom sheet
  const selectNode = (ticker: string) => {
    setActiveTicker(ticker);
    setSheetOpen(true);
  };

  // Deep links: restore #TICKER/view on load (terminal-patterns §1)
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const [tickerPart, viewPart] = hash.split('/');
    if (viewPart && VIEWS.some((v) => v.key === viewPart)) setView(viewPart as ViewKey);
    else if (!tickerPart && VIEWS.some((v) => v.key === hash.slice(1))) return;
    if (tickerPart) {
      const upper = decodeURIComponent(tickerPart).toUpperCase();
      if ((fallbackTelemetry.nodes as { ticker: string }[]).some((n) => n.ticker === upper)) {
        setActiveTicker(upper);
      }
    }
  }, []);

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: 'var(--ink)', color: 'var(--cream)' }}
    >
      {/* 1 · Masthead — wordmark + live status */}
      <header
        className="h-14 grid grid-cols-[minmax(0,1fr)_auto] sm:flex items-center justify-between px-3 sm:px-6 z-30 shrink-0 gap-2"
        style={{ borderBottom: '1px solid color-mix(in oklab, var(--cream) 10%, transparent)' }}
      >
        <div className="flex items-baseline gap-6 min-w-0">
          <span className="wordmark text-[21px] sm:text-[26px] leading-none shrink-0">
            AlphaTopology<span className="period">.</span>
          </span>
          <span className="descent-eyebrow on-noir hidden xl:inline">
            The physical supply chain, mapped
          </span>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-5 shrink-0">
          <button
            onClick={() =>
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
            }
            className="mono hidden sm:flex items-center gap-2 px-3 py-1 text-[11px] rounded-full cursor-pointer"
            style={{
              color: dim(60),
              border: '1px solid color-mix(in oklab, var(--cream) 14%, transparent)',
              background: 'color-mix(in oklab, var(--cream) 4%, transparent)',
            }}
          >
            Search
            <kbd
              className="mono text-[10px] px-1 rounded"
              style={{ border: `1px solid ${dim(20)}`, color: dim(50) }}
            >
              ⌘K
            </kbd>
          </button>
          <div
            className="flex items-center gap-1 p-0.5 rounded-full"
            style={{ border: '1px solid color-mix(in oklab, var(--cream) 14%, transparent)' }}
          >
            {VIEWS.map((v) => {
              const active = view === v.key;
              return (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className="mono px-3 py-1 text-[11px] rounded-full transition-colors cursor-pointer"
                  style={{
                    color: active ? 'var(--ink)' : dim(70),
                    background: active ? 'var(--cream)' : 'transparent',
                  }}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
          <span className="mono text-[11px] hidden xl:inline" style={{ color: dim(65) }}>
            Chokepoints{' '}
            <strong style={{ color: 'var(--gold-matte)', fontWeight: 600 }}>
              {chokepointCount} active
            </strong>
          </span>
          <span className="flex items-center gap-2 mono text-[11px]">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: live ? 'var(--neon)' : 'var(--gold-matte)' }}
            />
            <span className="hidden sm:inline" style={{ color: live ? 'var(--neon)' : 'var(--gold-matte)' }}>
              {live ? 'Live' : 'Cached'}
            </span>
          </span>
        </div>
      </header>

      {/* 2 · Live telemetry marquee */}
      <TelemetryTickerBar />

      {/* 3 · Main Workspace */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left: Interactive Canvas — shiftable view */}
        <div className="flex-1 h-full relative min-w-0">
          {view === 'graph' ? (
            <TopologyGraph onSelect={(node: ChokepointNodeData) => selectNode(node.ticker)} />
          ) : view === 'map' ? (
            <ChokepointMap
              nodes={telemetryNodes}
              activeTicker={activeTicker}
              onSelect={(node) => selectNode(node.ticker)}
              onZoomFloor={() => setView('graph')}
            />
          ) : view === 'geo' ? (
            <GeoView
              nodes={telemetryNodes}
              activeTicker={activeTicker}
              onSelect={(node) => selectNode(node.ticker)}
            />
          ) : (
            <BookView
              nodes={telemetryNodes}
              activeTicker={activeTicker}
              onSelect={(ticker) => selectNode(ticker)}
            />
          )}
        </div>

        {/* Right: Inspector — glass-electric stage (desktop side rail) */}
        <aside
          className="hidden lg:flex w-[400px] shrink-0 flex-col justify-between p-5 z-20 overflow-y-auto"
          style={{
            background: 'color-mix(in oklab, var(--ink) 92%, var(--plum))',
            borderLeft: '1px solid color-mix(in oklab, var(--gold) 25%, transparent)',
          }}
        >
          <InspectorContent activeNode={activeNode} chg={chg} subRisk={subRisk} />
        </aside>
      </div>

      {/* Mobile / tablet: inspector bottom sheet */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <button
            aria-label="Close inspector"
            className="flex-1 cursor-pointer"
            style={{ background: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="max-h-[72vh] overflow-y-auto p-4 pb-6 rounded-t-2xl flex flex-col"
            style={{
              background: 'color-mix(in oklab, var(--ink) 94%, var(--plum))',
              borderTop: '1px solid color-mix(in oklab, var(--gold) 30%, transparent)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="w-10 h-1 rounded-full mx-auto"
                style={{ background: 'color-mix(in oklab, var(--cream) 20%, transparent)' }}
              />
              <button
                onClick={() => setSheetOpen(false)}
                className="mono text-[11px] shrink-0 cursor-pointer bg-transparent border-0"
                style={{ color: 'color-mix(in oklab, var(--cream) 55%, transparent)' }}
              >
                Close
              </button>
            </div>
            <InspectorContent activeNode={activeNode} chg={chg} subRisk={subRisk} />
          </div>
        </div>
      )}

      {/* Mobile: reopen the inspector */}
      {!sheetOpen && (
        <button
          onClick={() => setSheetOpen(true)}
          className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-20 mono text-[11px] px-3.5 py-2 rounded-full cursor-pointer"
          style={{
            background: 'color-mix(in oklab, var(--ink) 75%, transparent)',
            border: '1px solid color-mix(in oklab, var(--gold) 30%, transparent)',
            color: 'var(--cream)',
            backdropFilter: 'blur(18px)',
          }}
        >
          {activeNode.ticker} inspector
        </button>
      )}

      <CopilotDrawer />

      <CommandPalette
        nodes={telemetryNodes}
        onSelect={(ticker) => selectNode(ticker)}
        onView={(v) => setView(v as ViewKey)}
      />
    </div>
  );
}
