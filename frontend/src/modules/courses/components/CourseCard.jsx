'use client';

import Link from 'next/link';
import {
  BookOpen,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  Layers,
  History,
  FileCheck,
  Archive,
  RotateCcw,
  Star,
  Send,
  Globe,
} from 'lucide-react';
import { useCourseStore } from '../stores/useCourseStore';
import { useCourseApprovalStore } from '../stores/useCourseApprovalStore';

const STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  pending_review: {
    label: 'In Review',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: 'Changes Requested',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  published: {
    label: 'Published',
    bg: 'bg-teal-50',
    text: 'text-teal',
    border: 'border-teal/30',
    dot: 'bg-teal',
  },
  archived: {
    label: 'Archived',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
};

const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All Levels',
};

export default function CourseCard({ course, role = 'instructor' }) {
  const { openDeleteModal, openChecklistModal, fetchCourses } = useCourseStore();
  const {
    openReviewModal,
    openHistoryModal,
    publishCourse,
    archiveCourse,
    restoreCourse,
    toggleFeatured,
  } = useCourseApprovalStore();

  const id = course.courseId || course.course_id;
  const status = course.status || 'draft';
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const isEditable = status === 'draft' || status === 'rejected' || status === 'published';
  const isDeletable = status === 'draft';
  const isAdmin = role === 'admin';
  const isFeatured = Boolean(course.isFeatured || course.is_featured);

  const handleAction = async (actionFn) => {
    try {
      await actionFn();
      fetchCourses(role);
    } catch {
      // Handled by approval store
    }
  };

  const priceDisplay = course.isFree
    ? 'Free'
    : course.discountPrice !== null && course.discountPrice !== undefined
    ? `${course.currency || 'INR'} ${course.discountPrice}`
    : `${course.currency || 'INR'} ${course.price || 0}`;

  return (
    <div className="bg-paper border border-line rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
      <div>
        {/* Thumbnail & Badges */}
        <div className="relative w-full h-44 rounded-xl overflow-hidden bg-cream mb-4 border border-line/60 flex items-center justify-center">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted/60 p-4 text-center">
              <BookOpen size={36} className="text-muted/40 mb-2 stroke-[1.5]" />
              <span className="text-xs font-semibold">No Thumbnail Set</span>
            </div>
          )}

          {/* Status Badge */}
          <div
            className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 backdrop-blur-md ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </div>

          {/* Level Badge */}
          <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-ink/70 text-white backdrop-blur-sm">
            {LEVEL_LABELS[course.level] || 'All Levels'}
          </div>

          {/* Price Tag */}
          <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg text-xs font-heading font-bold bg-paper/90 text-ink shadow-sm border border-line backdrop-blur-sm">
            {priceDisplay}
          </div>
        </div>

        {/* Category Pill */}
        <div className="flex items-center gap-1 text-[11px] font-semibold text-teal uppercase tracking-wider mb-1.5">
          <Layers size={12} />
          <span>{course.categoryName || 'General Track'}</span>
        </div>

        {/* Title */}
        <h3 className="font-heading text-base font-bold text-ink line-clamp-2 mb-1 group-hover:text-teal transition-colors">
          {course.title}
        </h3>

        {/* Subtitle / Description */}
        <p className="text-xs text-muted line-clamp-2 mb-3">
          {course.subtitle || 'No subtitle provided yet.'}
        </p>

        {/* Instructor info if admin view */}
        {course.instructorName && (
          <div className="text-[11px] text-muted mb-2 flex items-center gap-1">
            <span className="font-bold text-ink">Instructor:</span>
            <span>{course.instructorName}</span>
          </div>
        )}
      </div>

      {/* Footer & Actions */}
      <div className="pt-3 border-t border-line/60 flex items-center justify-between gap-1.5 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openChecklistModal(course)}
            className="text-xs text-muted hover:text-teal flex items-center gap-1 font-semibold transition-colors cursor-pointer py-1.5 px-2 rounded-lg hover:bg-cream"
            title="Inspect Submission Readiness Checklist"
          >
            <CheckCircle2 size={13} className="text-teal" />
            <span>Checklist</span>
          </button>

          <button
            type="button"
            onClick={() => openHistoryModal(id, course.title)}
            className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-cream transition-colors cursor-pointer"
            title="View status audit history"
          >
            <History size={14} />
          </button>

          {isAdmin && status === 'published' && (
            <button
              type="button"
              onClick={() => handleAction(() => toggleFeatured(id, isFeatured))}
              className={`p-1.5 rounded-lg hover:bg-cream transition-colors cursor-pointer ${
                isFeatured ? 'text-amber-500' : 'text-muted hover:text-amber-500'
              }`}
              title={isFeatured ? 'Featured on catalogue (click to unfeature)' : 'Feature course on catalogue'}
            >
              <Star size={14} className={isFeatured ? 'fill-amber-400' : ''} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Admin Review Action */}
          {isAdmin && status === 'pending_review' && (
            <button
              type="button"
              onClick={() => openReviewModal(id)}
              className="px-2.5 py-1.5 bg-teal text-white hover:bg-teal-dark rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-all active:scale-95"
              title="Review submission checklist and syllabus"
            >
              <FileCheck size={13} />
              <span>Review</span>
            </button>
          )}

          {/* Admin Publish Action (Direct publish from draft, pending_review, or approved without separate approval) */}
          {isAdmin && (status === 'approved' || status === 'draft' || status === 'pending_review' || status === 'rejected') && (
            <button
              type="button"
              onClick={() => handleAction(() => publishCourse(id))}
              className="px-2.5 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-all active:scale-95"
              title="Publish course directly to catalogue"
            >
              <Globe size={12} />
              <span>Publish</span>
            </button>
          )}

          {/* Admin Archive Action */}
          {isAdmin && (status === 'published' || status === 'approved') && (
            <button
              type="button"
              onClick={() => handleAction(() => archiveCourse(id))}
              className="p-1.5 text-muted hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Archive course"
            >
              <Archive size={14} />
            </button>
          )}

          {/* Admin Restore Action */}
          {isAdmin && status === 'archived' && (
            <button
              type="button"
              onClick={() => handleAction(() => restoreCourse(id))}
              className="px-2.5 py-1.5 bg-paper border border-line text-ink hover:bg-cream rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              title="Restore archived course to draft"
            >
              <RotateCcw size={13} />
              <span>Restore</span>
            </button>
          )}

          {isDeletable && (
            <button
              type="button"
              onClick={() => openDeleteModal(course)}
              className="p-1.5 text-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
              title="Delete draft course"
            >
              <Trash2 size={14} />
            </button>
          )}

          <Link
            href={`/dashboard/${role}/courses/${course.slug || id}`}
            className="px-3 py-1.5 bg-ink text-white hover:bg-ink/90 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
          >
            {isEditable ? (
              <>
                <Edit3 size={13} />
                <span>Edit</span>
              </>
            ) : (
              <>
                <Eye size={13} />
                <span>View</span>
              </>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}

