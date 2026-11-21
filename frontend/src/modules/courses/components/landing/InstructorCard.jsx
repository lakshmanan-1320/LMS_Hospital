'use client';

import Link from 'next/link';
import { Star, Award, Users, PlayCircle } from 'lucide-react';
import { Collapsible } from './CourseDetailsText';
import { formatCount, backendUrl } from '../../utils/courseFormat';

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || 'I';

export default function InstructorCard({ instructor }) {
  if (!instructor) return null;
  const name = instructor.slug ? (
    <Link href={`/instructors/${instructor.slug}`} className="text-lg font-bold text-violet-700 underline hover:text-violet-800">
      {instructor.name}
    </Link>
  ) : (
    <span className="text-lg font-bold text-violet-700">{instructor.name}</span>
  );

  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-900">Instructor</h2>
      <div className="mt-3">{name}</div>
      {instructor.headline && <p className="text-sm text-slate-500">{instructor.headline}</p>}

      <div className="mt-4 flex items-center gap-4">
        {instructor.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backendUrl(instructor.avatarUrl)} alt="" className="h-28 w-28 rounded-full object-cover" />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-900 text-3xl font-bold text-white">
            {initials(instructor.name)}
          </div>
        )}
        <ul className="space-y-1.5 text-sm text-slate-700">
          {instructor.totalReviews > 0 && (
            <li className="flex items-center gap-2">
              <Star size={14} className="fill-slate-700" /> {Number(instructor.averageRating || 0).toFixed(1)} Instructor rating
            </li>
          )}
          {instructor.totalReviews > 0 && (
            <li className="flex items-center gap-2">
              <Award size={14} /> {formatCount(instructor.totalReviews)} review{instructor.totalReviews === 1 ? '' : 's'}
            </li>
          )}
          <li className="flex items-center gap-2">
            <Users size={14} /> {formatCount(instructor.totalStudents)} student{instructor.totalStudents === 1 ? '' : 's'}
          </li>
          <li className="flex items-center gap-2">
            <PlayCircle size={14} /> {formatCount(instructor.totalCourses)} course{instructor.totalCourses === 1 ? '' : 's'}
          </li>
        </ul>
      </div>

      {instructor.bio && (
        <div className="mt-4">
          <Collapsible maxHeight={140}>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{instructor.bio}</p>
          </Collapsible>
        </div>
      )}
    </section>
  );
}
