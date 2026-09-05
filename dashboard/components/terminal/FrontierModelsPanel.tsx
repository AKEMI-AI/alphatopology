'use client';

/* Frontier models — Epoch AI's notable-models database (CC BY, epoch.ai)
   filtered to the selected lab: top releases by training compute. */

import React, { useMemo } from 'react';
import epochData from '@/data/epoch_models.json';

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

interface EpochModel {
  model: string;
  org_id: string | null;
  date: string | null;
  training_compute_flop: number | null;
  log10_flop: number | null;
  domain: string | null;
}

export default function FrontierModelsPanel({ orgId }: { orgId: string }) {
  const { top, count, latest } = useMemo(() => {
    const all = (epochData.models as EpochModel[]).filter((m) => m.org_id === orgId);
    const withCompute = all.filter((m) => m.log10_flop != null);
    const top = [...withCompute]
      .sort((a, b) => (b.log10_flop ?? 0) - (a.log10_flop ?? 0))
      .slice(0, 5);
    const latest = [...all].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
    return { top, count: all.length, latest };
  }, [orgId]);

  if (count === 0) return null;

  const maxLog = Math.max(...top.map((m) => m.log10_flop ?? 0), 1);

  return (
    <div className="glass-electric p-3.5">
      <div className="flex items-baseline justify-between mb-2.5">
        <span className="descent-eyebrow on-noir">Frontier models</span>
        <span className="mono text-[11px]" style={{ color: dim(50) }}>
          {count} tracked
        </span>
      </div>
      <div className="space-y-2">
        {top.map((m) => (
          <div key={m.model}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[14px] truncate" style={{ color: 'var(--cream)' }}>
                {m.model}
              </span>
              <span className="mono text-[11px] shrink-0 tabular-nums" style={{ color: 'var(--gold-matte)' }}>
                10^{m.log10_flop} FLOP
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: dim(8) }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(6, ((m.log10_flop ?? 0) - 22) / (maxLog - 22) * 100)}%`,
                    background: 'var(--spectrum-amber)',
                  }}
                />
              </div>
              <span className="mono text-[11px] shrink-0" style={{ color: dim(45) }}>
                {m.date?.slice(0, 7) ?? '—'}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mono text-[11px] mt-3 pt-2" style={{ color: dim(38), borderTop: `1px solid ${dim(8)}` }}>
        {latest?.model ? `Latest: ${latest.model} · ` : ''}Source: Epoch AI (CC BY) ·{' '}
        {(epochData as { _meta: { fetched_at: string } })._meta.fetched_at}
      </div>
    </div>
  );
}
