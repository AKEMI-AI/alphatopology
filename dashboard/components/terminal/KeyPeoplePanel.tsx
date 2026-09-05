'use client';

/* Key people for the selected entity — roles + lineage from the
   public-record person graph (people_seed.json). */

import React, { useMemo } from 'react';
import peopleData from '@/data/people_seed.json';

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

interface Role {
  org: string;
  relationship: string;
  note?: string;
}
interface Lineage {
  from_org: string;
  note: string;
}
interface Person {
  id: string;
  name: string;
  country?: string;
  roles: Role[];
  lineage?: Lineage[];
  verify?: boolean;
}

export default function KeyPeoplePanel({ orgId }: { orgId: string }) {
  const people = useMemo(() => {
    const all = peopleData.people as Person[];
    return all.filter(
      (p) =>
        p.roles.some((r) => r.org === orgId) ||
        (p.lineage ?? []).some((l) => l.from_org === orgId)
    );
  }, [orgId]);

  if (people.length === 0) return null;

  return (
    <div className="glass-electric p-3.5">
      <div className="descent-eyebrow on-noir mb-2.5">Key people</div>
      <div className="space-y-2.5">
        {people.map((p) => {
          const role = p.roles.find((r) => r.org === orgId);
          const lineage = (p.lineage ?? []).find((l) => l.from_org === orgId);
          return (
            <div key={p.id} className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[15px]" style={{ color: 'var(--cream)', fontWeight: 500 }}>
                  {p.name}
                </span>
                {role && (
                  <span className="mono text-[11px]" style={{ color: 'var(--gold-matte)' }}>
                    {role.relationship.replace(/_/g, ' ').toLowerCase()}
                  </span>
                )}
                {p.verify && (
                  <span className="mono text-[11px]" style={{ color: dim(40) }} title="Needs confirmation against current sources">
                    verify
                  </span>
                )}
              </div>
              {role?.note && (
                <div className="text-[13px] mt-0.5" style={{ color: dim(55) }}>{role.note}</div>
              )}
              {lineage && (
                <div className="text-[13px] mt-0.5" style={{ color: dim(55) }}>
                  Alumni — {lineage.note}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mono text-[11px] mt-3 pt-2" style={{ color: dim(38), borderTop: `1px solid ${dim(8)}` }}>
        Public-record roles · curated {(peopleData as { _meta: { as_of: string } })._meta.as_of}
      </div>
    </div>
  );
}
