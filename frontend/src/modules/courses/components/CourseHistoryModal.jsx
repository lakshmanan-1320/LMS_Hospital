'use client';

import { X, History, Clock, User, ArrowRight, FileText } from 'lucide-react';
import { useCourseApprovalStore } from '../stores/useCourseApprovalStore';

export default function CourseHistoryModal() {
  const { historyModal, closeHistoryModal, activeHistory, isLoadingHistory } =
    useCourseApprovalStore();

  if (!historyModal.isOpen) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'published':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'approved':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'pending_review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rejected':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'archived':
        return 'bg-slate-50 text-slate-700 border-slate-200';
      case 'draft':
      default:
        return 'bg-cream text-muted border-line';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-paper border border-line rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-cream/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal/10">
              <History size={18} className="text-teal" />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-ink">
                Status Audit Trail
              </h3>
              <p className="text-xs text-muted">
                Complete chronological transition history
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeHistoryModal}
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-cream transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Course Title Badge */}
        {historyModal.courseTitle && (
          <div className="px-5 py-2.5 bg-cream/30 border-b border-line text-xs flex items-center gap-2">
            <span className="text-muted font-bold text-[10px] uppercase tracking-wider">
              Course:
            </span>
            <span className="text-ink font-bold line-clamp-1">
              {historyModal.courseTitle}
            </span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {isLoadingHistory ? (
            <div className="py-12 text-center text-xs text-muted flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
              <span>Loading audit records...</span>
            </div>
          ) : activeHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted">
              <History size={24} className="mx-auto mb-2 text-muted/60" />
              <p>No status transitions recorded yet for this course.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-line/80 ml-3 space-y-5 py-1">
              {activeHistory.map((entry, idx) => (
                <div key={entry.history_id || idx} className="relative pl-6">
                  {/* Timeline bullet dot */}
                  <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-paper border-2 border-teal" />

                  <div className="p-3.5 rounded-xl border border-line bg-cream/20 space-y-2">
                    {/* Status Badge Transition */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold border ${getStatusColor(
                            entry.from_status,
                          )}`}
                        >
                          {entry.from_status || 'initial'}
                        </span>
                        <ArrowRight size={12} className="text-muted" />
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold border ${getStatusColor(
                            entry.to_status,
                          )}`}
                        >
                          {entry.to_status}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted flex items-center gap-1">
                        <Clock size={11} />
                        {formatDate(entry.created_at)}
                      </span>
                    </div>

                    {/* Actor Details */}
                    {(entry.changed_by_name || entry.changed_by_email) && (
                      <div className="flex items-center gap-1 text-[11px] text-muted">
                        <User size={12} className="text-teal" />
                        <span>Changed by:</span>
                        <strong className="text-ink">
                          {entry.changed_by_name || entry.changed_by_email}
                        </strong>
                      </div>
                    )}

                    {/* Transition Note / Reason */}
                    {entry.note && (
                      <div className="p-2.5 rounded-lg bg-paper border border-line/70 text-xs text-ink/90 flex items-start gap-2">
                        <FileText size={13} className="text-muted mt-0.5 flex-shrink-0" />
                        <span className="break-words italic">"{entry.note}"</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-cream/30 flex justify-end">
          <button
            type="button"
            onClick={closeHistoryModal}
            className="px-4 py-2 rounded-xl text-xs font-bold text-ink bg-paper border border-line hover:bg-cream transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

