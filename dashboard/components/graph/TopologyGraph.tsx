'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChokepointNode, ChokepointNodeData, BASKET_ROLE_VARS } from './ChokepointNode';
import rawData from '@/data/live_telemetry.json';
import { Search } from 'lucide-react';

const BASKETS = ['ALL', 'BK_CHOKE', 'BK_FRONT', 'BK_BACK', 'BK_FABLESS', 'BK_INFRA'];

const nodeTypes = {
  chokepoint: ChokepointNode,
};

// Auto-layout mapping coordinates based on value-chain stages
const STAGE_Y_POSITIONS: Record<string, number> = {
  ENERGY_GRID: 0,
  EDA_IP: 140,
  RAW_MATERIALS_CHEMISTRY: 140,
  WFE_LITHOGRAPHY: 280,
  FOUNDRY: 420,
  MEMORY_HBM: 420,
  DICING_PACKAGING_SUBSTRATE: 560,
  INSPECTION_TESTING: 700,
  ODM_RACK_INTEGRATION: 840,
  COOLING_THERMAL: 840,
  OPTICAL_FABRIC: 840,
};

interface TopologyGraphProps {
  onSelect?: (node: ChokepointNodeData) => void;
}

export default function TopologyGraph({ onSelect }: TopologyGraphProps) {
  const [selectedBasket, setSelectedBasket] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Parse telemetry payload into initial nodes with structured layout positioning
  const initialNodes: Node[] = useMemo(() => {
    const stageCounters: Record<string, number> = {};

    return rawData.nodes.map((node) => {
      const stage = node.stage;
      stageCounters[stage] = (stageCounters[stage] || 0) + 1;
      const xIndex = stageCounters[stage];

      return {
        id: node.id,
        type: 'chokepoint',
        data: node as unknown as ChokepointNodeData,
        position: {
          x: xIndex * 260 - 150,
          y: STAGE_Y_POSITIONS[stage] ?? 400,
        },
      };
    });
  }, []);

  const initialEdges: Edge[] = useMemo(() => {
    return rawData.edges.map((edge) => ({
      id: `${edge.source}->${edge.target}`,
      source: edge.source,
      target: edge.target,
      animated: edge.criticality === 'CRITICAL',
      label: `${edge.lead_time_days}d (${edge.relationship})`,
      // Solid = physical supply (culture); gold = the instrument-critical path
      style: {
        stroke: edge.criticality === 'CRITICAL' ? 'var(--gold-matte)' : 'var(--plum)',
        strokeWidth: edge.criticality === 'CRITICAL' ? 2 : 1.2,
      },
      labelStyle: {
        fill: 'var(--cream)',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.08em',
      },
      labelBgStyle: { fill: 'var(--ink)', fillOpacity: 0.85 },
      labelBgPadding: [6, 2] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.criticality === 'CRITICAL' ? 'var(--gold-matte)' : 'var(--plum)',
      },
    }));
  }, []);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Dynamic filter application
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const data = n.data as ChokepointNodeData;
      const matchesBasket = selectedBasket === 'ALL' || data.basket === selectedBasket;
      const matchesQuery =
        searchQuery === '' ||
        data.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        data.ticker.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesBasket && matchesQuery;
    });
  }, [nodes, selectedBasket, searchQuery]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelect?.(node.data as ChokepointNodeData);
    },
    [onSelect]
  );

  return (
    <div
      className="relative w-full h-full overflow-hidden data-grid-dark"
      style={{ background: 'var(--ink)', color: 'var(--cream)' }}
    >
      {/* Control Overlay — glass-electric capsule */}
      <div className="glass-electric absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2.5 p-2.5 !rounded-2xl">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: 'color-mix(in oklab, var(--cream) 6%, transparent)',
            border: '1px solid color-mix(in oklab, var(--cream) 12%, transparent)',
          }}
        >
          <Search
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: 'color-mix(in oklab, var(--cream) 60%, transparent)' }}
          />
          <input
            type="text"
            placeholder="Search ticker or entity…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-[13px] focus:outline-none w-44 min-w-0"
            style={{ color: 'var(--cream)' }}
          />
        </div>

        <div className="flex items-center gap-1">
          {BASKETS.map((basket) => {
            const active = selectedBasket === basket;
            const roleVar = BASKET_ROLE_VARS[basket];
            return (
              <button
                key={basket}
                onClick={() => setSelectedBasket(basket)}
                className="mono px-2.5 py-1 text-[11px] rounded-full transition-colors cursor-pointer"
                style={{
                  color: active ? 'var(--ink)' : 'color-mix(in oklab, var(--cream) 70%, transparent)',
                  background: active ? 'var(--cream)' : 'color-mix(in oklab, var(--cream) 6%, transparent)',
                  border: `1px solid ${
                    active
                      ? 'var(--cream)'
                      : roleVar
                        ? `color-mix(in oklab, ${roleVar} 40%, transparent)`
                        : 'color-mix(in oklab, var(--cream) 12%, transparent)'
                  }`,
                }}
              >
                {basket.replace('BK_', '')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Canvas */}
      <ReactFlow
        nodes={filteredNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        style={{ background: 'transparent' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={32}
          size={1.2}
          color="color-mix(in oklab, var(--cream) 10%, transparent)"
        />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(n) =>
            BASKET_ROLE_VARS[(n.data as ChokepointNodeData).basket] ?? 'var(--plum)'
          }
        />
      </ReactFlow>
    </div>
  );
}
