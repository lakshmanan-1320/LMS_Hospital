'use client';

import { useState } from 'react';
import { X, Send, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react';
import { useCourseApprovalStore } from '../stores/useCourseApprovalStore';

export default function CourseSubmitModal({ checklist, onSuccess }) {
  const { submitModal, closeSubmitModal, submitCourse, isActionLoading, error } =
    useCourseApprovalStore();

  const [note, setNote] = useState('');

  if (!submitModal.isOpen) return null;

  const isReady = checklist?.ready || false;
  const failedItems = checklist?.items?.filter((i) => !i.ok) || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isReady) return;

    try {
      await submitCourse(submitModal.courseId, note.trim());
      setNote('');
      if (onSuccess) onSuccess();
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-paper border border-line rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-cream/40">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isReady ? 'bg-teal/10 text-teal' : 'bg-amber-100 text-amber-700'}`}>
              <Send size={18} />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-ink">
                Submit Course for Review
              </h3>
              <p className="text-xs text-muted">
                Platform verification before public catalogue publication
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSubmitModal}
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-cream transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {submitModal.courseTitle && (
            <div className="p-3 rounded-xl bg-cream/50 border border-line text-xs">
              <span className="text-muted block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                Target Course
              </span>
              <strong className="text-ink font-bold line-clamp-1">
                {submitModal.courseTitle}
              </strong>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle size={15} className="text-rose-500 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Readiness Status Box */}
          {isReady ? (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>All 10 Submission Requirements Met!</span>
              </div>
              <p className="text-[11px] text-emerald-700 pl-6">
                Your course meets all quality guidelines and curriculum criteria. Submitting will send your course to the platform review queue and lock editing while under review.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertCircle size={16} className="text-amber-600" />
                <span>Requirements Incomplete ({10 - failedItems.length}/10 Met)</span>
              </div>
              <p className="text-[11px] text-amber-700">
                The following required items must be satisfied before submission:
              </p>
              <ul className="space-y-1 pl-4 list-disc text-[11px] text-amber-900">
                {failedItems.map((item) => (
                  <li key={item.key}>{item.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Optional Submission Note */}
          {isReady && (
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-ink flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-teal" />
                  Submission Note for Reviewer (Optional)
                </span>
                <span className="text-[11px] text-muted font-normal">
                  {note.length} / 500 chars
                </span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Add any specific context or notes for the reviewer team (e.g., Target audience specifics, newly added chapters)..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal bg-paper placeholder:text-muted/60 transition-all"
              />
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
            <button
              type="button"
              onClick={closeSubmitModal}
              disabled={isActionLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-muted hover:text-ink hover:bg-cream transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isReady || isActionLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal hover:bg-teal-dark disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Send size={13} />
              <span>{isActionLoading ? 'Submitting...' : 'Submit for Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

