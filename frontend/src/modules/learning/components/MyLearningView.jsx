'use client';

// Learner area on the public site (/my-learning) for every role. Based on the Student Learning
// Management page; links point to the public routes instead of /dashboard/student.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  GraduationCap,
  RefreshCw,
  PlayCircle,
  Award,
} from 'lucide-react';
import { courseService } from '@/modules/courses/services/course.service';

const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All Levels',
};

export default function MyLearningPage() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEnrollments = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await courseService.getMyEnrollments();
      setEnrollments(response?.items || []);
    } catch (err) {
      setError(err.message || 'Unable to load your courses.');
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEnrollments();
  }, [loadEnrollments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-600">
            YOUR LEARNING JOURNEY
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            My Learning
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Access the courses you have enrolled in.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Enrolled courses</p>
          <p className="text-xl font-bold text-slate-900">
            {enrollments.length}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span>
          <button
            onClick={loadEnrollments}
            className="flex items-center gap-2 font-semibold"
          >
            <RefreshCw size={15} />
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-80 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
      ) : enrollments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <GraduationCap
            size={44}
            className="mx-auto mb-3 text-slate-300"
          />
          <h2 className="font-semibold text-slate-800">
            No enrolled courses yet
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Explore the course catalogue and enroll in a course to start learning.
          </p>
          <Link
            href="/#courses"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700"
          >
            <BookOpen size={17} />
            Explore Courses
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((enrollment) => {
            const courseId = enrollment.courseId || enrollment.course_id;
            const title = enrollment.title;
            const subtitle = enrollment.subtitle || enrollment.description || 'Explore this course.';
            const thumbnailUrl = enrollment.thumbnailUrl || enrollment.thumbnail_url;
            const instructorName = enrollment.instructorName || enrollment.instructor_name;
            const status = enrollment.enrollmentStatus || enrollment.enrollment_status;
            const progressPct = Number(enrollment.progressPercentage ?? enrollment.progress_percentage ?? 0);
            const completedCount = Number(enrollment.completedLessons ?? enrollment.completed_lessons ?? 0);
            const totalCount = Number(enrollment.totalLessons ?? enrollment.total_lessons ?? 0);
            const isFinished = status === 'completed' || progressPct === 100;

            return (
              <article
                key={enrollment.enrollmentId || enrollment.enrollment_id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="relative h-48 overflow-hidden bg-slate-100">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen size={48} className="text-slate-300" />
                    </div>
                  )}
                  {isFinished && (
                    <span className="absolute top-3 right-3 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow">
                      Completed
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                        {LEVEL_LABELS[enrollment.level] || 'All Levels'}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          isFinished
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-teal-50 text-teal-700'
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    <h2 className="line-clamp-2 text-base font-bold text-slate-900">
                      {title}
                    </h2>

                    {instructorName && (
                      <p className="text-xs font-medium text-slate-500">
                        Instructor: <span className="text-slate-700">{instructorName}</span>
                      </p>
                    )}

                    <p className="line-clamp-2 min-h-8 text-xs text-slate-500">
                      {subtitle}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{progressPct}% completed</span>
                        <span className="text-slate-500">
                          {completedCount} of {totalCount} lessons
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isFinished ? 'bg-emerald-500' : 'bg-teal-600'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>
                        Enrolled {new Date(enrollment.enrolledAt || enrollment.enrolled_at).toLocaleDateString('en-IN')}
                      </span>
                    </div>

                    <Link
                      href={`/my-learning/${courseId}`}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                    >
                      <PlayCircle size={16} />
                      {isFinished ? 'Review Course' : progressPct > 0 ? 'Continue Learning' : 'Start Learning'}
                    </Link>


                    {isFinished && (
                      <Link
                        href="/dashboard/student/certificates"
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                      >
                        <Award size={15} className="text-emerald-600" />
                        View Certificate
                      </Link>
                    )}

                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
