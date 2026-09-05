'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import fallbackTelemetry from '@/data/live_telemetry.json';
import { Radio, AlertOctagon } from 'lucide-react';
import MiniPriceChart from '@/components/terminal/MiniPriceChart';
import ForecastPanel from '@/components/terminal/ForecastPanel';
import TelemetryTickerBar from '@/components/terminal/TelemetryTickerBar';
import { fetchTelemetry, TelemetryNode } from '@/lib/api';
import type { ChokepointNodeData } from '@/components/graph/ChokepointNode';

// Dynamic import with SSR disabled for optimal canvas rendering
const TopologyGraph = dynamic(() => import('@/components/graph/TopologyGraph'), { ssr: false });

const REFRESH_MS = 60_000;

type FullNode = TelemetryNode & {
  layer: number;
  chokepoint_rating: number;
  stage: string;
};

function substitutionRisk(rating: number): { label: string; color: string } {
  if (rating >= 0.95) return { label: 'NEAR ZERO', color: 'text-red-400' };
  if (rating >= 0.85) return { label: 'LOW', color: 'text-amber-400' };
  return { label: 'MODERATE', color: 'text-emerald-400' };
}

export default function TerminalPage() {
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
  const tsmc = telemetryNodes.find((n) => n.ticker === 'TSM');
  const subRisk = substitutionRisk(activeNode.chokepoint_rating);
  const chg = activeNode.market_data?.change_pct;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#060709] text-zinc-200 overflow-hidden font-mono select-none">
      {/* 1. Institutional Top Bar */}
      <header className="h-11 border-b border-white/10 bg-[#090b0e] flex items-center justify-between px-4 text-xs z-30 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-bold tracking-wider text-amber-400">
            <Radio className="w-3.5 h-3.5 animate-pulse text-amber-500" />
            <span>ALPHA_TOPOLOGY // TERMINAL</span>
          </div>
          <span className="text-zinc-600">|</span>
          <div className="flex items-center gap-6 text-[11px] text-zinc-400">
            <span>
              PIPELINE: <strong className="text-zinc-200">ENERGY ➔ WAFER ➔ RACK</strong>
            </span>
            <span>
              MONITORED CHOKEPOINTS:{' '}
              <strong className="text-red-400">{chokepointCount} ACTIVE</strong>
            </span>
            {tsmc && (
              <span>
                TSMC {tsmc.telemetry.metric.toUpperCase()}:{' '}
                <strong className="text-amber-400">{tsmc.telemetry.value}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 rounded text-[10px] border ${
              live
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            DATA ENGINE: {live ? 'SYNCHRONIZED' : 'CACHED SNAPSHOT'}
          </span>
        </div>
      </header>

      {/* 2. Live telemetry marquee */}
      <TelemetryTickerBar />

      {/* 3. Main Workspace */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left: Interactive Canvas */}
        <div className="flex-1 h-full relative">
          <TopologyGraph
            onSelect={(node: ChokepointNodeData) => setActiveTicker(node.ticker)}
          />
        </div>

        {/* Right: Institutional Telemetry & Stock Inspector */}
        <aside className="w-96 border-l border-white/10 bg-[#090b0e] flex flex-col justify-between p-4 z-20 shadow-2xl overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-lg font-bold text-white tracking-wide">
                  {activeNode.ticker}
                </span>
                <span className="text-xs text-zinc-400 ml-2 font-sans">{activeNode.name}</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300">
                LAYER {activeNode.layer}
              </span>
            </div>

            {/* TradingView Mini Price Chart (real history via API) */}
            <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
              <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                <span>30D PRICE ACTION</span>
                {chg != null && (
                  <span className={chg >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}% 1D
                  </span>
                )}
              </div>
              <MiniPriceChart ticker={activeNode.ticker} />
            </div>

            {/* Street forecast: analyst targets & forward multiples */}
            <ForecastPanel ticker={activeNode.ticker} />

            {/* Physical Telemetry / Supply Chain Backlog */}
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-2">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>PHYSICAL SUPPLY TELEMETRY</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block">
                    Constraint Metric
                  </span>
                  <span className="text-zinc-200 font-semibold">
                    {activeNode.telemetry.metric}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block">Run-Rate Value</span>
                  <span className="text-amber-300 font-bold">{activeNode.telemetry.value}</span>
                </div>
                <div className="mt-1">
                  <span className="text-[10px] text-zinc-500 uppercase block">
                    Capacity Status
                  </span>
                  <span className="text-red-400 font-bold">{activeNode.telemetry.status}</span>
                </div>
                <div className="mt-1">
                  <span className="text-[10px] text-zinc-500 uppercase block">
                    Lead-Time Delta
                  </span>
                  <span className="text-zinc-300 font-mono">
                    {activeNode.telemetry.lead_time_trend}
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-amber-500/10 text-[9px] text-zinc-600">
                FIXTURE ESTIMATE — industry feed integration pending
              </div>
            </div>

            {/* Monopoly / Geopolitical Moat */}
            <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-2">
              <div className="text-[10px] text-zinc-500 uppercase">
                Monopoly / Chokepoint Density
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300">Substitution Risk:</span>
                <span className={`font-bold ${subRisk.color}`}>{subRisk.label}</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full"
                  style={{ width: `${activeNode.chokepoint_rating * 100}%` }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => alert(`Running dislocation arbitrage scan for ${activeNode.ticker}...`)}
            className="w-full mt-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded transition-all shadow-lg shadow-amber-500/10 uppercase shrink-0"
          >
            EXECUTE DISLOCATION SCAN
          </button>
        </aside>
      </div>
    </div>
  );
}
