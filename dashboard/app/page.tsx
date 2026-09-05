'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import fallbackTelemetry from '@/data/live_telemetry.json';
import MiniPriceChart from '@/components/terminal/MiniPriceChart';
import ForecastPanel from '@/components/terminal/ForecastPanel';
import TelemetryTickerBar from '@/components/terminal/TelemetryTickerBar';
import { fetchTelemetry, TelemetryNode } from '@/lib/api';
import type { ChokepointNodeData } from '@/components/graph/ChokepointNode';

// Dynamic import with SSR disabled for optimal canvas rendering
const TopologyGraph = dynamic(() => import('@/components/graph/TopologyGraph'), { ssr: false });
const ChokepointMap = dynamic(() => import('@/components/map/ChokepointMap'), { ssr: false });
const GeoView = dynamic(() => import('@/components/map/GeoView'), { ssr: false });

const REFRESH_MS = 60_000;

const VIEWS = [
  { key: 'graph', label: 'Graph' },
  { key: 'map', label: 'Map' },
  { key: 'geo', label: 'Geo' },
] as const;
type ViewKey = (typeof VIEWS)[number]['key'];

type FullNode = TelemetryNode & {
  layer: number;
  chokepoint_rating: number;
  stage: string;
  basket: string;
  [key: string]: unknown;
};

function substitutionRisk(rating: number): { label: string; varName: string } {
  if (rating >= 0.95) return { label: 'Near zero', varName: 'var(--terracotta)' };
  if (rating >= 0.85) return { label: 'Low', varName: 'var(--gold-matte)' };
  return { label: 'Moderate', varName: 'var(--neon)' };
}

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

export default function TerminalPage() {
  const [view, setView] = useState<ViewKey>('graph');
  const [activeTicker, setActiveTicker] = useState<string>('NVDA');
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

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: 'var(--ink)', color: 'var(--cream)' }}
    >
      {/* 1 · Masthead — wordmark + live status */}
      <header
        className="h-14 flex items-center justify-between px-6 z-30 shrink-0"
        style={{ borderBottom: '1px solid color-mix(in oklab, var(--cream) 10%, transparent)' }}
      >
        <div className="flex items-baseline gap-6 min-w-0">
          <span className="wordmark text-[26px] leading-none shrink-0">
            AlphaTopology<span className="period">.</span>
          </span>
          <span className="descent-eyebrow on-noir hidden md:inline">
            The physical supply chain, mapped
          </span>
        </div>

        <div className="flex items-center gap-5">
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
          <span className="mono text-[11px] hidden lg:inline" style={{ color: dim(65) }}>
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
            <span style={{ color: live ? 'var(--neon)' : 'var(--gold-matte)' }}>
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
            <TopologyGraph
              onSelect={(node: ChokepointNodeData) => setActiveTicker(node.ticker)}
            />
          ) : view === 'map' ? (
            <ChokepointMap
              nodes={telemetryNodes}
              activeTicker={activeTicker}
              onSelect={(node) => setActiveTicker(node.ticker)}
            />
          ) : (
            <GeoView
              nodes={telemetryNodes}
              activeTicker={activeTicker}
              onSelect={(node) => setActiveTicker(node.ticker)}
            />
          )}
        </div>

        {/* Right: Inspector — glass-electric stage */}
        <aside
          className="w-[400px] shrink-0 flex flex-col justify-between p-5 z-20 overflow-y-auto"
          style={{
            background: 'color-mix(in oklab, var(--ink) 92%, var(--plum))',
            borderLeft: '1px solid color-mix(in oklab, var(--gold) 25%, transparent)',
          }}
        >
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
                <h2 className="display text-[32px] leading-none truncate">{activeNode.name}</h2>
              </div>
              <div className="mt-1 mono text-[12px]" style={{ color: dim(60) }}>
                {activeNode.ticker}
                {activeNode.market_data?.currency ? ` · ${activeNode.market_data.currency}` : ''}
              </div>
            </div>

            {/* Price artifact */}
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

            {/* Street forecast */}
            <ForecastPanel ticker={activeNode.ticker} />

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
        </aside>
      </div>
    </div>
  );
}
