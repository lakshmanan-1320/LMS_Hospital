'use client';

import { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  RotateCw,
  LayoutGrid,
  List,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Globe,
} from 'lucide-react';
import { useCourseStore } from '../stores/useCourseStore';
import { useCourseApprovalStore } from '../stores/useCourseApprovalStore';
import CourseCard from './CourseCard';
import CourseTableView from './CourseTableView';
import CourseCreateModal from './CourseCreateModal';
import CourseDeleteModal from './CourseDeleteModal';
import CourseChecklistModal from './CourseChecklistModal';
import CourseLanguageSettingsModal from './CourseLanguageSettingsModal';
import CourseReviewModal from './CourseReviewModal';
import CourseRejectModal from './CourseRejectModal';
import CourseHistoryModal from './CourseHistoryModal';

export default function CourseManagementView({ role = 'instructor' }) {
  const {
    courses,
    total,
    stats,
    isLoading,
    error,
    successMessage,
    search,
    statusFilter,
    sortBy,
    sortOrder,
    viewMode,
    fetchCourses,
    fetchStats,
    setSearch,
    setStatusFilter,
    setSortBy,
    setSortOrder,
    setViewMode,
    openCreateModal,
    clearAlerts,
  } = useCourseStore();

  const { stats: approvalStats, fetchStats: fetchApprovalStats } = useCourseApprovalStore();
  const isAdmin = role === 'admin' || role === 'super-admin';

  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  useEffect(() => {
    fetchCourses(role);
    if (role === 'instructor') {
      fetchStats();
    } else if (isAdmin) {
      fetchApprovalStats();
    }
  }, [role, fetchCourses, fetchStats, fetchApprovalStats, isAdmin]);

  const handleRefresh = () => {
    fetchCourses(role);
    if (role === 'instructor') {
      fetchStats();
    } else if (isAdmin) {
      fetchApprovalStats();
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-ink">
            Course Management
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Author, structure syllabus, track approval readiness, and publish engaging student courses.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          {role === 'admin' && (
            <button
              type="button"
              onClick={() => setIsLanguageModalOpen(true)}
              className="px-3.5 py-2.5 bg-paper border border-line hover:border-teal/50 hover:bg-cream/60 text-ink rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Globe size={15} className="text-teal" />
              <span>Languages</span>
            </button>
          )}

          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-teal hover:bg-teal-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            <span>New Course</span>
          </button>
        </div>
      </div>

      {/* Metrics Row (4 Quick Stats) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-paper border border-line rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Courses</span>
            <BookOpen size={16} className="text-teal" />
          </div>
          <div className="text-2xl font-heading font-bold text-ink">
            {(isAdmin ? approvalStats.total : stats.total) || courses.length || 0}
          </div>
          <span className="text-[10px] text-muted block mt-0.5">Across all lifecycle stages</span>
        </div>

        <div className="bg-paper border border-line rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {isAdmin ? 'Draft Courses' : 'Active Drafts'}
            </span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-heading font-bold text-ink">
            {isAdmin ? (approvalStats.draft || 0) : (stats.draft || 0)}
          </div>
          <span className="text-[10px] text-muted block mt-0.5">
            {isAdmin ? 'Unpublished work in progress' : 'Editable work-in-progress'}
          </span>
        </div>

        <div className="bg-paper border border-line rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Review</span>
            <Sparkles size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-heading font-bold text-ink flex items-center gap-2">
            <span>{isAdmin ? (approvalStats.pending_review || 0) : (stats.pending_review || 0)}</span>
            {isAdmin && (approvalStats.pending_review || 0) > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <span className="text-[10px] text-muted block mt-0.5">Under platform review</span>
        </div>

        <div className="bg-paper border border-line rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Live / Published</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-heading font-bold text-ink">
            {isAdmin ? (approvalStats.published || 0) : (stats.published || 0)}
          </div>
          <span className="text-[10px] text-muted block mt-0.5">Enrolled by students</span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={clearAlerts}
            className="text-muted hover:text-ink font-bold"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={clearAlerts}
            className="text-muted hover:text-ink font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-paper border border-line rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              fetchCourses(role, { search: e.target.value, page: 1 });
            }}
            className="w-full pl-9 pr-3.5 py-2 bg-cream/50 border border-line rounded-lg text-xs sm:text-sm text-ink outline-none focus:border-teal focus:ring-1 focus:ring-teal/30 transition-all placeholder:text-muted/70"
          />
        </div>

        {/* Filters & View Toggles */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end overflow-x-auto pb-1 md:pb-0">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              fetchCourses(role, { statusFilter: e.target.value, page: 1 });
            }}
            className="px-3 py-2 bg-paper border border-line rounded-lg text-xs font-semibold text-ink outline-none focus:border-teal cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Changes Requested</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>

          {/* Sort Selector */}
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [col, dir] = e.target.value.split(':');
              setSortBy(col);
              setSortOrder(dir);
              fetchCourses(role, { sortBy: col, sortOrder: dir, page: 1 });
            }}
            className="px-3 py-2 bg-paper border border-line rounded-lg text-xs font-semibold text-ink outline-none focus:border-teal cursor-pointer"
          >
            <option value="created_at:DESC">Newest First</option>
            <option value="created_at:ASC">Oldest First</option>
            <option value="title:ASC">Title (A-Z)</option>
            <option value="price:DESC">Price (High-Low)</option>
            <option value="price:ASC">Price (Low-High)</option>
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 border border-line rounded-lg text-muted hover:text-ink hover:bg-cream transition-colors cursor-pointer"
            title="Refresh courses"
          >
            <RotateCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {/* Grid / Table Toggle */}
          <div className="flex items-center border border-line rounded-lg overflow-hidden bg-cream/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-paper text-teal shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-paper text-teal shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
              title="Table View"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Course Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-paper border border-line rounded-2xl p-5 h-72 animate-pulse flex flex-col justify-between"
            >
              <div className="w-full h-36 bg-cream rounded-xl mb-3" />
              <div className="w-2/3 h-4 bg-cream rounded mb-2" />
              <div className="w-1/2 h-3 bg-cream rounded" />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-paper border border-line border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-cream border border-line flex items-center justify-center text-teal mb-4">
            <BookOpen size={28} />
          </div>
          <h3 className="font-heading text-lg font-bold text-ink mb-1">
            No Courses Found
          </h3>
          <p className="text-xs sm:text-sm text-muted max-w-sm mb-5">
            {search || statusFilter !== 'all'
              ? 'No courses match your active search and filter criteria.'
              : 'You have not created any courses yet. Start drafting your first academic course.'}
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-teal hover:bg-teal-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            <span>Create First Course</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <CourseCard
              key={course.courseId || course.course_id}
              course={course}
              role={role}
            />
          ))}
        </div>
      ) : (
        <CourseTableView courses={courses} role={role} />
      )}

      {/* Modals */}
      <CourseCreateModal role={role} />
      <CourseDeleteModal role={role} />
      <CourseChecklistModal />
      {role === 'admin' && (
        <CourseLanguageSettingsModal
          isOpen={isLanguageModalOpen}
          onClose={() => setIsLanguageModalOpen(false)}
        />
      )}

      {/* Module 7 Course Approval Modals */}
      <CourseReviewModal onSuccess={handleRefresh} />
      <CourseRejectModal onSuccess={handleRefresh} />
      <CourseHistoryModal />
    </div>
  );
}

