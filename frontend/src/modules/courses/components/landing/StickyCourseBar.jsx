'use client';

import StarRating from '../StarRating';
import CourseBadge from '../CourseBadge';
import { formatCount } from '../../utils/courseFormat';

/** Compact bar that appears under the site header once the course header scrolls away. */
export default function StickyCourseBar({ course, visible }) {
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 top-20 z-20 bg-slate-900 text-white shadow-lg transition-transform duration-200 ${
        visible ? 'translate-y-0' : '-translate-y-[200%]'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6">
        <p className="truncate text-sm font-bold sm:text-base">{course.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
          {course.badges?.[0] && <CourseBadge badge={course.badges[0]} />}
          {course.totalReviewsCount > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-400">
              <b>{Number(course.averageRating).toFixed(1)}</b> <StarRating value={course.averageRating} size={11} />
              <span className="text-violet-300">({formatCount(course.totalReviewsCount)} ratings)</span>
            </span>
          )}
          <span className="text-slate-200">{formatCount(course.totalStudents)} students</span>
        </div>
      </div>
    </div>
  );
}
