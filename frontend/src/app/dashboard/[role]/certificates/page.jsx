'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { certificateService } from '@/modules/certificates/services/certificate.service';
import {
  Award,
  Download,
  ExternalLink,
  Search,
  Filter,
  Share2,
  Copy,
  Check,
  Calendar,
  User,
  BookOpen,
  Video,
  FileCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';

export default function MyCertificatesPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const rawRole = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const role = (rawRole || '').toLowerCase();

  // Redirect admin/super-admin/instructor to the management interface
  useEffect(() => {
    if (role && role !== 'student') {
      const isPrivileged =
        ['admin', 'super-admin'].includes(role) ||
        user?.roles?.some((r) =>
          ['admin', 'super_admin', 'super-admin', 'ADMIN', 'SUPER_ADMIN'].includes(r)
        );
      if (isPrivileged || role === 'instructor') {
        router.replace(`/dashboard/${role}/certificates/admin`);
      }
    }
  }, [role, user, router]);

  const [loading, setLoading] = useState(true);
  const [certificates, setCertificates] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [previewCert, setPreviewCert] = useState(null);

  const fetchCertificates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await certificateService.getMyCertificates({
        certificateType: filterType,
        search: searchQuery,
      });
      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.items || [];
      const total =
        typeof res?.total === 'number'
          ? res.total
          : typeof res?.data?.total === 'number'
          ? res.data.total
          : items.length;
      setCertificates(items);
      setTotalCount(total);
    } catch (err) {
      console.error('Failed to load certificates', err);
    } finally {
      setLoading(false);
    }
  }, [filterType, searchQuery]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const handleCopyLink = (cert) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const verifyUrl = `${origin}/verify-certificate/${cert.certificateNumber}`;
    navigator.clipboard.writeText(verifyUrl);
    setCopiedId(cert.certificateId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleShare = async (cert) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const verifyUrl = `${origin}/verify-certificate/${cert.certificateNumber}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `LMS Certificate - ${cert.subjectTitle}`,
          text: `Check out my verified certificate for "${cert.subjectTitle}" on LMS Platform!`,
          url: verifyUrl,
        });
      } catch {
        handleCopyLink(cert);
      }
    } else {
      handleCopyLink(cert);
    }
  };

  const handleDownload = async (cert) => {
    try {
      await certificateService.downloadCertificate(
        cert.certificateId,
        `${cert.certificateNumber}.pdf`
      );
    } catch (err) {
      console.error('Download failed', err);
      alert('Unable to download certificate file. Please try again.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Award className="w-7 h-7 text-blue-600" />
            <span>My Certificates</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Access, download, and share your accredited course completion and webinar credentials.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-600" />
            <div>
              <div className="text-xs text-blue-700 font-medium">Earned Certificates</div>
              <div className="text-lg font-bold text-blue-900 leading-none">{totalCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search certificate or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Type Toggle Tabs */}
        <div className="flex items-center gap-1.5 w-full md:w-auto bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              filterType === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Credentials
          </button>
          <button
            onClick={() => setFilterType('course_completion')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              filterType === 'course_completion'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Course Completion</span>
          </button>
          <button
            onClick={() => setFilterType('webinar_participation')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              filterType === 'webinar_participation'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Webinar Participation</span>
          </button>
        </div>
      </div>

      {/* Certificates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 animate-pulse"
            >
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-6 bg-slate-200 rounded w-3/4"></div>
              <div className="h-20 bg-slate-100 rounded-xl"></div>
              <div className="h-10 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : certificates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Certificates Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            {searchQuery
              ? 'No certificates matched your search criteria. Try modifying your filter.'
              : 'Complete enrolled courses or attend qualifying webinars to earn official certificates of achievement.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/dashboard/student/my-learning"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Go to My Learning
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((cert) => {
            const isWebinar = cert.certificateType === 'webinar_participation';
            const isRevoked = cert.status === 'revoked';

            return (
              <div
                key={cert.certificateId}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between ${
                  isRevoked
                    ? 'border-rose-200 opacity-75'
                    : isWebinar
                    ? 'border-emerald-200'
                    : 'border-blue-200'
                }`}
              >
                {/* Card Header Top */}
                <div
                  className={`px-5 py-4 flex items-center justify-between border-b ${
                    isRevoked
                      ? 'bg-rose-50 border-rose-100'
                      : isWebinar
                      ? 'bg-emerald-50/70 border-emerald-100'
                      : 'bg-blue-50/70 border-blue-100'
                  }`}
                >
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      isRevoked
                        ? 'bg-rose-200 text-rose-800'
                        : isWebinar
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isRevoked ? (
                      'Revoked'
                    ) : isWebinar ? (
                      <>
                        <Video className="w-3 h-3" />
                        <span>Webinar</span>
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-3 h-3" />
                        <span>Course</span>
                      </>
                    )}
                  </span>

                  <span className="text-xs font-mono font-medium text-slate-500">
                    {cert.certificateNumber}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 line-clamp-2 leading-snug">
                      {cert.subjectTitle}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Recipient: <span className="font-semibold text-slate-700">{cert.studentNameSnapshot}</span>
                    </p>
                  </div>

                  {/* Metadata Chips */}
                  <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600">
                    {cert.instructorNameSnapshot && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{cert.instructorNameSnapshot}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Issued: {formatDate(cert.issuedAt)}</span>
                    </div>
                  </div>

                  {isRevoked && (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-800">
                      <span className="font-semibold">Revocation Notice:</span>{' '}
                      {cert.revocationReason || 'Withdrawn by administrator'}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyLink(cert)}
                      title="Copy Public Verification Link"
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg border border-slate-200 transition-colors"
                    >
                      {copiedId === cert.certificateId ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleShare(cert)}
                      title="Share Certificate"
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg border border-slate-200 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setPreviewCert(cert)}
                      title="View Certificate"
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg border border-slate-200 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleDownload(cert)}
                    disabled={isRevoked}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-colors ${
                      isRevoked
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewCert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 truncate">
                  {previewCert.subjectTitle}
                </h3>
                <p className="text-xs font-mono text-slate-500">
                  {previewCert.certificateNumber}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewCert)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setPreviewCert(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Embedded PDF View */}
            <div className="flex-1 bg-slate-100 p-2">
              <iframe
                src={certificateService.getViewUrl(previewCert.certificateId)}
                title="Certificate Preview"
                className="w-full h-full rounded-xl border border-slate-200 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
