'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Layers3,
  Search,
  Calendar,
  Clock,
  Users,
  Video,
  ArrowRight,
  Sparkles,
  Loader2,
  Radio,
} from 'lucide-react';
import { useWebinarStore } from '@/modules/webinars/stores/useWebinarStore';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { usePublicModule } from '@/stores/usePlatformConfigStore';
import { useHeaderAuthState, AccountSkeleton } from '@/components/auth/SessionHint';
import AccountMenu from '@/components/layout/AccountMenu';

export default function PublicWebinarsDirectoryPage() {
  const { isAuthenticated } = useAuthStore();
  const showInstructors = usePublicModule('instructor_profiles');
  const headerAuth = useHeaderAuthState();
  const { publicDirectory, isLoading, fetchPublicWebinars } = useWebinarStore();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPublicWebinars();
  }, [fetchPublicWebinars]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPublicWebinars({ search: searchTerm });
  };

  const formatSchedule = (dateString, timezone = 'UTC') => {
    try {
      const d = new Date(dateString);
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
      return { date: dateString, time: '' };
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f6ff] text-[#191b38]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/60 bg-white/90 px-6 backdrop-blur-md sm:px-12">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
            <Layers3 size={18} />
          </span>
          <span>
            elevate<span className="text-violet-600">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 sm:flex">
          <Link href="/courses" className="hover:text-violet-600 transition-colors">
            Courses
          </Link>
          {showInstructors && (
          <Link href="/instructors" className="hover:text-violet-600 transition-colors">
              Instructors
            </Link>
          )}
          <Link href="/webinars" className="text-violet-600 font-semibold transition-colors">
            Live Webinars
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {headerAuth === 'loading' ? (
            <AccountSkeleton />
          ) : headerAuth === 'user' ? (
            <AccountMenu />
          ) : (
            <Link
              href="/login"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200/60 bg-linear-to-b from-white to-violet-50/50 py-16 px-6 sm:px-12">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-semibold text-violet-700 shadow-xs">
            <Sparkles size={14} className="text-violet-600" />
            <span>Interactive Live Masterclasses & Workshops</span>
          </div>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Learn Live from Industry Experts
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
            Join interactive webinars, real-time code walkthroughs, and live Q&A sessions. Free to register for everyone—no account needed.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="mx-auto mt-8 flex max-w-xl items-center gap-2">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search upcoming webinars by topic, tech, or keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm font-medium text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/10"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-violet-500/20 hover:bg-violet-700 transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Main Webinar Directory Grid */}
      <main className="mx-auto max-w-7xl px-6 py-12 sm:px-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Upcoming Live Sessions</h2>
            <p className="text-sm text-slate-500 mt-1">
              Showing {publicDirectory.items.length} of {publicDirectory.total} scheduled webinars
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <Loader2 size={36} className="animate-spin text-violet-600 mb-3" />
            <p className="text-sm font-medium">Loading scheduled webinars...</p>
          </div>
        ) : publicDirectory.items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
            <Video size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-800">No webinars scheduled right now</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Check back soon or explore our on-demand course library while new live sessions are being announced.
            </p>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 mt-6 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition-colors"
            >
              Explore Courses <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {publicDirectory.items.map((webinar) => {
              const schedule = formatSchedule(webinar.start_time, webinar.timezone);
              const isLive = webinar.status === 'live';

              return (
                <div
                  key={webinar.webinar_id}
                  className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm hover:shadow-xl hover:border-violet-200 transition-all duration-300"
                >
                  <div>
                    {/* Cover Image / Gradient */}
                    <div className="relative h-48 w-full overflow-hidden bg-linear-to-tr from-violet-600 to-indigo-700">
                      {webinar.cover_image_url ? (
                        <img
                          src={webinar.cover_image_url}
                          alt={webinar.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center text-white/80 p-6 text-center">
                          <Video size={42} className="mb-2 text-white/90" />
                          <span className="text-xs uppercase tracking-wider font-bold text-violet-200">
                            Interactive Live Webinar
                          </span>
                        </div>
                      )}

                      {/* Status Badge */}
                      <div className="absolute top-4 left-4">
                        {isLive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white shadow-md animate-pulse">
                            <Radio size={12} /> LIVE NOW
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-medium text-white shadow-xs">
                            <Calendar size={12} /> {schedule.date}
                          </span>
                        )}
                      </div>

                      {/* Capacity badge */}
                      <div className="absolute top-4 right-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-md px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs">
                          <Users size={12} className="text-slate-500" />
                          <span>{webinar.confirmed_registrations_count || 0} registered</span>
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <div className="flex items-center gap-2 text-xs font-semibold text-violet-600 mb-2">
                        <Clock size={13} />
                        <span>{schedule.time} ({webinar.timezone})</span>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-violet-600 transition-colors line-clamp-2">
                        {webinar.title}
                      </h3>

                      <p className="mt-2 text-sm text-slate-600 line-clamp-2 leading-relaxed">
                        {webinar.short_description || webinar.description || 'Join this live session to master practical industry skills and interact directly with experts.'}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer with CTA (Clean Vanity Slug link - NO UUID!) */}
                  <div className="border-t border-slate-100 bg-slate-50/50 p-6 pt-4">
                    <Link
                      href={`/webinars/${webinar.slug}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition-all duration-200"
                    >
                      <span>{isLive ? 'Join Live Room' : 'View Details & Register'}</span>
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

