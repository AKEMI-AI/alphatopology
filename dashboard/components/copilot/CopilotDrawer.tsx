'use client';

import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '@/lib/api';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const dim = (pct: number) => `color-mix(in oklab, var(--cream) ${pct}%, transparent)`;

export default function CopilotDrawer() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const history = [...msgs, { role: 'user' as const, content: text }];
    setMsgs(history);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/copilot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.reply) {
        setMsgs([...history, { role: 'assistant', content: data.reply }]);
      } else {
        setMsgs([
          ...history,
          {
            role: 'assistant',
            content:
              data?.detail ??
              'Copilot unavailable — is the API running and ANTHROPIC_API_KEY set in .env?',
          },
        ]);
      }
    } catch {
      setMsgs([
        ...history,
        { role: 'assistant', content: 'Could not reach the API at ' + API_BASE + '.' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const sendBrief = async () => {
    const topic = input.trim();
    if (!topic || busy) return;
    const history = [...msgs, { role: 'user' as const, content: `Brief: ${topic}` }];
    setMsgs(history);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/copilot/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json().catch(() => null);
      setMsgs([
        ...history,
        {
          role: 'assistant',
          content: res.ok && data?.brief ? data.brief : (data?.detail ?? 'Brief unavailable — API/key?'),
        },
      ]);
    } catch {
      setMsgs([...history, { role: 'assistant', content: 'Could not reach the API at ' + API_BASE + '.' }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="descent-pill fixed bottom-5 right-5 z-40"
        aria-label="Open the copilot"
        style={{
          position: 'fixed', // .descent-pill's own position:relative would win otherwise
          width: 'fit-content',
          fontSize: '0.8rem',
          padding: '0.5rem 0.9rem',
        }}
      >
        Copilot
      </button>
    );
  }

  return (
    <div className="glass-electric fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 w-[calc(100vw-2rem)] max-w-[400px] h-[min(540px,72vh)] flex flex-col overflow-hidden !rounded-2xl">
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid color-mix(in oklab, var(--gold) 25%, transparent)' }}
      >
        <span className="descent-eyebrow on-noir">Copilot / research analyst</span>
        <button
          onClick={() => setOpen(false)}
          className="mono text-[11px] cursor-pointer bg-transparent border-0"
          style={{ color: dim(55) }}
        >
          Close
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {msgs.length === 0 && (
          <div className="text-[14px] leading-relaxed" style={{ color: dim(60) }}>
            Ask about the dataset — &ldquo;trace NVDA&apos;s upstream risk&rdquo;, &ldquo;where
            is the biggest valuation dislocation?&rdquo;, &ldquo;review my paper portfolio
            against the thesis&rdquo;. Research assistance only; not licensed financial advice.
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <div
              className="inline-block max-w-[92%] text-left rounded-xl px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap"
              style={
                m.role === 'user'
                  ? { background: 'color-mix(in oklab, var(--cream) 12%, transparent)', color: 'var(--cream)' }
                  : { background: 'color-mix(in oklab, var(--gold) 10%, transparent)', color: dim(90) }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="mono text-[11px]" style={{ color: 'var(--gold-matte)' }}>
            Querying the dataset…
          </div>
        )}
      </div>

      <div
        className="p-3 shrink-0 flex gap-2"
        style={{ borderTop: '1px solid color-mix(in oklab, var(--gold) 20%, transparent)' }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask the copilot…"
          className="flex-1 min-w-0 rounded-full px-3.5 py-2 text-[14px] focus:outline-none"
          style={{
            background: 'color-mix(in oklab, var(--cream) 6%, transparent)',
            border: '1px solid color-mix(in oklab, var(--cream) 14%, transparent)',
            color: 'var(--cream)',
          }}
        />
        <button
          onClick={send}
          disabled={busy}
          className="mono text-[12px] px-4 rounded-full cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--cream)', color: 'var(--ink)' }}
        >
          Send
        </button>
        <button
          onClick={sendBrief}
          disabled={busy}
          title="Compose a structured research brief on this topic"
          className="mono text-[12px] px-3 rounded-full cursor-pointer disabled:opacity-50"
          style={{
            background: 'transparent',
            color: 'var(--gold-matte)',
            border: '1px solid color-mix(in oklab, var(--gold) 35%, transparent)',
          }}
        >
          Brief
        </button>
      </div>
    </div>
  );
}
