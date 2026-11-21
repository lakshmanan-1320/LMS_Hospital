'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { certificateService } from '@/modules/certificates/services/certificate.service';
import { apiClient } from '@/lib/axios';
import {
  Award,
  BookOpen,
  Video,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  Ban,
  Download,
  ExternalLink,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Plus,
  Settings,
  UserCheck,
  Users,
  ChevronRight,
  X,
} from 'lucide-react';

export default function AdminCertificatesPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const rawRole = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const role = (rawRole || '').toLowerCase();

  const isSuperAdminOrAdmin =
    ['admin', 'super-admin'].includes(role) ||
    user?.roles?.some((r) =>
      ['admin', 'super_admin', 'super-admin', 'ADMIN', 'SUPER_ADMIN'].includes(r)
    );
  const isInstructor =
    role === 'instructor' ||
    user?.roles?.some((r) => ['instructor', 'INSTRUCTOR'].includes(r));
  const isStudent = role === 'student' || (!isSuperAdminOrAdmin && !isInstructor);

  // Redirect student away from admin certificates page immediately
  useEffect(() => {
    if (isStudent) {
      router.replace('/dashboard/student/certificates');
    }
  }, [isStudent, router]);

  const [activeTab, setActiveTab] = useState('issued'); // 'issued' | 'webinars' | 'templates'
  const [overview, setOverview] = useState({
    totalIssued: 0,
    totalCourseCertificates: 0,
    totalWebinarCertificates: 0,
    totalRevoked: 0,
  });

  // Issued tab state
  const [loading, setLoading] = useState(true);
  const [certificates, setCertificates] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);

  // Modals state
  const [revokeModalCert, setRevokeModalCert] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  const [reissueModalCert, setReissueModalCert] = useState(null);
  const [reissueReason, setReissueReason] = useState('');
  const [correctedName, setCorrectedName] = useState('');
  const [isReissuing, setIsReissuing] = useState(false);

  // Webinar attendance tab state
  const [webinarsList, setWebinarsList] = useState([]);
  const [selectedWebinarId, setSelectedWebinarId] = useState('');
  const [webinarReport, setWebinarReport] = useState(null);
  const [loadingWebinarReport, setLoadingWebinarReport] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Correct attendance modal
  const [correctModalData, setCorrectModalData] = useState(null);
  const [additionalMinutes, setAdditionalMinutes] = useState(15);
  const [correctReason, setCorrectReason] = useState('');

  // Fetch overview stats (Only for super_admin and admin)
  const fetchOverview = useCallback(async () => {
    if (!isSuperAdminOrAdmin) return;
    try {
      const res = await certificateService.getAdminOverview();
      const data = res?.data || res || {};
      setOverview({
        totalIssued: Number(data.totalIssued) || 0,
        totalCourseCertificates: Number(data.totalCourseCertificates) || 0,
        totalWebinarCertificates: Number(data.totalWebinarCertificates) || 0,
        totalRevoked: Number(data.totalRevoked) || 0,
      });
    } catch (err) {
      console.error('Failed to fetch overview stats', err);
    }
  }, [isSuperAdminOrAdmin]);

  // Fetch issued certificates (super_admin, admin, instructor)
  const fetchCertificates = useCallback(async () => {
    if (isStudent) return;
    try {
      setLoading(true);
      const res = await certificateService.getAdminCertificates({
        search: searchQuery,
        certificateType: filterType,
        status: filterStatus,
        page,
        limit: 15,
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
      console.error('Failed to fetch certificates', err);
    } finally {
      setLoading(false);
    }
  }, [isStudent, searchQuery, filterType, filterStatus, page]);

  useEffect(() => {
    if (!isStudent && isSuperAdminOrAdmin) {
      fetchOverview();
    }
  }, [isStudent, isSuperAdminOrAdmin, fetchOverview]);

  useEffect(() => {
    if (!isStudent && activeTab === 'issued') {
      fetchCertificates();
    }
  }, [isStudent, activeTab, fetchCertificates]);

  // Load webinars list for webinar tab
  useEffect(() => {
    if (activeTab === 'webinars' && webinarsList.length === 0) {
      apiClient
        .get('/webinars/admin')
        .then((res) => {
          const list = res.data?.data || res.data || [];
          setWebinarsList(list);
          if (list.length > 0 && !selectedWebinarId) {
            setSelectedWebinarId(list[0].webinar_id);
          }
        })
        .catch((err) => console.error('Failed to load webinars', err));
    }
  }, [activeTab, webinarsList.length, selectedWebinarId]);

  // Load selected webinar report
  const loadWebinarReport = useCallback(async (webinarId) => {
    if (!webinarId) return;
    try {
      setLoadingWebinarReport(true);
      const res = await certificateService.getWebinarAttendanceReport(webinarId);
      setWebinarReport(res.data);
    } catch (err) {
      console.error('Failed to load webinar report', err);
    } finally {
      setLoadingWebinarReport(false);
    }
  }, []);

  useEffect(() => {
    if (selectedWebinarId && activeTab === 'webinars') {
      loadWebinarReport(selectedWebinarId);
    }
  }, [selectedWebinarId, activeTab, loadWebinarReport]);

  // Handle Revoke
  const handleRevokeSubmit = async (e) => {
    e.preventDefault();
    if (!revokeReason.trim() || !revokeModalCert) return;

    try {
      setIsRevoking(true);
      await certificateService.revokeCertificate(
        revokeModalCert.certificateId,
        revokeReason
      );
      setRevokeModalCert(null);
      setRevokeReason('');
      fetchCertificates();
      if (isSuperAdminOrAdmin) {
        fetchOverview();
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to revoke certificate');
    } finally {
      setIsRevoking(false);
    }
  };

  // Handle Reissue
  const handleReissueSubmit = async (e) => {
    e.preventDefault();
    if (!reissueReason.trim() || !reissueModalCert) return;

    try {
      setIsReissuing(true);
      await certificateService.reissueCertificate(
        reissueModalCert.certificateId,
        {
          reason: reissueReason,
          correctedStudentName: correctedName.trim() || undefined,
        }
      );
      setReissueModalCert(null);
      setReissueReason('');
      setCorrectedName('');
      fetchCertificates();
      if (isSuperAdminOrAdmin) {
        fetchOverview();
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to reissue certificate');
    } finally {
      setIsReissuing(false);
    }
  };

  // Handle Webinar Certificate Settings Save
  const handleSaveWebinarSettings = async (e) => {
    e.preventDefault();
    if (!webinarReport || !selectedWebinarId) return;

    try {
      setSavingSettings(true);
      await certificateService.updateWebinarSettings(selectedWebinarId, {
        enabled: Boolean(webinarReport.settings?.enabled),
        minimumAttendancePercentage: Number(
          webinarReport.settings?.minimum_attendance_percentage
        ),
        minimumAttendanceMinutes: webinarReport.settings?.minimum_attendance_minutes
          ? Number(webinarReport.settings?.minimum_attendance_minutes)
          : null,
      });
      alert('Webinar certificate settings updated successfully!');
      loadWebinarReport(selectedWebinarId);
    } catch (err) {
      alert('Failed to update webinar certificate settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Manual Issue for Webinar
  const handleManualIssueWebinar = async (participant) => {
    if (!participant.studentId) {
      alert('Participant is not a registered user account.');
      return;
    }

    if (
      !confirm(
        `Issue verified certificate for ${participant.participantName} (${participant.email})?`
      )
    ) {
      return;
    }

    try {
      await certificateService.manualIssueWebinarCertificate({
        webinarId: selectedWebinarId,
        studentId: participant.studentId,
        reason: 'Administrator manual override waiver',
      });
      alert('Certificate issued successfully!');
      loadWebinarReport(selectedWebinarId);
      if (isSuperAdminOrAdmin) {
        fetchOverview();
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to issue certificate');
    }
  };

  // Add Attendance Adjustment
  const handleCorrectAttendanceSubmit = async (e) => {
    e.preventDefault();
    if (!correctModalData || !selectedWebinarId) return;

    try {
      await certificateService.correctWebinarAttendance({
        webinarId: selectedWebinarId,
        webinarRegistrationId: correctModalData.webinarRegistrationId,
        additionalSeconds: Number(additionalMinutes) * 60,
        reason: correctReason,
      });
      setCorrectModalData(null);
      setCorrectReason('');
      setAdditionalMinutes(15);
      loadWebinarReport(selectedWebinarId);
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to adjust attendance');
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

  if (isStudent) {
    return null;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Award className="w-7 h-7 text-blue-600" />
            <span>Certificate Management</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Centrally manage Course Completion & Webinar Participation credentials, verify attendance thresholds, and administer revocations/reissues.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('issued')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'issued'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Issued Certificates</span>
          </button>
          <button
            onClick={() => setActiveTab('webinars')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'webinars'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Webinar Attendance</span>
          </button>
        </div>
      </div>

      {/* Metrics Stat Cards (Super Admin & Admin Only) */}
      {isSuperAdminOrAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Issued
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mt-3">
              {overview.totalIssued}
            </div>
            <div className="text-xs text-slate-500 mt-1">Platform-wide credentials</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Course Completion
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mt-3">
              {overview.totalCourseCertificates}
            </div>
            <div className="text-xs text-indigo-600 mt-1">100% Curriculum Verified</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Webinar Participation
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Video className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mt-3">
              {overview.totalWebinarCertificates}
            </div>
            <div className="text-xs text-emerald-600 mt-1">Attendance Threshold Verified</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Revoked
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Ban className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mt-3">
              {overview.totalRevoked}
            </div>
            <div className="text-xs text-rose-600 mt-1">Invalidated or Reissued</div>
          </div>
        </div>
      )}

      {/* TAB 1: ISSUED CERTIFICATES */}
      {activeTab === 'issued' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search number, student, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="course_completion">Course Completion</option>
                <option value="webinar_participation">Webinar Participation</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="valid">Valid Only</option>
                <option value="revoked">Revoked Only</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Certificate ID</th>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Subject</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Issued On</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-400">
                        Loading certificates...
                      </td>
                    </tr>
                  ) : certificates.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-500">
                        No certificates matching current filters.
                      </td>
                    </tr>
                  ) : (
                    certificates.map((cert) => {
                      const isWebinar = cert.certificateType === 'webinar_participation';
                      const isRevoked = cert.status === 'revoked';

                      return (
                        <tr key={cert.certificateId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {cert.certificateNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{cert.studentNameSnapshot}</div>
                            <div className="text-xs text-slate-400">{cert.studentEmail}</div>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800 max-w-xs truncate">
                            {cert.subjectTitle}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                isWebinar
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {isWebinar ? 'Webinar' : 'Course'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">{formatDate(cert.issuedAt)}</td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                isRevoked
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {cert.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={`/verify-certificate/${cert.certificateNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Public Verification"
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>

                              <button
                                onClick={() =>
                                  certificateService.downloadCertificate(
                                    cert.certificateId,
                                    `${cert.certificateNumber}.pdf`
                                  )
                                }
                                title="Download PDF"
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100"
                              >
                                <Download className="w-4 h-4" />
                              </button>

                              {!isRevoked ? (
                                <button
                                  onClick={() => setRevokeModalCert(cert)}
                                  title="Revoke Certificate"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              ) : null}

                              <button
                                onClick={() => {
                                  setReissueModalCert(cert);
                                  setCorrectedName(cert.studentNameSnapshot);
                                }}
                                title="Reissue Certificate"
                                className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing {certificates.length} of {totalCount} certificates
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                >
                  Previous
                </button>
                <span className="font-medium text-slate-700">Page {page}</span>
                <button
                  disabled={certificates.length < 15}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WEBINAR ATTENDANCE & SETTINGS */}
      {activeTab === 'webinars' && (
        <div className="space-y-6">
          {/* Webinar Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Select Webinar Session
              </label>
              <select
                value={selectedWebinarId}
                onChange={(e) => setSelectedWebinarId(e.target.value)}
                className="px-4 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[320px]"
              >
                {webinarsList.map((w) => (
                  <option key={w.webinar_id} value={w.webinar_id}>
                    {w.title} ({w.status?.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {webinarReport?.webinar && (
              <div className="flex items-center gap-6 text-sm text-slate-600">
                <div>
                  <span className="text-xs text-slate-400 block">Host</span>
                  <span className="font-semibold text-slate-900">
                    {webinarReport.webinar.instructorName}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Scheduled Duration</span>
                  <span className="font-semibold text-slate-900">
                    {webinarReport.webinar.durationMinutes} minutes
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Certificate Rules Configuration Card */}
          {webinarReport && (
            <form
              onSubmit={handleSaveWebinarSettings}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4"
            >
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-600" />
                <span>Webinar Participation Certificate Settings</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                <div className="flex items-center space-x-3 pt-6">
                  <input
                    type="checkbox"
                    id="enableCert"
                    checked={Boolean(webinarReport.settings?.enabled)}
                    onChange={(e) =>
                      setWebinarReport({
                        ...webinarReport,
                        settings: {
                          ...webinarReport.settings,
                          enabled: e.target.checked,
                        },
                      })
                    }
                    className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <label htmlFor="enableCert" className="text-sm font-bold text-slate-900 cursor-pointer">
                    Enable Participation Certificate
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Minimum Attendance Percentage (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={webinarReport.settings?.minimum_attendance_percentage || 75}
                    onChange={(e) =>
                      setWebinarReport({
                        ...webinarReport,
                        settings: {
                          ...webinarReport.settings,
                          minimum_attendance_percentage: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-400">Default: 75%</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Minimum Attendance Minutes (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={webinarReport.settings?.minimum_attendance_minutes || ''}
                    placeholder="e.g. 45"
                    onChange={(e) =>
                      setWebinarReport({
                        ...webinarReport,
                        settings: {
                          ...webinarReport.settings,
                          minimum_attendance_minutes: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          )}

          {/* Participant Attendance Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Participant Attendance Breakdown
                </h3>
                <p className="text-xs text-slate-500">
                  Verified multi-interval attendance logs calculated for all registrants.
                </p>
              </div>

              <div className="text-xs font-semibold text-slate-600">
                Total Registrants: {webinarReport?.participants?.length || 0}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Participant</th>
                    <th className="py-3 px-4">Attended Time</th>
                    <th className="py-3 px-4">Attendance %</th>
                    <th className="py-3 px-4">Qualifies?</th>
                    <th className="py-3 px-4">Certificate Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingWebinarReport ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400">
                        Calculating attendance records...
                      </td>
                    </tr>
                  ) : !webinarReport?.participants || webinarReport.participants.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-500">
                        No registrations recorded for this webinar.
                      </td>
                    </tr>
                  ) : (
                    webinarReport.participants.map((p) => (
                      <tr key={p.webinarRegistrationId} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">
                            {p.participantName || 'Guest Registrant'}
                          </div>
                          <div className="text-xs text-slate-400">{p.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          {p.attendedMinutes} mins ({p.attendedSeconds}s)
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{p.attendedPercentage}%</span>
                            <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, p.attendedPercentage)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {p.qualifies ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              <span>Yes</span>
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              Below Threshold
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {p.isIssued ? (
                            <div>
                              <span className="inline-flex items-center text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                Issued
                              </span>
                              <div className="text-xs font-mono text-slate-500 mt-0.5">
                                {p.certificateNumber}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Not Issued</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setCorrectModalData(p)}
                              title="Add Extra Attendance Time"
                              className="text-xs font-semibold text-slate-600 hover:text-blue-600 px-2 py-1 border border-slate-200 rounded-lg hover:bg-slate-50"
                            >
                              Adjust Time
                            </button>

                            {!p.isIssued && p.studentId && (
                              <button
                                onClick={() => handleManualIssueWebinar(p)}
                                title="Manually issue certificate"
                                className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg"
                              >
                                Issue Cert
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REVOKE MODAL */}
      {revokeModalCert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-600" />
                <span>Revoke Certificate</span>
              </h3>
              <button
                onClick={() => setRevokeModalCert(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Revoking certificate <span className="font-mono font-bold text-slate-700">{revokeModalCert.certificateNumber}</span> will immediately invalidate its public verification seal and make it un-downloadable.
            </p>

            <form onSubmit={handleRevokeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Revocation Reason
                </label>
                <textarea
                  required
                  rows="3"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Provide explicit audit reason (e.g. academic dishonesty, invalid registration, duplicate issuance)..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRevokeModalCert(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRevoking || !revokeReason.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
                >
                  {isRevoking ? 'Revoking...' : 'Confirm Revoke'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REISSUE MODAL */}
      {reissueModalCert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-600" />
                <span>Reissue Certificate</span>
              </h3>
              <button
                onClick={() => setReissueModalCert(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Reissuing will revoke certificate <span className="font-mono font-bold text-slate-700">{reissueModalCert.certificateNumber}</span> and generate a new linked certificate with a fresh verification token.
            </p>

            <form onSubmit={handleReissueSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Recipient Name (Corrected)
                </label>
                <input
                  type="text"
                  value={correctedName}
                  onChange={(e) => setCorrectedName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reissuance Reason
                </label>
                <textarea
                  required
                  rows="3"
                  value={reissueReason}
                  onChange={(e) => setReissueReason(e.target.value)}
                  placeholder="e.g. Student legal name spelling correction, updated accreditation format..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReissueModalCert(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReissuing || !reissueReason.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
                >
                  {isReissuing ? 'Reissuing...' : 'Reissue Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST ATTENDANCE MODAL */}
      {correctModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span>Adjust Attendance Record</span>
              </h3>
              <button
                onClick={() => setCorrectModalData(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Add manually verified attendance time for participant{' '}
              <span className="font-semibold text-slate-800">{correctModalData.participantName}</span> ({correctModalData.email}).
            </p>

            <form onSubmit={handleCorrectAttendanceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Additional Minutes to Credit
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={additionalMinutes}
                  onChange={(e) => setAdditionalMinutes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Adjustment
                </label>
                <input
                  type="text"
                  value={correctReason}
                  onChange={(e) => setCorrectReason(e.target.value)}
                  placeholder="e.g. Phone attendee matching, network disconnection recovery..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCorrectModalData(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Apply Extra Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
