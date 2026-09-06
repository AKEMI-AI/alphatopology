'use client';

/* The Signal — thesis-filtered news, the Ground News grammar with our
   axis: every story cluster tagged by the nodes and forces it touches.
   Cards: headline · entity dots · force chips · N sources · expandable
   source list. Filter by force. Headlines link to their publishers. */

import React, { useMemo, useState } from 'react';
import newsData from '@/data/news.json';
import { BASKET_ROLE_VARS } from '@/components/graph/ChokepointNode';
import seedData from '@/data/nodes_seed.json';

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

const FORCE_LABELS: Record<string, string> = {
  POWER_WALL: 'Power', HBM_SUPERCYCLE: 'HBM', CIRCULAR_FINANCING: 'Money loops',
  EXPORT_CONTROL_REGIME: 'Controls', PACKAGING_BOTTLENECK: 'Packaging',
  TALENT_DIASPORA: 'Talent', ROBOTICS_EMBODIMENT: 'Robotics',
  MACRO_LIQUIDITY: 'Macro', MATERIALS_ENVIRONMENT: 'Materials',
};

interface Source { title: string; publisher: string; url: string; published: string }
interface Story {
  id: string; headline: string; nodes: string[]; forces: string[];
  source_count: number; latest: string; sources: Source[];
}

const NODE_META: Record<string, { ticker: string; basket: string }> = {};
for (const n of (seedData.nodes as { id: string; ticker: string; basket: string }[])) {
  NODE_META[n.id] = { ticker: n.ticker, basket: n.basket };
}

export default function NewsView({ onSelect }: { onSelect: (ticker: string) => void }) {
  const [force, setForce] = useState<string>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const meta = (newsData as { _meta: { fetched_at: string; stories: number } })._meta;

  const stories = useMemo(() => {
    const all = (newsData as unknown as { stories: Story[] }).stories;
    return force === 'ALL' ? all : all.filter((s) => s.forces.includes(force));
  }, [force]);

  return (
    <div className="w-full h-full overflow-y-auto data-grid-dark" style={{ background: 'var(--ink)' }}>
      <div className="px-4 md:px-6 pt-5 pb-10 max-w-[880px] mx-auto">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div className="descent-eyebrow on-noir">The signal / thesis-filtered news</div>
          <div className="mono text-[11px]" style={{ color: dim(40) }}>
            Crawled {meta.fetched_at} · Google News RSS · headlines © their publishers
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-4 flex-wrap">
          <button
            onClick={() => setForce('ALL')}
            className="mono px-2.5 py-1 text-[11px] rounded-full cursor-pointer"
            style={{
              color: force === 'ALL' ? 'var(--ink)' : dim(65),
              background: force === 'ALL' ? 'var(--cream)' : 'color-mix(in oklab, var(--ink) 60%, transparent)',
              border: `1px solid ${force === 'ALL' ? 'var(--cream)' : dim(14)}`,
            }}
          >
            All
          </button>
          {Object.entries(FORCE_LABELS).map(([id, label]) => {
            const on = force === id;
            return (
              <button
                key={id}
                onClick={() => setForce(on ? 'ALL' : id)}
                className="mono px-2.5 py-1 text-[11px] rounded-full cursor-pointer"
                style={{
                  color: on ? 'var(--ink)' : 'var(--gold-matte)',
                  background: on ? 'var(--gold-matte)' : 'color-mix(in oklab, var(--ink) 60%, transparent)',
                  border: `1px solid color-mix(in oklab, var(--gold) ${on ? 80 : 30}%, transparent)`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="space-y-3 mt-5">
          {stories.length === 0 && (
            <div className="text-[14px]" style={{ color: dim(55) }}>
              Nothing under this force in the current crawl — rerun scripts/fetch_news.py to refresh.
            </div>
          )}
          {stories.map((s) => {
            const open = openId === s.id;
            return (
              <article key={s.id} className="glass-electric p-4">
                <div className="flex items-start justify-between gap-3">
                  <a
                    href={s.sources[0]?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[16px] leading-snug hover:underline"
                    style={{ color: 'var(--cream)', fontWeight: 500 }}
                  >
                    {s.headline}
                  </a>
                  <button
                    onClick={() => setOpenId(open ? null : s.id)}
                    className="mono text-[11px] shrink-0 px-2 py-1 rounded-full cursor-pointer"
                    style={{
                      color: s.source_count > 1 ? 'var(--gold-matte)' : dim(45),
                      border: `1px solid ${s.source_count > 1 ? 'color-mix(in oklab, var(--gold) 35%, transparent)' : dim(12)}`,
                      background: 'transparent',
                    }}
                  >
                    {s.source_count} source{s.source_count > 1 ? 's' : ''} {open ? '−' : '+'}
                  </button>
                </div>

                <div className="flex items-center gap-x-3 gap-y-1.5 mt-2 flex-wrap">
                  {s.nodes.slice(0, 6).map((nid) => {
                    const m = NODE_META[nid];
                    if (!m) return null;
                    return (
                      <button
                        key={nid}
                        onClick={() => onSelect(m.ticker)}
                        className="mono text-[11px] flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0"
                        style={{ color: dim(75) }}
                        title="Inspect in the terminal"
                      >
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: BASKET_ROLE_VARS[m.basket] ?? 'var(--plum)' }} />
                        {m.ticker}
                      </button>
                    );
                  })}
                  {s.forces.map((f) => (
                    <button
                      key={f}
                      onClick={() => setForce(f)}
                      className="mono text-[11px] cursor-pointer bg-transparent border-0 p-0"
                      style={{ color: 'var(--gold-matte)' }}
                    >
                      {FORCE_LABELS[f] ?? f}
                    </button>
                  ))}
                  <span className="mono text-[11px] ml-auto" style={{ color: dim(38) }}>
                    {s.latest.slice(5)}
                  </span>
                </div>

                {open && (
                  <div className="mt-3 pt-2 space-y-1.5" style={{ borderTop: `1px solid ${dim(9)}` }}>
                    {s.sources.map((src) => (
                      <a
                        key={src.url}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-[13px] hover:underline"
                        style={{ color: dim(65) }}
                      >
                        <span className="mono text-[11px]" style={{ color: dim(45) }}>{src.publisher} · </span>
                        {src.title}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="mono text-[11px] mt-6" style={{ color: dim(38) }}>
          Matching is keyword-based v1 — expect occasional misfiles. Aggregation links out; no
          article text is stored. The crawl is the raw feed of the Pulse.
        </div>
      </div>
    </div>
  );
}
