'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

const COLLAPSED = 8;

export default function WhatYoullLearn({ outcomes = [] }) {
  const [expanded, setExpanded] = useState(false);
  if (!outcomes.length) return null;
  const shown = expanded ? outcomes : outcomes.slice(0, COLLAPSED);

  return (
    <section className="rounded-lg border border-slate-300 p-6">
      <h2 className="text-2xl font-bold text-slate-900">What you&apos;ll learn</h2>
      <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {shown.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700">
            <Check size={16} className="mt-0.5 shrink-0 text-slate-900" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {outcomes.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-violet-700 hover:text-violet-800"
        >
          {expanded ? 'Show less' : 'Show more'} {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      )}
    </section>
  );
}
