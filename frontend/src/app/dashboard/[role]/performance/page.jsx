'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  TrendingUp,
  DollarSign,
  Users,
  Star,
  BookOpen,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  GraduationCap,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
  Award,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { dashboardService } from '@/modules/dashboard/services/dashboard.service';
import { instructorService } from '@/modules/instructors/services/instructor.service';

export default function InstructorPerformancePage() {
  const params = useParams();
  const router = useRouter();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role || 'instructor';

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'students'
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('12_months');
  const [searchStudent, setSearchStudent] = useState('');

  const [overviewData, setOverviewData] = useState(null);
  const [learners, setLearners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLearnersLoading, setIsLearnersLoading] = useState(false);
  const [error, setError] = useState(null);

  // Redirect students away from instructor performance
  useEffect(() => {
    if (rawRole === 'student') {
      router.replace('/dashboard/student');
    }
  }, [rawRole, router]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const overviewRes = await dashboardService.getOverview();
      const overview = overviewRes?.data?.data || overviewRes?.data || overviewRes || {};
      setOverviewData(overview);

      // Load all learners for this instructor
      setIsLearnersLoading(true);
      try {
        const learnersRes = await instructorService.getMyLearners();
        const learnerItems = Array.isArray(learnersRes?.data?.data)
          ? learnersRes.data.data
          : Array.isArray(learnersRes?.data)
          ? learnersRes.data
          : Array.isArray(learnersRes)
          ? learnersRes
          : [];
        setLearners(learnerItems);
      } catch (err) {
        console.warn('Failed to fetch detailed learners list, using overview recent list:', err);
        setLearners(overview.recentEnrollments || []);
      } finally {
        setIsLearnersLoading(false);
      }
    } catch (err) {
      console.error('Failed to load performance data:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load performance overview');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = overviewData?.stats || {};
  const courses = overviewData?.courses || [];

  // Filter learners by selected course and search
  const filteredLearners = useMemo(() => {
    return learners.filter((learner) => {
      const matchesCourse =
        selectedCourseFilter === 'all' ||
        learner.courseId === selectedCourseFilter ||
        learner.courseTitle === selectedCourseFilter;

      const q = searchStudent.toLowerCase().trim();
      const name = `${learner.firstName || ''} ${learner.lastName || ''}`.toLowerCase();
      const email = (learner.email || '').toLowerCase();
      const course = (learner.courseTitle || '').toLowerCase();
      const matchesSearch = !q || name.includes(q) || email.includes(q) || course.includes(q);

      return matchesCourse && matchesSearch;
    });
  }, [learners, selectedCourseFilter, searchStudent]);

  const formatPrice = (val, currency = 'INR') => {
    const num = Number(val || 0);
    return `${currency === 'INR' ? '₹' : currency} ${num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(dateStr);
    }
  };

  const totalRevenue = stats.totalRevenue || 0;
  const totalLearners = stats.totalLearners || learners.length || 0;
  const publishedCourses = stats.publishedCourses || 0;
  const totalCourses = stats.totalCourses || courses.length || 0;

  if (rawRole === 'student') return null;

  return (
    <div className="w-full space-y-6">
      {/* Top Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Performance
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Track course revenue, student enrollments, and learner engagement across your courses.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Course Selector Dropdown (Udemy-Style) */}
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-teal-500 focus:outline-none cursor-pointer shadow-xs"
            >
              <option value="all">All courses</option>
              {courses.map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.title}
                </option>
              ))}
            </select>

            {/* Time Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-teal-500 focus:outline-none cursor-pointer shadow-xs"
            >
              <option value="12_months">Last 12 months</option>
              <option value="30_days">Last 30 days</option>
              <option value="all_time">All time</option>
            </select>

            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
              title="Refresh Performance"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-teal-600' : ''} />
            </button>
          </div>
        </div>

        {/* Tab Navigation (Udemy-Style: Overview vs Students) */}
        <div className="flex items-center gap-6 mt-6">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`relative pb-3 text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'text-slate-900 border-b-2 border-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`relative pb-3 text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'students'
                ? 'text-slate-900 border-b-2 border-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Students</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                activeTab === 'students'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {learners.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="py-24 text-center text-slate-400 space-y-3 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <p className="text-xs font-medium text-slate-500">Loading your performance metrics...</p>
        </div>
      ) : error ? (
        <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0 text-rose-600" />
          <div>
            <p className="font-bold">Error loading performance</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      ) : activeTab === 'overview' ? (
        /* ================= OVERVIEW TAB (Udemy Style) ================= */
        <div className="space-y-6">
          {/* KPI Cards Row (Exact Udemy 3-card + Active Courses) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revenue */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Revenue</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <DollarSign size={16} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900">
                {formatPrice(totalRevenue)}
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">Total revenue earned</span>
            </div>

            {/* Enrollments */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Enrollments</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                  <Users size={16} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900">
                {totalLearners}
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">Total course enrollments</span>
            </div>

            {/* Average Ratings */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Average Ratings</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Star size={16} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 flex items-center gap-1.5">
                <span>0.00</span>
                <span className="text-xs font-normal text-slate-400">/ 5.0</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">Student review score</span>
            </div>

            {/* Courses Overview */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Course Catalog</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                  <BookOpen size={16} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900">
                {publishedCourses} <span className="text-xs font-normal text-slate-400">/ {totalCourses} total</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">Live published courses</span>
            </div>
          </div>

          {/* Revenue Over Time Chart Banner (Udemy Style) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Revenue & Growth Momentum</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visual breakdown of enrollments and learner signups over time.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-teal-200">
                <TrendingUp size={13} />
                <span>Active Track</span>
              </span>
            </div>

            {totalRevenue === 0 && totalLearners === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <p className="text-sm font-medium text-slate-600">No revenue data to display yet</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  When students purchase or enroll in your courses, their progress and revenue contributions will be charted here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                  <span>Learner Engagement Pace</span>
                  <span className="font-bold text-teal-700">{totalLearners} Active Learners</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(15, totalLearners * 20))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Courses Performance Breakdown */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Your Courses Breakdown</h3>
                <p className="text-xs text-slate-500 mt-0.5">Learner counts and curriculum status by course.</p>
              </div>
              <Link
                href="/dashboard/instructor/courses"
                className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 transition"
              >
                <span>View all</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {courses.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No courses created yet. Click "Create a course" to publish your first class!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-5">Course Title</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5">Enrolled Learners</th>
                      <th className="py-3 px-5">Curriculum</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {courses.map((c) => {
                      const isPublished = c.status === 'published';
                      return (
                        <tr key={c.courseId} className="hover:bg-slate-50/60 transition group">
                          <td className="py-3.5 px-5 font-bold text-slate-900 max-w-sm">
                            <span className="line-clamp-1 group-hover:text-teal-700 transition">{c.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">/{c.slug}</span>
                          </td>
                          <td className="py-3.5 px-5">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                isPublished
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {c.status || 'draft'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-bold text-slate-800 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <Users size={13} className="text-slate-400" />
                              <span>{c.enrollmentCount || 0} students</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-slate-600 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              <Layers size={13} className="text-slate-400" />
                              <span>{c.lessonCount || 0} lessons</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <Link
                              href={`/dashboard/instructor/courses/${c.slug || c.courseId}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 hover:border-teal-300 transition"
                            >
                              <span>Manage</span>
                              <ArrowUpRight size={12} className="text-slate-400" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================= STUDENTS / LEARNERS TAB ================= */
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Search students by name, email, or course..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="text-xs text-slate-500 font-semibold px-2">
              Showing <strong className="text-slate-900">{filteredLearners.length}</strong> enrolled students
            </div>
          </div>

          {/* Students Table */}
          {filteredLearners.length === 0 ? (
            <div className="py-20 text-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Users size={24} />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="font-bold text-slate-900 text-base">No enrolled students found</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {searchStudent
                    ? 'No students match your search criteria. Try a different query.'
                    : 'When students enroll in your published courses, their roster and progress will appear here.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-5">Student</th>
                      <th className="py-3.5 px-5">Course Enrolled</th>
                      <th className="py-3.5 px-5">Enrolled Date</th>
                      <th className="py-3.5 px-5">Learning Progress</th>
                      <th className="py-3.5 px-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLearners.map((lrn, idx) => {
                      const studentName = [lrn.firstName, lrn.lastName].filter(Boolean).join(' ') || 'Student Learner';
                      const initials = (lrn.firstName?.[0] || 'S') + (lrn.lastName?.[0] || '');
                      const progress = Number(lrn.progressPercent || 0);

                      return (
                        <tr key={lrn.enrollmentId || `${lrn.studentId}-${idx}`} className="hover:bg-slate-50/60 transition">
                          {/* Student */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100/70 text-teal-800 font-bold uppercase text-xs">
                                {initials.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 line-clamp-1">{studentName}</p>
                                <p className="text-[11px] text-slate-500 font-mono line-clamp-1">{lrn.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Course */}
                          <td className="py-3.5 px-5 max-w-xs">
                            <span className="font-semibold text-slate-800 line-clamp-1">
                              {lrn.courseTitle || 'Course Access'}
                            </span>
                            {lrn.courseSlug && (
                              <span className="text-[10px] text-slate-400 font-mono block">/{lrn.courseSlug}</span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-5 text-slate-600 whitespace-nowrap">
                            {formatDate(lrn.enrolledAt)}
                          </td>

                          {/* Progress */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-teal-600 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                                />
                              </div>
                              <span className="font-bold text-[11px] text-slate-700">{progress}%</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                lrn.status === 'cancelled'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : lrn.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-teal-50 text-teal-700 border border-teal-200'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  lrn.status === 'cancelled'
                                    ? 'bg-rose-600'
                                    : lrn.status === 'completed'
                                    ? 'bg-emerald-600'
                                    : 'bg-teal-600'
                                }`}
                              />
                              {lrn.status === 'cancelled' ? 'Refunded' : lrn.status || 'active'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
