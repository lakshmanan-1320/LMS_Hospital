'use client';

import { useState } from 'react';
import { X, AlertTriangle, MessageSquare } from 'lucide-react';
import { useCourseApprovalStore } from '../stores/useCourseApprovalStore';

export default function CourseRejectModal({ onSuccess }) {
  const { rejectModal, closeRejectModal, rejectCourse, isActionLoading, error } =
    useCourseApprovalStore();

  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState('');

  if (!rejectModal.isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    const trimmed = reason.trim();
    if (!trimmed || trimmed.length < 5) {
      setLocalError('Please provide a constructive rejection reason (at least 5 characters).');
      return;
    }

    try {
      await rejectCourse(rejectModal.courseId, trimmed);
      setReason('');
      if (onSuccess) onSuccess();
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-paper border border-line rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-cream/40">
          <div className="flex items-center gap-2.5 text-rose-700">
            <div className="p-2 rounded-xl bg-rose-100">
              <AlertTriangle size={18} className="text-rose-600" />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-ink">
                Reject Course Submission
              </h3>
              <p className="text-xs text-muted">
                Return course to author with actionable improvement feedback
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeRejectModal}
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-cream transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {rejectModal.courseTitle && (
            <div className="p-3 rounded-xl bg-cream/50 border border-line text-xs">
              <span className="text-muted block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                Target Course
              </span>
              <strong className="text-ink font-bold line-clamp-1">
                {rejectModal.courseTitle}
              </strong>
            </div>
          )}

          {(localError || error) && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle size={15} className="text-rose-500 flex-shrink-0 mt-0.5" />
              <span>{localError || error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MessageSquare size={13} className="text-teal" />
                Feedback Reason for Instructor <span className="text-rose-500">*</span>
              </span>
              <span className="text-[11px] text-muted font-normal">
                {reason.length} / 2000 chars
              </span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (localError) setLocalError('');
              }}
              rows={4}
              maxLength={2000}
              placeholder="Explain clearly what requires revision (e.g. video audio quality, missing lesson outcomes, syllabus outline)..."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 bg-paper placeholder:text-muted/60 transition-all"
              required
            />
            <p className="text-[11px] text-muted">
              The instructor will see this feedback directly in their course studio to make necessary edits.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
            <button
              type="button"
              onClick={closeRejectModal}
              disabled={isActionLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-muted hover:text-ink hover:bg-cream transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isActionLoading || reason.trim().length < 5}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              {isActionLoading ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

