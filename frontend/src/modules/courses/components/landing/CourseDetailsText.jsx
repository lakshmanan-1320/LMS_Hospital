'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/** Text block that collapses with a fade and a "Show more" toggle when it's long. */
export function Collapsible({ children, maxHeight = 220 }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    if (ref.current) setOverflows(ref.current.scrollHeight > maxHeight + 8);
  }, [children, maxHeight]);

  return (
    <div>
      <div
        ref={ref}
        className="relative overflow-hidden"
        style={{ maxHeight: expanded || !overflows ? 'none' : maxHeight }}
      >
        {children}
        {!expanded && overflows && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-white to-transparent" />}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-violet-700 hover:text-violet-800"
        >
          {expanded ? 'Show less' : 'Show more'} {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      )}
    </div>
  );
}

const toLines = (text) =>
  String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);

/** Requirements, Description and "Who this course is for". */
export default function CourseDetailsText({ requirements = [], description, targetAudience }) {
  const audience = toLines(targetAudience);
  return (
    <>
      {requirements.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-slate-900">Requirements</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
            {requirements.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      {description && (
        <section>
          <h2 className="text-2xl font-bold text-slate-900">Description</h2>
          <div className="mt-3">
            <Collapsible>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{description}</p>
            </Collapsible>
          </div>
        </section>
      )}

      {audience.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-slate-900">Who this course is for:</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
            {audience.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
