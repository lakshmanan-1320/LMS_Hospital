'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Video,
  Plus,
  Calendar,
  Clock,
  Users,
  Search,
  Filter,
  ExternalLink,
  ChevronRight,
  Radio,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  Shield,
  Layers,
  ChevronLeft
} from 'lucide-react';
import { useWebinarStore } from '@/modules/webinars/stores/useWebinarStore';
import { useAuthStore } from '@/app/login/stores/useAuthStore';

export default function WebinarsManagementPage() {
  const params = useParams();
  const router = useRouter();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const role = rawRole?.toLowerCase() || 'admin';

  const { user } = useAuthStore();
  const {
    adminWebinars,
    fetchAdminWebinars,
    isLoading,
    error,
    filters,
  } = useWebinarStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Role Protection: Only ADMIN accounts can manage platform webinars
  useEffect(() => {
    if (role === 'instructor') {
      router.replace('/dashboard/instructor/courses');
    } else if (role === 'super-admin') {
      router.replace('/dashboard/super-admin');
    }
  }, [role, router]);

  // Load webinars on filter or page change
  const loadWebinars = useCallback(() => {
    const params = {
      page: currentPage,
      limit: 15,
    };
    if (searchQuery?.trim()) params.search = searchQuery.trim();
    if (statusFilter?.trim()) params.status = statusFilter.trim();

    fetchAdminWebinars(params).catch((err) => console.error('Failed to load webinars:', err));
  }, [fetchAdminWebinars, searchQuery, statusFilter, currentPage]);

  useEffect(() => {
    loadWebinars();
  }, [loadWebinars]);

  // Handle Search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadWebinars();
  };

  // Helper date formatter
  const formatDateTime = (dateStr) => {
    if (!dateStr) return { date: '—', time: '—' };
    try {
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        time: d.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    } catch {
      return { date: dateStr, time: '' };
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'live':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
            LIVE NOW
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Calendar className="w-3 h-3" />
            Scheduled
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 className="w-3 h-3 text-slate-500" />
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <XCircle className="w-3 h-3 text-amber-500" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {status || 'Draft'}
          </span>
        );
    }
  };

  // Metrics summary
  const stats = useMemo(() => {
    const items = adminWebinars.items || [];
    return {
      total: adminWebinars.total || items.length,
      scheduled: items.filter((w) => w.status === 'scheduled').length,
      live: items.filter((w) => w.status === 'live').length,
      completed: items.filter((w) => w.status === 'completed').length,
    };
  }, [adminWebinars]);

  if (role === 'super-admin' || role === 'instructor') return null;

  return (
    <div className="space-y-6 w-full px-4 sm:px-6 py-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {role === 'instructor' ? 'My Live Sessions' : 'Webinars & Live Events'}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {role === 'instructor'
                  ? 'Manage sessions you host, join live rooms, and interact with attendees.'
                  : 'Schedule webinars, manage public landing pages, and track campaign traffic attribution.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Public Catalog Link */}
          <Link
            href="/webinars"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <span>Public Catalog</span>
            <ExternalLink className="w-4 h-4 text-slate-400" />
          </Link>

          {/* Schedule Webinar Button (Admin Only) */}
          {role === 'admin' && (
            <Link
              href={`/dashboard/${role}/webinars/create`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Webinar</span>
            </Link>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Events</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Scheduled</span>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{stats.scheduled}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600 uppercase tracking-wider">Live Broadcasts</span>
            <Radio className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-700 mt-2">{stats.live}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-700 mt-2">{stats.completed}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by webinar title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="live">Live Now</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('');
              setCurrentPage(1);
              loadWebinars();
            }}
            className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            title="Reset Filters"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Webinars Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">Loading webinars...</p>
          </div>
        ) : error ? (
          <div className="py-12 px-4 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-sm text-rose-600 font-medium">{error}</p>
            <button
              onClick={loadWebinars}
              className="mt-3 text-xs font-semibold text-indigo-600 hover:underline"
            >
              Try Again
            </button>
          </div>
        ) : adminWebinars.items?.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No webinars found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
              {searchQuery || statusFilter
                ? 'No webinars match your current filter criteria.'
                : 'Get started by scheduling your first public webinar event.'}
            </p>
            {role === 'admin' && !searchQuery && !statusFilter && (
              <Link
                href={`/dashboard/${role}/webinars/create`}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule Now</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Webinar / Slug</th>
                  <th className="px-5 py-3.5">Schedule</th>
                  <th className="px-5 py-3.5">Host</th>
                  <th className="px-5 py-3.5">Capacity</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adminWebinars.items.map((webinar) => {
                  const { date, time } = formatDateTime(webinar.start_time);
                  const isHost = webinar.hosts?.some((h) => h.user_id === user?.userId);

                  return (
                    <tr
                      key={webinar.webinar_id}
                      className="hover:bg-slate-50/80 transition group"
                    >
                      {/* Title & Vanity Slug */}
                      <td className="px-5 py-4">
                        <div className="max-w-md">
                          <Link
                            href={`/dashboard/${role}/webinars/${webinar.slug}`}
                            className="font-semibold text-slate-900 group-hover:text-indigo-600 transition block truncate"
                          >
                            {webinar.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400 font-mono">
                              /{webinar.slug}
                            </span>
                            {webinar.is_public_registration && (
                              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                Public
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Schedule */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-900 font-medium">{date}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>
                            {time} ({webinar.timezone || 'UTC'})
                          </span>
                        </div>
                      </td>

                      {/* Primary Host */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-medium">
                          {webinar.primary_host_name || 'Assigned Host'}
                        </div>
                      </td>

                      {/* Registrations & Capacity */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span className="font-semibold text-slate-800">
                            {webinar.total_registrations || 0}
                          </span>
                          <span className="text-slate-400 text-xs">
                            / {webinar.max_participants || 100}
                          </span>
                        </div>
                        {/* Capacity progress bar */}
                        <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (webinar.total_registrations || 0) >= (webinar.max_participants || 100)
                                ? 'bg-amber-500'
                                : 'bg-indigo-600'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                ((webinar.total_registrations || 0) /
                                  (webinar.max_participants || 100)) *
                                  100
                              )}%`,
                            }}
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {renderStatusBadge(webinar.status)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* Live Host Join Action */}
                          {(role === 'admin' || isHost) && (
                            <Link
                              href={`/dashboard/${role}/webinars/${webinar.slug}`}
                              className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition inline-flex items-center gap-1"
                            >
                              <span>Manage Hub</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          )}

                          {/* Public Landing Link */}
                          <Link
                            href={`/webinars/${webinar.slug}`}
                            target="_blank"
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                            title="Open Public Registration Page"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {adminWebinars.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
            <div>
              Showing page <span className="font-semibold text-slate-800">{adminWebinars.page}</span> of{' '}
              <span className="font-semibold text-slate-800">{adminWebinars.totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage >= adminWebinars.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(adminWebinars.totalPages, p + 1))}
                className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
