'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  LineSeries,
  type LineData,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { fetchHistory, HistoryPoint } from '@/lib/api';

interface ChartProps {
  ticker: string;
}

export default function MiniPriceChart({ ticker }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<'MARKET' | 'SIM' | 'LOADING'>('LOADING');

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
        fontFamily: 'monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      width: containerRef.current.clientWidth,
      height: 140,
      timeScale: { visible: false, borderVisible: false },
      rightPriceScale: { borderVisible: false },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      crosshairMarkerVisible: false,
    });

    let disposed = false;

    fetchHistory(ticker).then((res) => {
      if (disposed) return;
      let data: LineData<Time>[];
      if (res && res.data.length > 0) {
        data = res.data.map((point: HistoryPoint) => ({
          time:
            typeof point.time === 'number'
              ? (point.time as UTCTimestamp)
              : (point.time as Time),
          value: point.value,
        }));
        const up = data[data.length - 1].value >= data[0].value;
        series.applyOptions({ color: up ? '#10b981' : '#ef4444' });
        setSource('MARKET');
      } else {
        // API unreachable — deterministic placeholder, clearly labeled SIM
        const base = 150;
        data = Array.from({ length: 30 }, (_, i) => ({
          time: `2026-08-${String(i + 1).padStart(2, '0')}`,
          value: base + Math.sin(i * 0.4) * 8 + i * 0.5,
        }));
        setSource('SIM');
      }
      series.setData(data);
      chart.timeScale().fitContent();
    });

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [ticker]);

  return (
    <div className="relative">
      <span
        className={`absolute right-1 top-0 z-10 text-[9px] font-mono font-bold px-1 rounded ${
          source === 'MARKET'
            ? 'text-emerald-400 bg-emerald-500/10'
            : source === 'SIM'
              ? 'text-amber-400 bg-amber-500/10'
              : 'text-zinc-500'
        }`}
      >
        {source === 'LOADING' ? '…' : source}
      </span>
      <div ref={containerRef} className="w-full h-[140px]" />
    </div>
  );
}
