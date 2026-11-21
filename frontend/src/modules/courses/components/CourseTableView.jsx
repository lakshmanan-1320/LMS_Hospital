'use client';

import Link from 'next/link';
import {
  Edit3,
  Eye,
  Trash2,
  CheckCircle2,
  BookOpen,
  History,
  FileCheck,
  Archive,
  RotateCcw,
  Star,
  Globe,
} from 'lucide-react';
import { useCourseStore } from '../stores/useCourseStore';
import { useCourseApprovalStore } from '../stores/useCourseApprovalStore';

const STATUS_BADGES = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  pending_review: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  published: 'bg-teal-50 text-teal border-teal/30',
  archived: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function CourseTableView({ courses = [], role = 'instructor' }) {
  const { openDeleteModal, openChecklistModal, total, page, limit, setPage, fetchCourses } = useCourseStore();
  const {
    openReviewModal,
    openHistoryModal,
    publishCourse,
    archiveCourse,
    restoreCourse,
    toggleFeatured,
  } = useCourseApprovalStore();

  const isAdmin = role === 'admin';
  const totalPages = Math.ceil(total / limit) || 1;

  const handleAction = async (actionFn) => {
    try {
      await actionFn();
      fetchCourses(role);
    } catch {
      // Handled by approval store
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchCourses(role, { page: newPage });
    }
  };

  return (
    <div className="bg-paper border border-line rounded-2xl shadow-sm overflow-hidden w-full">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-line bg-cream/50 text-[11px] font-bold text-muted uppercase tracking-wider">
              <th className="py-3.5 px-4">Course</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Price</th>
              {role === 'admin' && <th className="py-3.5 px-4">Instructor</th>}
              <th className="py-3.5 px-4">Last Updated</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60 text-sm">
            {courses.map((course) => {
              const id = course.courseId || course.course_id;
              const status = course.status || 'draft';
              const isEditable = status === 'draft' || status === 'rejected' || status === 'published';
              const isDeletable = status === 'draft';

              const priceText = course.isFree
                ? 'Free'
                : course.discountPrice !== null && course.discountPrice !== undefined
                ? `${course.currency || 'INR'} ${course.discountPrice}`
                : `${course.currency || 'INR'} ${course.price || 0}`;

              return (
                <tr key={id} className="hover:bg-cream/40 transition-colors">
                  {/* Title & Thumbnail */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-cream border border-line flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {course.thumbnailUrl ? (
                          <img
                            src={course.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <BookOpen size={18} className="text-muted/50" />
                        )}
                      </div>
                      <div className="min-w-0 max-w-xs">
                        <Link
                          href={`/dashboard/${role}/courses/${course.slug || id}`}
                          className="font-bold text-ink hover:text-teal transition-colors block truncate"
                        >
                          {course.title}
                        </Link>
                        <span className="text-xs text-muted block truncate font-mono">
                          /{course.slug}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3.5 px-4 text-xs font-semibold text-ink">
                    {course.categoryName || '—'}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${
                        STATUS_BADGES[status] || STATUS_BADGES.draft
                      }`}
                    >
                      {status.replace('_', ' ')}
                    </span>
                  </td>

                  {/* Price */}
                  <td className="py-3.5 px-4 text-xs font-bold text-ink">
                    {priceText}
                  </td>

                  {/* Instructor (admin only) */}
                  {role === 'admin' && (
                    <td className="py-3.5 px-4 text-xs text-muted">
                      <span className="font-semibold text-ink block">
                        {course.instructorName || 'Unknown'}
                      </span>
                      <span className="text-[11px] block">{course.instructorEmail}</span>
                    </td>
                  )}

                  {/* Updated At */}
                  <td className="py-3.5 px-4 text-xs text-muted">
                    {new Date(course.updatedAt || course.created_at).toLocaleDateString(
                      undefined,
                      {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      },
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openChecklistModal(course)}
                        className="p-1.5 text-muted hover:text-teal rounded-lg hover:bg-cream transition-colors cursor-pointer"
                        title="Check readiness"
                      >
                        <CheckCircle2 size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => openHistoryModal(id, course.title)}
                        className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-cream transition-colors cursor-pointer"
                        title="Status audit history"
                      >
                        <History size={15} />
                      </button>

                      {isAdmin && status === 'published' && (
                        <button
                          type="button"
                          onClick={() => handleAction(() => toggleFeatured(id, Boolean(course.isFeatured || course.is_featured)))}
                          className={`p-1.5 rounded-lg hover:bg-cream transition-colors cursor-pointer ${
                            (course.isFeatured || course.is_featured) ? 'text-amber-500' : 'text-muted hover:text-amber-500'
                          }`}
                          title={(course.isFeatured || course.is_featured) ? 'Featured course (click to unfeature)' : 'Feature course'}
                        >
                          <Star size={15} className={(course.isFeatured || course.is_featured) ? 'fill-amber-400' : ''} />
                        </button>
                      )}

                      {/* Admin Review Action */}
                      {isAdmin && status === 'pending_review' && (
                        <button
                          type="button"
                          onClick={() => openReviewModal(id)}
                          className="px-2.5 py-1 bg-teal text-white hover:bg-teal-dark rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-all"
                          title="Review submission"
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
                          className="px-2 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
                          title="Publish course directly to catalogue"
                        >
                          <Globe size={11} />
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
                          <Archive size={15} />
                        </button>
                      )}

                      {/* Admin Restore Action */}
                      {isAdmin && status === 'archived' && (
                        <button
                          type="button"
                          onClick={() => handleAction(() => restoreCourse(id))}
                          className="px-2 py-1 bg-paper border border-line text-ink hover:bg-cream rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Restore course to draft"
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
                          <Trash2 size={15} />
                        </button>
                      )}

                      <Link
                        href={`/dashboard/${role}/courses/${course.slug || id}`}
                        className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-cream transition-colors inline-block"
                        title={isEditable ? 'Edit Course' : 'View Course'}
                      >
                        {isEditable ? <Edit3 size={15} /> : <Eye size={15} />}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-line flex items-center justify-between text-xs text-muted bg-paper">
        <div>
          Showing <span className="font-bold text-ink">{courses.length}</span> of{' '}
          <span className="font-bold text-ink">{total}</span> courses
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              className="px-3 py-1.5 border border-line rounded-lg font-bold hover:bg-cream disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <span className="px-2 font-bold text-ink">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
              className="px-3 py-1.5 border border-line rounded-lg font-bold hover:bg-cream disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

