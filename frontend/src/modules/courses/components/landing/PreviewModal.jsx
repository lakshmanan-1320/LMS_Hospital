'use client';

import { useEffect, useState } from 'react';
import { X, PlayCircle } from 'lucide-react';
import { API_ENDPOINTS } from '@/constants/endpoints';
import { backendUrl, formatClock } from '../../utils/courseFormat';

/**
 * Course preview player: the promo video and every free-preview lesson, playable by anyone.
 * @param {{ open: boolean, onClose: () => void, courseTitle: string, promoVideo?: object, previews: object[], initialId?: string }} props
 */
export default function PreviewModal({ open, onClose, courseTitle, promoVideo, previews = [], initialId }) {
  const items = [
    ...(promoVideo?.url ? [{ id: 'promo', title: 'Course introduction', durationSeconds: promoVideo.durationSeconds, src: backendUrl(promoVideo.url) }] : []),
    ...previews.map((l) => ({
      id: l.lessonId,
      title: l.title,
      durationSeconds: l.durationSeconds,
      src: backendUrl(API_ENDPOINTS.STUDENT_LEARNING.PUBLIC_LESSON_MEDIA(l.lessonId)),
    })),
  ];
  const [activeId, setActiveId] = useState(initialId || items[0]?.id);

  useEffect(() => {
    if (open) setActiveId(initialId || items[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || items.length === 0) return null;
  const active = items.find((i) => i.id === activeId) || items[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Course preview">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-slate-900 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div>
            <p className="text-sm font-semibold text-slate-300">Course preview</p>
            <h2 className="mt-0.5 text-lg font-bold">{courseTitle}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-300 hover:bg-white/10" aria-label="Close preview">
            <X size={22} />
          </button>
        </div>
        <video key={active.src} src={active.src} controls autoPlay playsInline className="aspect-video w-full bg-black" />
        {items.length > 1 && (
          <div className="overflow-y-auto p-5 pt-4">
            <p className="mb-2 text-sm font-bold">Free sample videos</p>
            <ul className="space-y-1">
              {items.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(i.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      i.id === active.id ? 'bg-white/15' : 'hover:bg-white/10'
                    }`}
                  >
                    <PlayCircle size={18} className="shrink-0 text-slate-300" />
                    <span className="flex-1 truncate">{i.title}</span>
                    {i.durationSeconds ? <span className="text-xs text-slate-400">{formatClock(i.durationSeconds)}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
