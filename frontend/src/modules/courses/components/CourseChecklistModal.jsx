'use client';

import { X, CheckCircle2, AlertCircle, Sparkles, BookOpen } from 'lucide-react';
import { useCourseStore } from '../stores/useCourseStore';

export default function CourseChecklistModal() {
  const { checklistModal, closeChecklistModal } = useCourseStore();
  const { isOpen, course, data, isLoading } = checklistModal;

  if (!isOpen || !course) return null;

  const items = data?.items || [];
  const isReady = Boolean(data?.ready);
  const completedCount = items.filter((i) => i.ok).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fadeIn"
      onClick={closeChecklistModal}
    >
      <div
        className="w-full max-w-lg bg-paper border border-line rounded-2xl p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="eyebrow flex items-center gap-1.5 text-[11px] font-bold text-teal uppercase mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-coral" />
              Submission Readiness Inspector
            </div>
            <h2 className="font-heading text-xl font-bold text-ink truncate max-w-sm">
              {course.title}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Module 7 approval audit rules. All 10 requirements must pass before submitting.
            </p>
          </div>
          <button
            type="button"
            onClick={closeChecklistModal}
            className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-cream transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Overall Status Banner */}
        <div
          className={`p-4 rounded-xl border mb-5 flex items-center justify-between gap-3 ${
            isReady
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isReady ? (
              <CheckCircle2 size={22} className="text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle size={22} className="text-amber-600 flex-shrink-0" />
            )}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                {isReady ? 'Ready for Submission' : 'Incomplete Requirements'}
              </h4>
              <p className="text-xs mt-0.5 opacity-90">
                {isReady
                  ? 'All criteria met. This course can now be submitted for review.'
                  : `${completedCount} of 10 items completed. Please resolve pending items below.`}
              </p>
            </div>
          </div>
          <span className="text-sm font-heading font-bold px-2.5 py-1 rounded-lg bg-paper/80 shadow-sm border border-line flex-shrink-0">
            {completedCount}/10
          </span>
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center text-muted">
            <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">Evaluating course requirements...</span>
          </div>
        )}

        {/* Checklist Items List */}
        {!isLoading && (
          <div className="space-y-2.5 mb-6">
            {items.map((item) => (
              <div
                key={item.key}
                className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                  item.ok
                    ? 'bg-paper border-line/70'
                    : 'bg-rose-50/40 border-rose-200'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {item.ok ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                    {item.key.replace('_', ' ')}
                  </span>
                  <p className="text-xs text-muted mt-0.5">{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-line">
          <button
            type="button"
            onClick={closeChecklistModal}
            className="px-4 py-2 bg-ink text-white hover:bg-ink/90 rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

