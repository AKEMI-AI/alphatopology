'use client';

/* Forces in play — industry snapshots touching the selected entity
   (matched by affected_nodes or pipeline stage). Curated editorial layer. */

import React, { useMemo, useState } from 'react';
import snapshotData from '@/data/industry_snapshots.json';

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

interface Snapshot {
  id: string;
  title: string;
  scope_stages: string[];
  summary: string;
  thesis_impact: string;
  drivers: string[];
  watch: { item: string; why: string }[];
  affected_nodes: string[];
}

export default function ForcesPanel({ orgId, stage }: { orgId: string; stage: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const snaps = useMemo(() => {
    const all = snapshotData.snapshots as Snapshot[];
    return all.filter(
      (s) => s.affected_nodes.includes(orgId) || s.scope_stages.includes(stage)
    );
  }, [orgId, stage]);

  if (snaps.length === 0) return null;

  return (
    <div className="glass-electric p-3.5">
      <div className="descent-eyebrow on-noir mb-2.5">Forces in play</div>
      <div className="space-y-2">
        {snaps.map((s) => {
          const open = openId === s.id;
          return (
            <div key={s.id}>
              <button
                onClick={() => setOpenId(open ? null : s.id)}
                className="w-full text-left cursor-pointer bg-transparent border-0 p-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px]" style={{ color: 'var(--cream)', fontWeight: 500 }}>
                    {s.title}
                  </span>
                  <span className="mono text-[11px] shrink-0" style={{ color: dim(45) }}>
                    {open ? '−' : '+'}
                  </span>
                </div>
                {!open && (
                  <div className="text-[13px] mt-0.5 line-clamp-2" style={{ color: dim(55) }}>
                    {s.thesis_impact}
                  </div>
                )}
              </button>
              {open && (
                <div className="mt-1.5 pl-2 space-y-2" style={{ borderLeft: `1px solid color-mix(in oklab, var(--gold) 30%, transparent)` }}>
                  <div className="text-[13px]" style={{ color: dim(80) }}>{s.summary}</div>
                  <div className="text-[13px]" style={{ color: dim(65) }}>
                    <span className="mono text-[11px]" style={{ color: 'var(--gold-matte)' }}>Thesis · </span>
                    {s.thesis_impact}
                  </div>
                  <div>
                    <div className="mono text-[11px] mb-1" style={{ color: dim(50) }}>Watch</div>
                    {s.watch.map((w) => (
                      <div key={w.item} className="text-[13px] mb-1" style={{ color: dim(70) }}>
                        • {w.item}{' '}
                        <span style={{ color: dim(45) }}>— {w.why}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mono text-[11px] mt-2.5 pt-2" style={{ color: dim(38), borderTop: `1px solid ${dim(8)}` }}>
        Curated {(snapshotData as { _meta: { as_of: string } })._meta.as_of} · editorial layer
      </div>
    </div>
  );
}
