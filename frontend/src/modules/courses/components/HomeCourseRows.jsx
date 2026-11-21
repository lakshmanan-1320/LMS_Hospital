'use client';

import { useEffect, useState } from 'react';
import { courseService } from '../services/course.service';
import PublicCourseCard from './PublicCourseCard';

/**
 * Public catalog courses grid: Displays all published courses currently in the database.
 * Shows exactly what exists without repeating courses across artificial categories.
 */
export default function HomeCourseRows() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await courseService.getPublicCatalogue({
          page: 1,
          limit: 50,
          sortBy: 'published_at',
          sortOrder: 'DESC',
        });
        if (!alive) return;
        const items = Array.isArray(res?.items) ? res.items : [];
        setCourses(items);
      } catch {
        if (alive) setError('Unable to load courses. Please try again later.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-slate-500">{error}</p>;
  }

  if (!courses.length) {
    return <p className="text-sm text-slate-500">No courses published yet. Please check back soon.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {courses.map((course) => (
        <PublicCourseCard key={course.courseId} course={course} />
      ))}
    </div>
  );
}
