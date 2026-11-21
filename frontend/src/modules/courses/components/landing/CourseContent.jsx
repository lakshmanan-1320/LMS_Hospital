'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, MonitorPlay, FileText, File } from 'lucide-react';
import { formatClock, formatLength } from '../../utils/courseFormat';

const TYPE_ICON = { video: MonitorPlay, text: FileText, document: File };

/**
 * Course content accordion: sections, lectures, durations, and "Preview" for free previews.
 */
export default function CourseContent({ curriculum, onPreview }) {
  const sections = curriculum?.sections || [];
  const [open, setOpen] = useState(() => new Set(sections[0] ? [sections[0].sectionId] : []));
  if (!sections.length) return null;

  const allOpen = open.size === sections.length;
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-900">Course content</h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
        <span>
          {curriculum.totalSections} section{curriculum.totalSections === 1 ? '' : 's'} • {curriculum.totalLectures} lecture
          {curriculum.totalLectures === 1 ? '' : 's'} • {formatLength(curriculum.totalDurationSeconds)} total length
        </span>
        <button
          type="button"
          onClick={() => setOpen(allOpen ? new Set() : new Set(sections.map((s) => s.sectionId)))}
          className="font-bold text-violet-700 hover:text-violet-800"
        >
          {allOpen ? 'Collapse all sections' : 'Expand all sections'}
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-300">
        {sections.map((s, idx) => {
          const isOpen = open.has(s.sectionId);
          return (
            <div key={s.sectionId} className={idx > 0 ? 'border-t border-slate-300' : ''}>
              <button
                type="button"
                onClick={() => toggle(s.sectionId)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 bg-slate-50 px-5 py-4 text-left hover:bg-slate-100"
              >
                {isOpen ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
                <span className="flex-1 font-bold text-slate-900">{s.title}</span>
                <span className="hidden text-sm text-slate-600 sm:block">
                  {s.lectures} lecture{s.lectures === 1 ? '' : 's'} • {formatLength(s.durationSeconds)}
                </span>
              </button>
              {isOpen && (
                <ul className="space-y-1 px-5 py-3">
                  {s.lessons.length === 0 && <li className="py-2 text-sm text-slate-500">No lectures yet.</li>}
                  {s.lessons.map((l) => {
                    const Icon = TYPE_ICON[l.lessonType] || MonitorPlay;
                    return (
                      <li key={l.lessonId} className="flex items-center gap-3 py-2 text-sm">
                        <Icon size={16} className="shrink-0 text-slate-600" />
                        {l.previewAvailable ? (
                          <button type="button" onClick={() => onPreview(l.lessonId)} className="flex-1 text-left text-violet-700 underline hover:text-violet-800">
                            {l.title}
                          </button>
                        ) : (
                          <span className="flex-1 text-slate-700">{l.title}</span>
                        )}
                        {l.previewAvailable && (
                          <button type="button" onClick={() => onPreview(l.lessonId)} className="hidden text-violet-700 underline sm:block">
                            Preview
                          </button>
                        )}
                        {l.durationSeconds > 0 && <span className="w-14 text-right text-slate-500">{formatClock(l.durationSeconds)}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
