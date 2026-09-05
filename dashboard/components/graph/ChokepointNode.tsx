import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';

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

/* VISUAL-DATA-SYSTEM spectrum — data roles only. Magenta is NOT here:
   it is reserved for the single selected focus per view. */
export const BASKET_ROLE_VARS: Record<string, string> = {
  BK_CHOKE: 'var(--gold)', // trust / the instrument — chokepoint authority
  BK_FRONT: 'var(--neon)', // technology
  BK_BACK: 'var(--spectrum-violet)', // society (memory/packaging collective)
  BK_FABLESS: 'var(--spectrum-orange)', // economy
  BK_INFRA: 'var(--spectrum-coral)', // change (power/cooling buildout)
  BK_MODELS: 'var(--spectrum-amber)', // intelligence — foundation model labs
};

export const ChokepointNode = memo(({ data, selected }: NodeProps<ChokepointFlowNode>) => {
  const roleVar = BASKET_ROLE_VARS[data.basket] ?? 'var(--gold)';
  const isChokepoint = data.chokepoint_rating >= 0.9;

  return (
    <div
      className="relative min-w-[220px] rounded-[14px] p-3.5 transition-transform duration-200"
      style={{
        background: 'color-mix(in oklab, var(--ink) 72%, transparent)',
        backdropFilter: 'blur(24px) saturate(140%)',
        border: selected
          ? '1px solid var(--magenta)'
          : `1px solid color-mix(in oklab, ${roleVar} 35%, transparent)`,
        boxShadow: selected
          ? 'inset 0 -1px 0 color-mix(in oklab, var(--magenta) 45%, transparent), 0 20px 50px -25px color-mix(in oklab, var(--magenta) 35%, transparent)'
          : 'inset 0 1px 0 color-mix(in oklab, var(--cream) 10%, transparent), 0 16px 40px -28px color-mix(in oklab, var(--ink) 90%, transparent)',
        transform: selected ? 'scale(1.03)' : undefined,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: 'var(--plum)',
          width: 8,
          height: 8,
          border: '1px solid var(--ink)',
        }}
      />

      <div
        className="flex items-center justify-between gap-2 pb-1.5"
        style={{ borderBottom: '1px solid color-mix(in oklab, var(--cream) 10%, transparent)' }}
      >
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="mono text-[12px] font-semibold" style={{ color: 'var(--cream)' }}>
            {data.ticker}
          </span>
          <span
            className="text-[11px] shrink-0"
            style={{ color: 'color-mix(in oklab, var(--cream) 55%, transparent)' }}
          >
            {data.exchange}
          </span>
        </div>
        {isChokepoint && (
          <span
            className="mono text-[11px] shrink-0"
            style={{ color: 'var(--gold-matte)' }}
            title="Chokepoint authority"
          >
            ◉ Choke
          </span>
        )}
      </div>

      <div
        className="mt-2 text-[16px] leading-snug truncate"
        style={{ color: 'var(--cream)', fontWeight: 500 }}
      >
        {data.name}
      </div>
      <div
        className="mt-0.5 mono text-[11px]"
        style={{ color: 'color-mix(in oklab, var(--cream) 55%, transparent)' }}
      >
        {data.stage.replace(/_/g, ' ')}
      </div>

      <div className="mt-3 flex items-center justify-between pt-2">
        <span className="flex items-center gap-1.5 mono text-[11px]" style={{ color: roleVar }}>
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ background: roleVar }}
          />
          {data.basket.replace('BK_', '')}
        </span>
        <span
          className="mono text-[11px]"
          style={{
            color:
              data.chokepoint_rating >= 0.9
                ? 'var(--gold-matte)'
                : 'color-mix(in oklab, var(--cream) 70%, transparent)',
          }}
        >
          Crit {(data.chokepoint_rating * 100).toFixed(0)}%
        </span>
      </div>

      {/* role hairline — the basket speaks as a single line, never a fill */}
      <div
        className="absolute left-3 right-3 bottom-0 h-px"
        style={{ background: `color-mix(in oklab, ${roleVar} 60%, transparent)` }}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: 'var(--plum)',
          width: 8,
          height: 8,
          border: '1px solid var(--ink)',
        }}
      />
    </div>
  );
});

ChokepointNode.displayName = 'ChokepointNode';
