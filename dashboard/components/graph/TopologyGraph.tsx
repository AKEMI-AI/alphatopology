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
import { ChokepointNode, ChokepointNodeData } from './ChokepointNode';
import rawData from '@/data/live_telemetry.json';
import { Search } from 'lucide-react';

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
      style: {
        stroke: edge.criticality === 'CRITICAL' ? '#f59e0b' : '#64748b',
        strokeWidth: edge.criticality === 'CRITICAL' ? 2 : 1.2,
      },
      labelStyle: { fill: '#cbd5e1', fontSize: 10, fontFamily: 'monospace' },
      labelBgStyle: { fill: '#0f172a', fillOpacity: 0.85 },
      labelBgPadding: [6, 2] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.criticality === 'CRITICAL' ? '#f59e0b' : '#64748b',
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
    <div className="relative w-full h-full bg-[#060709] text-zinc-100 overflow-hidden font-sans">
      {/* Control Overlay */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2.5 bg-black/60 backdrop-blur-md p-2.5 rounded-xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white/5 rounded-lg border border-white/10">
          <Search className="w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search ticker or entity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none w-44 font-mono"
          />
        </div>

        <div className="flex items-center gap-1">
          {['ALL', 'BK_CHOKE', 'BK_FRONT', 'BK_BACK', 'BK_FABLESS', 'BK_INFRA'].map((basket) => (
            <button
              key={basket}
              onClick={() => setSelectedBasket(basket)}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-lg transition-colors border ${
                selectedBasket === basket
                  ? 'bg-white/20 border-white/40 text-white font-bold'
                  : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              {basket.replace('BK_', '')}
            </button>
          ))}
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
        className="bg-[#060709]"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#1e293b" />
        <Controls className="!bg-black/60 !border !border-white/10 !rounded-xl overflow-hidden [&>button]:!border-b-white/10 [&>button]:!fill-zinc-300" />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(n) => {
            const b = (n.data as ChokepointNodeData).basket;
            if (b === 'BK_CHOKE') return '#f59e0b';
            if (b === 'BK_FRONT') return '#06b6d4';
            if (b === 'BK_BACK') return '#10b981';
            if (b === 'BK_FABLESS') return '#a855f7';
            return '#f43f5e';
          }}
          className="!bg-black/80 !border !border-white/10 !rounded-xl"
        />
      </ReactFlow>
    </div>
  );
}
