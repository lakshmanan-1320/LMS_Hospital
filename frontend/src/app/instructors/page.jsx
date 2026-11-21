'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Layers3,
  Search,
  BookOpen,
  ArrowRight,
  ArrowUpRight,
  Award,
  Sparkles,
  Loader2,
  Users,
} from 'lucide-react';
import { instructorService } from '@/modules/instructors/services/instructor.service';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { useHeaderAuthState, AccountSkeleton } from '@/components/auth/SessionHint';
import AccountMenu from '@/components/layout/AccountMenu';

export default function PublicInstructorsDirectoryPage() {
  const { isAuthenticated } = useAuthStore();
  const headerAuth = useHeaderAuthState();
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');

  const loadInstructors = async (search = '', skill = '') => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (skill) params.skill = skill;
      const res = await instructorService.getDirectory(params);
      setInstructors(res?.items || []);
    } catch (err) {
      console.error('Failed to load instructors:', err);
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstructors();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadInstructors(searchTerm, selectedSkill);
  };

  return (
    <div className="min-h-screen bg-[#f7f6ff] text-[#191b38]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/60 bg-white/90 px-6 backdrop-blur-md sm:px-12">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
            <Layers3 size={18} />
          </span>
          <span>elevate<span className="text-violet-600">.</span></span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 sm:flex">
          <Link href="/#courses" className="hover:text-violet-600 transition">Explore Courses</Link>
          <Link href="/instructors" className="text-violet-600 font-semibold">Instructors</Link>
          <Link href="/#about" className="hover:text-violet-600 transition">About</Link>
        </nav>

        <div className="flex items-center gap-4">
          {headerAuth === 'loading' ? (
            <AccountSkeleton />
          ) : headerAuth === 'user' ? (
            <AccountMenu />
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold text-slate-700 hover:text-violet-600">Log in</Link>
              <Link href="/register" className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition">
                Get started <ArrowUpRight size={15} />
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-5xl px-6 pt-12 pb-8 text-center sm:px-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3.5 py-1 text-xs font-semibold text-violet-700 mb-4">
          <Sparkles size={13} />
          <span>Learn from Industry Experts</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-slate-900">
          Meet Our Expert Instructors
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-slate-600">
          Discover world-class educators, cloud architects, and engineers ready to help you master new capabilities.
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <Search size={18} className="ml-3 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by instructor name, topic, or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition"
          >
            Search
          </button>
        </form>
      </section>

      {/* Instructors Grid */}
      <section className="mx-auto max-w-6xl px-6 pb-24 sm:px-12">
        <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 className="text-base font-bold text-slate-800">
            Public Directory ({instructors.length} Verified Instructors)
          </h2>
          {selectedSkill && (
            <button
              onClick={() => { setSelectedSkill(''); loadInstructors(searchTerm, ''); }}
              className="text-xs text-violet-600 hover:underline"
            >
              Clear skill filter ({selectedSkill})
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 size={32} className="animate-spin text-violet-600" />
          </div>
        ) : instructors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <Users size={36} className="mx-auto text-slate-300" />
            <h3 className="mt-3 font-semibold text-slate-700">No public instructors found</h3>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting your search query or check back as more instructors publish their profiles.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {instructors.map((ins) => {
              const initials = `${ins.firstName?.[0] || ''}${ins.lastName?.[0] || ''}`.toUpperCase();
              return (
                <Link
                  key={ins.userId}
                  href={`/instructors/${ins.slug || ins.userId}`}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:-translate-y-1 hover:border-violet-300 hover:shadow-md transition-all duration-200"
                >
                  <div>
                    {/* Avatar & Name */}
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-violet-100 bg-violet-50 text-violet-700 flex items-center justify-center font-bold text-lg shrink-0">
                        {ins.avatarUrl ? (
                          <img
                            src={ins.avatarUrl.startsWith('http') ? ins.avatarUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${ins.avatarUrl}`}
                            alt={`${ins.firstName} ${ins.lastName}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{initials}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 group-hover:text-violet-600 transition">
                          {ins.firstName} {ins.lastName}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                          {ins.headline || 'Instructor & Educator'}
                        </p>
                      </div>
                    </div>

                    {/* Skills pills */}
                    {ins.skills?.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {ins.skills.slice(0, 4).map((skill, idx) => (
                          <span
                            key={idx}
                            className="rounded-md border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                          >
                            {skill}
                          </span>
                        ))}
                        {ins.skills.length > 4 && (
                          <span className="text-[11px] text-slate-400 self-center">
                            +{ins.skills.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer: Courses count & Arrow */}
                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <BookOpen size={14} className="text-violet-600" />
                      {ins.totalCourses} {ins.totalCourses === 1 ? 'course' : 'courses'}
                    </span>
                    <span className="font-semibold text-violet-600 group-hover:translate-x-0.5 transition inline-flex items-center gap-1">
                      View Profile <ArrowRight size={13} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

