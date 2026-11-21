'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  UserPlus,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  XCircle,
  Eye,
  X,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Calendar,
  Layers,
} from 'lucide-react';
import { enrollmentService } from '@/modules/enrollments/services/enrollment.service';

const STATUS_BADGES = {
  active: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Active',
  },
  completed: {
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    label: 'Completed',
  },
  suspended: {
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Suspended',
  },
  cancelled: {
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    label: 'Cancelled',
  },
};

function AdminEnrollmentsPageContent() {
  const params = useParams();
  const role = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const isAdmin = role === 'admin';

  // Stats state
  const [stats, setStats] = useState({
    totalEnrollments: 0,
    activeEnrollments: 0,
    completedEnrollments: 0,
    suspendedEnrollments: 0,
    cancelledEnrollments: 0,
  });

  // Table state
  const [enrollments, setEnrollments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [coursesList, setCoursesList] = useState([]);

  // Manual Enroll Modal
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [studentsDropdown, setStudentsDropdown] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollModalError, setEnrollModalError] = useState('');

  // Details Modal
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(null);
  const [detailsData, setDetailsData] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Status Action Modals
  const [statusModalEnrollment, setStatusModalEnrollment] = useState(null);
  const [targetStatus, setTargetStatus] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusModalError, setStatusModalError] = useState('');

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const res = await enrollmentService.getStats();
      if (res?.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load enrollment stats:', err);
    }
  }, []);

  // Load courses for filter dropdown
  const loadCoursesDropdown = useCallback(async () => {
    try {
      const res = await enrollmentService.getCourses();
      if (Array.isArray(res)) {
        setCoursesList(res);
      }
    } catch (err) {
      console.error('Failed to load courses for filter:', err);
    }
  }, []);

  // Load enrollments list
  const loadEnrollments = useCallback(
    async (currentPage = page) => {
      try {
        setLoading(true);
        setError('');
        const res = await enrollmentService.getEnrollments({
          page: currentPage,
          limit,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          courseId: courseFilter || undefined,
        });

        setEnrollments(res?.items || []);
        setTotal(res?.total || 0);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load enrollments.');
      } finally {
        setLoading(false);
      }
    },
    [page, limit, search, statusFilter, courseFilter]
  );

  // Initial load
  useEffect(() => {
    if (isAdmin) {
      loadStats();
      loadCoursesDropdown();
    }
  }, [isAdmin, loadStats, loadCoursesDropdown]);

  // Refetch on filters change
  useEffect(() => {
    if (isAdmin) {
      loadEnrollments(1);
      setPage(1);
    }
  }, [search, statusFilter, courseFilter, loadEnrollments, isAdmin]);

  // Load students for manual enroll modal
  const loadStudents = useCallback(async (query = '') => {
    try {
      const res = await enrollmentService.getStudents(query);
      setStudentsDropdown(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  }, []);

  const handleOpenEnrollModal = () => {
    setIsEnrollModalOpen(true);
    setSelectedStudentId('');
    setSelectedCourseId('');
    setStudentSearch('');
    setEnrollModalError('');
    loadStudents('');
  };

  const handleManualEnrollSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedCourseId) {
      setEnrollModalError('Please select both a student and a published course.');
      return;
    }

    try {
      setEnrolling(true);
      setEnrollModalError('');
      await enrollmentService.manualEnroll(selectedStudentId, selectedCourseId);
      setIsEnrollModalOpen(false);
      showSuccess('Student enrolled successfully.');
      loadStats();
      loadEnrollments(1);
    } catch (err) {
      setEnrollModalError(
        err.response?.data?.message || err.message || 'Failed to manually enroll student.'
      );
    } finally {
      setEnrolling(false);
    }
  };

  // Open Details Modal
  const handleOpenDetails = async (enrollmentId) => {
    setSelectedEnrollmentId(enrollmentId);
    setDetailsLoading(true);
    setDetailsData(null);
    try {
      const res = await enrollmentService.getDetails(enrollmentId);
      setDetailsData(res);
    } catch (err) {
      console.error('Failed to load enrollment details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Open Status Change Modal (Suspend, Reactivate, Cancel)
  const handleOpenStatusModal = (enrollment, nextStatus) => {
    setStatusModalEnrollment(enrollment);
    setTargetStatus(nextStatus);
    setCancellationReason('');
    setStatusModalError('');
  };

  const handleStatusChangeSubmit = async (e) => {
    e.preventDefault();
    if (!statusModalEnrollment) return;

    if (targetStatus === 'cancelled' && cancellationReason.trim().length < 5) {
      setStatusModalError('Cancellation reason must be at least 5 characters.');
      return;
    }

    try {
      setStatusSubmitting(true);
      setStatusModalError('');
      await enrollmentService.updateStatus(
        statusModalEnrollment.enrollmentId,
        targetStatus,
        targetStatus === 'cancelled' ? cancellationReason.trim() : null
      );

      setStatusModalEnrollment(null);
      showSuccess(
        `Enrollment successfully changed to ${targetStatus}.`
      );
      loadStats();
      loadEnrollments(page);
    } catch (err) {
      setStatusModalError(
        err.response?.data?.message || err.message || 'Failed to update enrollment status.'
      );
    } finally {
      setStatusSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert size={48} className="text-rose-500 mb-3" />
        <h2 className="text-xl font-bold text-ink">Access Restricted</h2>
        <p className="text-sm text-muted mt-1">
          Only platform administrators have access to Enrollment Management.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink mt-0.5">
            Enrollment Management
          </h1>
          <p className="text-xs text-muted mt-1">
            Manage course enrollments, track learning progression, and oversee student access across all courses.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              loadStats();
              loadEnrollments(page);
            }}
            disabled={loading}
            className="p-2 border border-line rounded-xl text-muted hover:text-ink hover:bg-cream transition-colors"
            title="Refresh list"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleOpenEnrollModal}
            className="px-4 py-2.5 bg-teal text-white hover:bg-teal-dark rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <UserPlus size={16} />
            <span>Manual Enroll Student</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-700">
            <X size={15} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-emerald-800">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-paper border border-line rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">Total Enrollments</span>
            <Users size={16} className="text-teal" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-ink">
            {stats.totalEnrollments}
          </div>
        </div>

        <div className="bg-paper border border-line rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">Active</span>
            <PlayCircle size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-emerald-600">
            {stats.activeEnrollments}
          </div>
        </div>

        <div className="bg-paper border border-line rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700">Completed</span>
            <CheckCircle2 size={16} className="text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-blue-600">
            {stats.completedEnrollments}
          </div>
        </div>

        <div className="bg-paper border border-line rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">Suspended</span>
            <PauseCircle size={16} className="text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-amber-600">
            {stats.suspendedEnrollments}
          </div>
        </div>

        <div className="bg-paper border border-line rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700">Cancelled</span>
            <XCircle size={16} className="text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-rose-600">
            {stats.cancelledEnrollments}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-paper border border-line rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search student, email, or course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-line bg-cream/40 focus:bg-paper focus:border-teal outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-line bg-paper text-ink outline-none focus:border-teal cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Course Filter */}
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-line bg-paper text-ink outline-none focus:border-teal max-w-[220px] truncate cursor-pointer"
          >
            <option value="">All Courses</option>
            {coursesList.map((c) => (
              <option key={c.course_id} value={c.course_id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Enrollments Table */}
      <div className="bg-paper border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-line bg-cream/50 text-[11px] font-bold text-muted uppercase tracking-wider">
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">Course</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Progress</th>
                <th className="py-3.5 px-4">Enrolled Date</th>
                <th className="py-3.5 px-4">Last Activity</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted">
                    <Loader2 size={24} className="animate-spin text-teal mx-auto mb-2" />
                    <span className="text-xs font-semibold">Loading enrollments...</span>
                  </td>
                </tr>
              ) : enrollments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted">
                    <GraduationCap size={32} className="mx-auto text-muted/40 mb-2" />
                    <p className="text-sm font-semibold text-ink">No enrollments found</p>
                    <p className="text-xs text-muted mt-0.5">
                      {search || statusFilter || courseFilter
                        ? 'Try clearing or modifying your filter criteria.'
                        : 'Students who enroll in published courses will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                enrollments.map((item) => {
                  const statusCfg = STATUS_BADGES[item.enrollmentStatus] || STATUS_BADGES.active;
                  const progressPct = Number(item.completionPercentage) || 0;
                  const completedLessons = Number(item.completedLessonsCount) || 0;
                  const totalLessons = Number(item.totalLessonsCount) || 0;

                  return (
                    <tr key={item.enrollmentId} className="hover:bg-cream/40 transition-colors">
                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-teal/10 text-teal flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {item.studentFirstName?.[0] || 'S'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-ink text-xs truncate">
                              {item.studentFirstName} {item.studentLastName || ''}
                            </p>
                            <p className="text-[11px] text-muted truncate">{item.studentEmail}</p>
                          </div>
                        </div>
                      </td>

                      {/* Course Info */}
                      <td className="py-3.5 px-4">
                        <div className="min-w-0 max-w-xs">
                          <p className="font-bold text-ink text-xs truncate" title={item.courseTitle}>
                            {item.courseTitle}
                          </p>
                          <p className="text-[11px] text-muted truncate">
                            {item.instructorName ? `By ${item.instructorName}` : 'No instructor assigned'}
                          </p>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                          {statusCfg.label}
                        </span>
                        {item.enrollmentType === 'manual' && (
                          <span className="block text-[10px] text-teal font-semibold mt-0.5">
                            (Manual Enroll)
                          </span>
                        )}
                      </td>

                      {/* Progress Bar */}
                      <td className="py-3.5 px-4">
                        <div className="w-32">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-muted mb-1">
                            <span>{progressPct}%</span>
                            <span>
                              {completedLessons}/{totalLessons}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-cream rounded-full overflow-hidden border border-line/60">
                            <div
                              className="h-full bg-teal rounded-full transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Enrolled Date */}
                      <td className="py-3.5 px-4 text-xs text-muted font-medium whitespace-nowrap">
                        {item.enrolledAt
                          ? new Date(item.enrolledAt).toLocaleDateString()
                          : '—'}
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-4 text-xs text-muted whitespace-nowrap">
                        {item.lastActivityAt
                          ? new Date(item.lastActivityAt).toLocaleString(undefined, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : 'Never'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(item.enrollmentId)}
                            className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-cream transition-colors"
                            title="View enrollment details & syllabus progress"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Action by current status */}
                          {item.enrollmentStatus === 'active' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenStatusModal(item, 'suspended')}
                                className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold border border-amber-200 transition-colors"
                                title="Suspend student course access"
                              >
                                Suspend
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenStatusModal(item, 'cancelled')}
                                className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold border border-rose-200 transition-colors"
                                title="Cancel student enrollment"
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {item.enrollmentStatus === 'suspended' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenStatusModal(item, 'active')}
                                className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors"
                                title="Reactivate suspended enrollment"
                              >
                                Reactivate
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenStatusModal(item, 'cancelled')}
                                className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold border border-rose-200 transition-colors"
                                title="Cancel student enrollment"
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {item.enrollmentStatus === 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleOpenStatusModal(item, 'active')}
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors"
                              title="Reactivate cancelled enrollment"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {total > limit && (
          <div className="p-4 border-t border-line flex items-center justify-between text-xs text-muted">
            <span>
              Showing {Math.min((page - 1) * limit + 1, total)} -{' '}
              {Math.min(page * limit, total)} of {total} enrollments
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  const newPage = page - 1;
                  setPage(newPage);
                  loadEnrollments(newPage);
                }}
                className="p-1.5 rounded-lg border border-line hover:bg-cream disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={15} />
              </button>

              <span className="font-semibold text-ink px-2">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  const newPage = page + 1;
                  setPage(newPage);
                  loadEnrollments(newPage);
                }}
                className="p-1.5 rounded-lg border border-line hover:bg-cream disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: MANUAL ENROLL STUDENT MODAL                     */}
      {/* ======================================================== */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-xs">
          <div className="my-auto w-full max-w-lg rounded-2xl bg-paper p-6 border border-line shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-teal" />
                <h3 className="font-heading font-bold text-base text-ink">
                  Manual Student Enrollment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEnrollModalOpen(false)}
                className="text-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            {enrollModalError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-500" />
                <span>{enrollModalError}</span>
              </div>
            )}

            <form onSubmit={handleManualEnrollSubmit} className="space-y-4">
              {/* Select Student */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Select Student *
                </label>
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Search student by name or email..."
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      loadStudents(e.target.value);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-cream/30 focus:bg-paper focus:border-teal outline-none"
                  />
                </div>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-line bg-paper text-ink outline-none focus:border-teal"
                >
                  <option value="">-- Choose a student ({studentsDropdown.length} available) --</option>
                  {studentsDropdown.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.first_name} {s.last_name || ''} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Published Course */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Select Published Course *
                </label>
                <select
                  required
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-line bg-paper text-ink outline-none focus:border-teal"
                >
                  <option value="">-- Choose a course ({coursesList.length} published) --</option>
                  {coursesList.map((c) => (
                    <option key={c.course_id} value={c.course_id}>
                      {c.title} {c.instructor_name ? `(Instructor: ${c.instructor_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl bg-teal/5 border border-teal/20 p-3 text-[11px] text-teal-dark space-y-1">
                <p className="font-semibold">Important Notes:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Enrolling creates immediate active access for the student.</li>
                  <li>If the student previously had a suspended or cancelled enrollment for this course, it will be reactivated while preserving their prior learning progress.</li>
                  <li>Active enrollments cannot be duplicated.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink rounded-xl border border-line hover:bg-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrolling}
                  className="px-5 py-2 text-xs font-bold bg-teal text-white hover:bg-teal-dark rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {enrolling && <Loader2 size={13} className="animate-spin" />}
                  <span>{enrolling ? 'Enrolling...' : 'Enroll Student'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: STATUS CHANGE (SUSPEND / REACTIVATE / CANCEL)   */}
      {/* ======================================================== */}
      {statusModalEnrollment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-xs">
          <div className="my-auto w-full max-w-md rounded-2xl bg-paper p-6 border border-line shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <div className="flex items-center gap-2">
                {targetStatus === 'suspended' && <PauseCircle size={18} className="text-amber-600" />}
                {targetStatus === 'active' && <PlayCircle size={18} className="text-emerald-600" />}
                {targetStatus === 'cancelled' && <XCircle size={18} className="text-rose-600" />}
                <h3 className="font-heading font-bold text-base text-ink capitalize">
                  {targetStatus === 'active' ? 'Reactivate Enrollment' : `${targetStatus} Enrollment`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalEnrollment(null)}
                className="text-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            {statusModalError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-500" />
                <span>{statusModalError}</span>
              </div>
            )}

            <form onSubmit={handleStatusChangeSubmit} className="space-y-4">
              <div className="text-xs text-ink space-y-1">
                <p>
                  <strong>Student:</strong> {statusModalEnrollment.studentFirstName} {statusModalEnrollment.studentLastName || ''} ({statusModalEnrollment.studentEmail})
                </p>
                <p>
                  <strong>Course:</strong> {statusModalEnrollment.courseTitle}
                </p>
                <p>
                  <strong>Current Status:</strong>{' '}
                  <span className="capitalize font-bold">{statusModalEnrollment.enrollmentStatus}</span>
                </p>
              </div>

              {targetStatus === 'suspended' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  <p className="font-semibold mb-1">Notice on Suspension:</p>
                  <p>
                    Suspending this enrollment immediately revokes the student's streaming and learning access for this course. Their lesson progress history remains safely preserved and will restore upon reactivation.
                  </p>
                </div>
              )}

              {targetStatus === 'cancelled' && (
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">
                    Cancellation Reason * (min 5 characters)
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter reason for cancelling enrollment (e.g. Refund issued, Student request, Policy violation)..."
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl border border-line bg-paper text-ink outline-none focus:border-rose-500"
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Student access will be blocked immediately. Their previous progress is archived.
                  </p>
                </div>
              )}

              {targetStatus === 'active' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
                  <p>
                    Reactivating this enrollment restores student access immediately. Prior learning progress will be retained intact.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusModalEnrollment(null)}
                  className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink rounded-xl border border-line hover:bg-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusSubmitting}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-sm ${
                    targetStatus === 'cancelled'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : targetStatus === 'suspended'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {statusSubmitting && <Loader2 size={13} className="animate-spin" />}
                  <span className="capitalize">Confirm {targetStatus}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: ENROLLMENT DETAILS & PROGRESS BREAKDOWN MODAL   */}
      {/* ======================================================== */}
      {selectedEnrollmentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-xs">
          <div className="my-auto w-full max-w-2xl rounded-2xl bg-paper p-6 border border-line shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <div className="flex items-center gap-2">
                <GraduationCap size={20} className="text-teal" />
                <h3 className="font-heading font-bold text-base text-ink">
                  Enrollment & Learning Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEnrollmentId(null)}
                className="text-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            {detailsLoading || !detailsData ? (
              <div className="py-16 text-center text-muted">
                <Loader2 size={24} className="animate-spin text-teal mx-auto mb-2" />
                <p className="text-xs font-semibold">Loading enrollment details...</p>
              </div>
            ) : (
              <div className="space-y-5 text-xs">
                {/* Summary Grid */}
                <div className="grid grid-cols-2 gap-3 bg-cream/40 p-4 rounded-xl border border-line/60">
                  <div>
                    <span className="text-muted block text-[11px]">Student</span>
                    <strong className="text-ink text-sm">
                      {detailsData.enrollment?.studentName || `${detailsData.enrollment?.studentFirstName || ''} ${detailsData.enrollment?.studentLastName || ''}`.trim()}
                    </strong>
                    <span className="text-muted block">{detailsData.enrollment?.studentEmail}</span>
                  </div>

                  <div>
                    <span className="text-muted block text-[11px]">Course</span>
                    <strong className="text-ink text-sm">
                      {detailsData.enrollment?.courseTitle}
                    </strong>
                    <span className="text-muted block">
                      Instructor: {detailsData.enrollment?.instructorName || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted block text-[11px]">Status</span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border mt-0.5 ${
                        STATUS_BADGES[detailsData.enrollment?.enrollmentStatus]?.bg || ''
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          STATUS_BADGES[detailsData.enrollment?.enrollmentStatus]?.dot || ''
                        }`}
                      />
                      {detailsData.enrollment?.enrollmentStatus?.toUpperCase()}
                    </span>
                    {detailsData.enrollment?.cancellationReason && (
                      <p className="text-rose-700 text-[11px] mt-1 italic">
                        Reason: "{detailsData.enrollment.cancellationReason}"
                      </p>
                    )}
                  </div>

                  <div>
                    <span className="text-muted block text-[11px]">Enrollment Info</span>
                    <p className="text-ink">
                      Type: <strong>{detailsData.enrollment?.enrollmentType}</strong>
                    </p>
                    <p className="text-muted">
                      Date:{' '}
                      {detailsData.enrollment?.enrolledAt
                        ? new Date(detailsData.enrollment.enrolledAt).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                </div>

                {/* Progress Stats */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-ink">Overall Course Progress</span>
                    <span className="font-bold text-teal">
                      {detailsData.completionPercentage || 0}% ({detailsData.completedLessonsCount || 0} of {detailsData.totalLessons || 0} lessons completed)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-cream rounded-full overflow-hidden border border-line/60">
                    <div
                      className="h-full bg-teal rounded-full"
                      style={{
                        width: `${detailsData.completionPercentage || 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Lesson-by-lesson breakdown */}
                <div>
                  <h4 className="font-bold text-ink mb-2">Lesson Breakdown</h4>
                  <div className="border border-line rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-cream/50 text-[10px] font-bold text-muted uppercase border-b border-line">
                          <th className="py-2 px-3">Lesson</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Duration</th>
                          <th className="py-2 px-3 text-right">Completed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/60">
                        {detailsData.lessons && detailsData.lessons.length > 0 ? (
                          detailsData.lessons.map((lesson, idx) => (
                            <tr key={lesson.lessonId} className="hover:bg-cream/20">
                              <td className="py-2 px-3 font-medium text-ink">
                                {idx + 1}. {lesson.title}
                              </td>
                              <td className="py-2 px-3 text-muted capitalize text-[11px]">
                                {lesson.lessonType}
                              </td>
                              <td className="py-2 px-3 text-muted text-[11px]">
                                {lesson.durationSeconds
                                  ? `${Math.ceil(lesson.durationSeconds / 60)} min`
                                  : '—'}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {lesson.isCompleted ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                    <CheckCircle2 size={13} /> Completed
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-muted">Incomplete</span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-muted text-[11px]">
                              No lessons found for this course.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setSelectedEnrollmentId(null)}
                    className="px-4 py-2 text-xs font-bold text-ink rounded-xl border border-line hover:bg-cream"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminEnrollmentsPage() {
  const params = useParams();
  const router = useRouter();
  const rawRole = Array.isArray(params?.role) ? params.role[0] : params?.role;

  useEffect(() => {
    // Enrollments are an Admin operation; Super Admin is governance-only
    if (rawRole === 'super-admin') {
      router.replace('/dashboard/super-admin');
    }
  }, [rawRole, router]);

  if (rawRole === 'super-admin') {
    return null;
  }

  return <AdminEnrollmentsPageContent />;
}
