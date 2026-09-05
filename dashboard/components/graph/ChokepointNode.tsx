import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { ShieldAlert } from 'lucide-react';

export interface ChokepointNodeData {
  id: string;
  name: string;
  ticker: string;
  exchange: string;
  layer: number;
  stage: string;
  chokepoint_rating: number;
  basket: 'BK_CHOKE' | 'BK_FRONT' | 'BK_BACK' | 'BK_FABLESS' | 'BK_INFRA';
  // Required so ChokepointNodeData satisfies @xyflow/react v12's
  // Record<string, unknown> constraint on node data.
  [key: string]: unknown;
}

export type ChokepointFlowNode = Node<ChokepointNodeData, 'chokepoint'>;

const BASKET_THEMES: Record<string, { border: string; bg: string; badge: string; text: string }> = {
  BK_CHOKE: { border: 'border-amber-500/80', bg: 'bg-amber-950/20', badge: 'bg-amber-500/10 text-amber-400', text: 'text-amber-200' },
  BK_FRONT: { border: 'border-cyan-500/80', bg: 'bg-cyan-950/20', badge: 'bg-cyan-500/10 text-cyan-400', text: 'text-cyan-200' },
  BK_BACK: { border: 'border-emerald-500/80', bg: 'bg-emerald-950/20', badge: 'bg-emerald-500/10 text-emerald-400', text: 'text-emerald-200' },
  BK_FABLESS: { border: 'border-purple-500/80', bg: 'bg-purple-950/20', badge: 'bg-purple-500/10 text-purple-400', text: 'text-purple-200' },
  BK_INFRA: { border: 'border-rose-500/80', bg: 'bg-rose-950/20', badge: 'bg-rose-500/10 text-rose-400', text: 'text-rose-200' },
};

export const ChokepointNode = memo(({ data, selected }: NodeProps<ChokepointFlowNode>) => {
  const theme = BASKET_THEMES[data.basket] || BASKET_THEMES.BK_FRONT;
  const isChokepoint = data.chokepoint_rating >= 0.90;

  return (
    <div
      className={`relative min-w-[210px] rounded-xl border backdrop-blur-md p-3.5 transition-all duration-200 shadow-xl ${
        theme.border
      } ${theme.bg} ${selected ? 'ring-2 ring-white/50 shadow-2xl scale-[1.03]' : 'hover:border-white/40'}`}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(15,18,24,0.85) 100%)',
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-zinc-400 !w-2.5 !h-2.5 !border-zinc-900" />

      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono font-bold tracking-wider text-white">{data.ticker}</span>
          <span className="text-[10px] font-mono text-zinc-400">({data.exchange})</span>
        </div>
        {isChokepoint && (
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
            <ShieldAlert className="w-2.5 h-2.5" />
            <span>CHOKEPOINT</span>
          </div>
        )}
      </div>

      <div className="mt-2 text-sm font-semibold text-zinc-100 truncate">{data.name}</div>
      <div className="mt-0.5 text-[10px] text-zinc-400 uppercase tracking-wider font-mono">{data.stage.replace(/_/g, ' ')}</div>

      <div className="mt-3 flex items-center justify-between text-[11px] font-mono pt-2 border-t border-white/5">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${theme.badge}`}>
          {data.basket.replace('BK_', '')}
        </span>
        <div className="flex items-center gap-1 text-zinc-300">
          <span className="text-[10px] text-zinc-500">CRIT:</span>
          <span className={data.chokepoint_rating >= 0.9 ? 'text-red-400 font-bold' : 'text-zinc-300'}>
            {(data.chokepoint_rating * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-zinc-400 !w-2.5 !h-2.5 !border-zinc-900" />
    </div>
  );
});

ChokepointNode.displayName = 'ChokepointNode';
