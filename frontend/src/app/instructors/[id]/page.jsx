'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Layers3,
  Globe,
  Linkedin,
  Github,
  Twitter,
  Youtube,
  Facebook,
  Award,
  BookOpen,
  ArrowLeft,
  ArrowUpRight,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import { instructorService } from '@/modules/instructors/services/instructor.service';

export default function PublicInstructorDetailPage() {
  const params = useParams();
  const identifier = Array.isArray(params.id) ? params.id[0] : params.id;

  const [instructor, setInstructor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identifier) return;

    async function fetchProfile() {
      try {
        setLoading(true);
        setError(null);
        const data = await instructorService.getPublicProfile(identifier);
        setInstructor(data);

        // If accessed with raw UUID, canonicalize URL in browser to clean vanity slug
        if (data?.slug && identifier !== data.slug && typeof window !== 'undefined') {
          window.history.replaceState(null, '', `/instructors/${data.slug}`);
        }
      } catch (err) {
        setError(err.message || 'Instructor profile is private or does not exist.');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [identifier]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6ff]">
        <Loader2 size={36} className="animate-spin text-violet-600" />
      </div>
    );
  }

  if (error || !instructor) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f6ff] px-6 text-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-xs max-w-md">
          <AlertCircle size={40} className="mx-auto text-amber-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-800">Profile Not Available</h1>
          <p className="mt-2 text-sm text-slate-500">
            {error || 'This instructor profile is set to private or does not exist.'}
          </p>
          <div className="mt-6">
            <Link
              href="/instructors"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
            >
              <ArrowLeft size={16} /> Back to Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const initials = `${instructor.firstName?.[0] || ''}${instructor.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-[#f7f6ff] text-[#191b38]">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/60 bg-white/90 px-6 backdrop-blur-md sm:px-12">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
            <Layers3 size={18} />
          </span>
          <span>elevate<span className="text-violet-600">.</span></span>
        </Link>

        <nav className="flex items-center gap-4 text-sm font-semibold">
          <Link href="/instructors" className="inline-flex items-center gap-1.5 text-slate-600 hover:text-violet-600 transition">
            <ArrowLeft size={16} /> All Instructors
          </Link>
          <Link href="/login" className="rounded-xl border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50 transition">
            Log in
          </Link>
        </nav>
      </header>

      {/* Main Profile View */}
      <main className="mx-auto max-w-5xl px-6 py-12 sm:px-12">
        {/* Banner Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            {/* Avatar */}
            <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-violet-100 bg-violet-50 text-violet-700 flex items-center justify-center font-bold text-3xl shrink-0 shadow-md">
              {instructor.avatarUrl ? (
                <img
                  src={instructor.avatarUrl.startsWith('http') ? instructor.avatarUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${instructor.avatarUrl}`}
                  alt={`${instructor.firstName} ${instructor.lastName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
                  {instructor.firstName} {instructor.lastName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={12} /> Verified Instructor
                </span>
              </div>

              <p className="mt-1 text-base font-medium text-slate-600">
                {instructor.headline || 'Instructor & Educator'}
              </p>

              {/* Stats Strip */}
              <div className="mt-4 flex flex-wrap items-center gap-6 text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <BookOpen size={16} className="text-violet-600" />
                  {instructor.totalCourses} Published Courses
                </span>
                {instructor.experienceYears && (
                  <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Briefcase size={16} className="text-violet-600" />
                    {instructor.experienceYears} Years Experience
                  </span>
                )}
              </div>

              {/* Social / Portfolio Links */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {instructor.websiteUrl && (
                  <a
                    href={instructor.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition"
                  >
                    <Globe size={14} /> Website <ArrowUpRight size={12} />
                  </a>
                )}
                {instructor.linkedinUrl && (
                  <a
                    href={instructor.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 hover:border-blue-200 transition"
                  >
                    <Linkedin size={14} /> LinkedIn <ArrowUpRight size={12} />
                  </a>
                )}
                {instructor.githubUrl && (
                  <a
                    href={instructor.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition"
                  >
                    <Github size={14} /> GitHub <ArrowUpRight size={12} />
                  </a>
                )}
                {instructor.twitterUrl && (
                  <a
                    href={instructor.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-sky-600 hover:bg-sky-50 transition"
                  >
                    <Twitter size={14} /> X / Twitter <ArrowUpRight size={12} />
                  </a>
                )}
                {instructor.youtubeUrl && (
                  <a
                    href={instructor.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                  >
                    <Youtube size={14} /> YouTube <ArrowUpRight size={12} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Biography Section */}
        {instructor.bio && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900">About the Instructor</h2>
            <div className="mt-4 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
              {instructor.bio}
            </div>
          </div>
        )}

        {/* Skills & Expertise */}
        {((instructor.skills && instructor.skills.length > 0) || (instructor.expertise && instructor.expertise.length > 0)) && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-xs space-y-6">
            <h2 className="text-lg font-bold text-slate-900">Expertise & Technical Skills</h2>

            {instructor.expertise?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Subject Domains</h3>
                <div className="flex flex-wrap gap-2">
                  {instructor.expertise.map((exp, idx) => (
                    <span
                      key={idx}
                      className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800"
                    >
                      {exp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {instructor.skills?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Technical Competencies</h3>
                <div className="flex flex-wrap gap-2">
                  {instructor.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Verified Qualifications & Credentials */}
        {instructor.qualifications?.length > 0 && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Credentials & Certifications</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {instructor.qualifications.map((q, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                    <Award size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{q.title}</h3>
                    <p className="text-xs text-slate-600 mt-0.5">{q.issuer}</p>
                    {q.year && (
                      <span className="mt-1 inline-block text-[11px] font-semibold text-slate-400">
                        Issued {q.year}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

