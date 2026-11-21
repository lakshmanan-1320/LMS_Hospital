'use client';

import Link from 'next/link';
import { ChevronRight, CalendarClock, Globe, BarChart3 } from 'lucide-react';
import StarRating from '../StarRating';
import CourseBadge from '../CourseBadge';
import { formatCount, formatMonthYear, LEVEL_LABELS } from '../../utils/courseFormat';

/**
 * Dark header band: breadcrumb, title, subtitle, badge, rating, students, creator, meta.
 */
export default function CourseHero({ course, breadcrumb = [], instructor, onRatingsClick }) {
  return (
    <div className="space-y-4">
      {breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm font-bold text-violet-300">
          {breadcrumb.map((b, i) => (
            <span key={b.id} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="text-slate-400" />}
              {b.name}
            </span>
          ))}
        </nav>
      )}

      <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">{course.title}</h1>
      {course.subtitle && <p className="text-lg leading-relaxed text-slate-100">{course.subtitle}</p>}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {course.badges?.map((b) => <CourseBadge key={b.key} badge={b} />)}
        {course.totalReviewsCount > 0 ? (
          <button type="button" onClick={onRatingsClick} className="inline-flex items-center gap-1.5 text-amber-400 hover:underline">
            <span className="font-bold">{Number(course.averageRating).toFixed(1)}</span>
            <StarRating value={course.averageRating} size={14} />
            <span className="text-violet-300 underline">({formatCount(course.totalReviewsCount)} ratings)</span>
          </button>
        ) : (
          <span className="text-slate-300">No ratings yet</span>
        )}
        <span className="text-slate-100">{formatCount(course.totalStudents)} student{course.totalStudents === 1 ? '' : 's'}</span>
      </div>

      {instructor && (
        <p className="text-sm text-slate-100">
          Created by{' '}
          {instructor.slug ? (
            <Link href={`/instructors/${instructor.slug}`} className="text-violet-300 underline hover:text-violet-200">
              {instructor.name}
            </Link>
          ) : (
            <span className="text-violet-300">{instructor.name}</span>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-100">
        {course.lastUpdatedAt && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock size={15} /> Last updated {formatMonthYear(course.lastUpdatedAt)}
          </span>
        )}
        {course.language && (
          <span className="inline-flex items-center gap-1.5">
            <Globe size={15} /> {course.language}
          </span>
        )}
        {course.level && (
          <span className="inline-flex items-center gap-1.5">
            <BarChart3 size={15} /> {LEVEL_LABELS[course.level] || course.level}
          </span>
        )}
      </div>
    </div>
  );
}
