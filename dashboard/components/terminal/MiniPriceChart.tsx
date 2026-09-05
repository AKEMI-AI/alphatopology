'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineSeries } from 'lightweight-charts';
import { fetchHistory, HistoryPoint } from '@/lib/api';

interface ChartProps {
  ticker: string;
}

export default function MiniPriceChart({ ticker }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<'LIVE' | 'SIM' | 'LOADING'>('LOADING');

  useEffect(() => {
    if (!containerRef.current) return;

    // lightweight-charts can't parse CSS vars — resolve tokens at runtime
    const tokens = getComputedStyle(document.documentElement);
    const t = (name: string, fallback: string) =>
      tokens.getPropertyValue(name).trim() || fallback;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: t('--cream', '#F2F0EC') + '99',
        fontFamily: t('--font-sans', 'sans-serif'),
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(242, 240, 236, 0.04)' },
        horzLines: { color: 'rgba(242, 240, 236, 0.04)' },
      },
      width: containerRef.current.clientWidth,
      height: 140,
      timeScale: { visible: false, borderVisible: false },
      rightPriceScale: { borderVisible: false },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(LineSeries, {
      color: t('--gold-matte', '#B5A06A'),
      lineWidth: 2,
      crosshairMarkerVisible: false,
    });

    let disposed = false;

    fetchHistory(ticker).then((res) => {
      if (disposed) return;
      let data: HistoryPoint[];
      if (res && res.data.length > 0) {
        data = res.data;
        const up = data[data.length - 1].value >= data[0].value;
        series.applyOptions({
          color: up ? t('--neon', '#C9F227') : t('--terracotta', '#E8783A'),
        });
        setSource('LIVE');
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
        className="mono absolute right-1 top-0 z-10 text-[11px] px-1 rounded"
        style={{
          color:
            source === 'LIVE'
              ? 'var(--neon)'
              : source === 'SIM'
                ? 'var(--gold-matte)'
                : 'color-mix(in oklab, var(--cream) 50%, transparent)',
        }}
      >
        {source === 'LOADING' ? '…' : source}
      </span>
      <div ref={containerRef} className="w-full h-[140px]" />
    </div>
  );
}
