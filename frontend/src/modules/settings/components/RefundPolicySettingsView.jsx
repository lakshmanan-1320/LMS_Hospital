'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Layers,
  BookOpen,
  DollarSign,
  Sparkles,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { settingsService } from '../services/settings.service';

export default function RefundPolicySettingsView() {
  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingCourseId, setSavingCourseId] = useState(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Global Settings State
  const [allowGlobalRefunds, setAllowGlobalRefunds] = useState(true);
  const [defaultRefundPeriodDays, setDefaultRefundPeriodDays] = useState(30);
  const [antiAbuseThreshold, setAntiAbuseThreshold] = useState(50);
  const [policyEnforcementMode, setPolicyEnforcementMode] = useState('flexible');

  // Stats State
  const [stats, setStats] = useState({ total: 0, refundable: 0, nonRefundable: 0 });

  // Courses List State
  const [courses, setCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRefundable, setFilterRefundable] = useState('all'); // 'all' | 'true' | 'false'
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Load Global Settings & Stats
  const loadSettingsAndStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsService.getRefundPolicySettings();
      const data = res?.data || res;
      if (data?.policy) {
        setAllowGlobalRefunds(Boolean(data.policy.allowGlobalRefunds ?? true));
        setDefaultRefundPeriodDays(Number(data.policy.defaultRefundPeriodDays ?? 30));
        setAntiAbuseThreshold(Number(data.policy.antiAbuseConsumptionThresholdPercent ?? 50));
        setPolicyEnforcementMode(data.policy.policyEnforcementMode || 'flexible');
      }
      if (data?.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to load refund policy settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Courses for Matrix
  const loadCourses = useCallback(async () => {
    try {
      setLoadingCourses(true);
      const res = await settingsService.listCoursesWithRefund({
        search: searchQuery.trim() || undefined,
        refundable: filterRefundable !== 'all' ? filterRefundable : undefined,
        limit: 100,
      });
      const data = res?.data || res;
      setCourses(Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load courses with refund policies:', err);
    } finally {
      setLoadingCourses(false);
    }
  }, [searchQuery, filterRefundable]);

  useEffect(() => {
    loadSettingsAndStats();
  }, [loadSettingsAndStats]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCourses();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadCourses]);

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setSuccessMessage('');
  };

  // Save Platform-Wide Global Settings
  const handleSaveGlobalPolicy = async (e) => {
    if (e) e.preventDefault();
    try {
      setSavingGlobal(true);
      setErrorMessage('');
      const payload = {
        allowGlobalRefunds,
        defaultRefundPeriodDays: Number(defaultRefundPeriodDays),
        antiAbuseConsumptionThresholdPercent: Number(antiAbuseThreshold),
        policyEnforcementMode,
      };
      const res = await settingsService.updateRefundPolicySettings(payload);
      const data = res?.data || res;
      if (data?.stats) setStats(data.stats);
      showSuccess('Platform-wide refund policy settings updated successfully.');
      loadCourses();
    } catch (err) {
      showError(err?.response?.data?.message || err?.message || 'Failed to update platform refund policy.');
    } finally {
      setSavingGlobal(false);
    }
  };

  // Bulk Apply to All Courses
  const handleBulkApply = async (makeRefundable, days = 30) => {
    const confirmPrompt = makeRefundable
      ? `Are you sure you want to enable a ${days}-day refund guarantee on ALL platform courses?`
      : 'Are you sure you want to mark ALL platform courses as NON-REFUNDABLE? Students will not be able to request refunds for any course.';
    if (!confirm(confirmPrompt)) return;

    try {
      setBulkUpdating(true);
      setErrorMessage('');
      const res = await settingsService.bulkUpdateCoursesRefund({
        allCourses: true,
        isRefundable: makeRefundable,
        refundPeriodDays: makeRefundable ? days : 0,
      });
      const data = res?.data || res;
      showSuccess(`Successfully updated ${data?.updatedCount || 'all'} courses.`);
      loadSettingsAndStats();
      loadCourses();
    } catch (err) {
      showError(err?.response?.data?.message || err?.message || 'Failed to bulk update courses.');
    } finally {
      setBulkUpdating(false);
    }
  };

  // Inline Course Row Toggle / Update
  const handleCourseRefundToggle = async (course, newRefundable, newDays) => {
    const courseId = course.courseId;
    try {
      setSavingCourseId(courseId);
      const daysToUse = newDays !== undefined ? newDays : (course.refundPeriodDays || 30);
      const res = await settingsService.updateCourseRefund(courseId, {
        isRefundable: newRefundable,
        refundPeriodDays: newRefundable ? Number(daysToUse) : 0,
      });
      const data = res?.data || res;
      setCourses((prev) =>
        prev.map((c) =>
          c.courseId === courseId
            ? { ...c, isRefundable: newRefundable, refundPeriodDays: newRefundable ? Number(daysToUse) : 0 }
            : c
        )
      );
      // Refresh stats
      settingsService.getRefundPolicySettings().then((r) => {
        const d = r?.data || r;
        if (d?.stats) setStats(d.stats);
      });
      showSuccess(`Refund policy updated for "${course.title}".`);
    } catch (err) {
      showError(err?.response?.data?.message || err?.message || 'Failed to update course refund policy.');
    } finally {
      setSavingCourseId(null);
    }
  };

  const formatPrice = (val, currency = 'INR', isFree = false) => {
    if (isFree || Number(val) === 0) return 'Free';
    return `${currency === 'INR' ? '₹' : currency} ${Number(val || 0).toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-800 flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 flex items-center gap-2.5 shadow-xs">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Summary KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 font-bold shrink-0">
            <BookOpen size={22} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Total Platform Courses
            </span>
            <span className="font-heading text-2xl font-black text-slate-900 mt-0.5 block">
              {stats.total}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 font-bold shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Refundable Courses
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-heading text-2xl font-black text-emerald-700">
                {stats.refundable}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                ({stats.total > 0 ? Math.round((stats.refundable / stats.total) * 100) : 0}%)
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 font-bold shrink-0">
            <ShieldAlert size={22} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Non-Refundable Courses
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-heading text-2xl font-black text-slate-700">
                {stats.nonRefundable}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                ({stats.total > 0 ? Math.round((stats.nonRefundable / stats.total) * 100) : 0}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: GLOBAL PLATFORM REFUND POLICY */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <RotateCcw size={18} className="text-indigo-600" />
              <h2 className="font-heading text-base font-bold text-slate-900">
                Platform-Wide Refund Policy &amp; Anti-Abuse
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Master platform configuration. Instructors inherit these defaults, and you can enforce global policy rules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkApply(false, 0)}
              disabled={bulkUpdating}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-xs disabled:opacity-50"
              title="Set all platform courses to Non-Refundable with one click"
            >
              <ShieldAlert size={14} />
              <span>Make All Non-Refundable</span>
            </button>

            <button
              type="button"
              onClick={() => handleBulkApply(true, 30)}
              disabled={bulkUpdating}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 transition shadow-xs disabled:opacity-50"
              title="Apply 30-day money-back guarantee to all courses"
            >
              <ShieldCheck size={14} />
              <span>Apply 30-Day Guarantee to All</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveGlobalPolicy} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Master Platform Refund Toggle */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                  Allow Platform Refunds
                </span>
                <p className="text-xs text-slate-500 mt-0.5 max-w-sm">
                  {allowGlobalRefunds
                    ? 'Refunds enabled. Eligible courses allow student refund requests.'
                    : 'Refunds disabled platform-wide. No student can request refunds.'}
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowGlobalRefunds}
                  onChange={(e) => setAllowGlobalRefunds(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  {allowGlobalRefunds ? 'Active' : 'Disabled'}
                </span>
              </label>
            </div>

            {/* Platform Guarantee Window */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Default Guarantee Window
              </label>
              <select
                value={defaultRefundPeriodDays}
                onChange={(e) => setDefaultRefundPeriodDays(Number(e.target.value))}
                className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={30}>30 Days (Standard Udemy Model)</option>
                <option value={14}>14 Days (Short Window)</option>
                <option value={7}>7 Days (Limited Window)</option>
                <option value={0}>0 Days (Non-Refundable by Default)</option>
              </select>
              <span className="text-[11px] text-slate-400 block mt-1">
                Applied to newly created commercial courses by default.
              </span>
            </div>

            {/* Anti-Abuse Consumption Threshold */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Udemy Anti-Abuse Consumption Threshold
              </label>
              <select
                value={antiAbuseThreshold}
                onChange={(e) => setAntiAbuseThreshold(Number(e.target.value))}
                className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={50}>50% Completed (Udemy Platform Standard)</option>
                <option value={30}>30% Completed (Strict Anti-Abuse)</option>
                <option value={75}>75% Completed (Lenient Policy)</option>
              </select>
              <span className="text-[11px] text-slate-400 block mt-1">
                Refunds are disqualified if a student completes this percentage of lessons.
              </span>
            </div>

            {/* Platform Enforcement Mode */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Policy Enforcement Mode
              </label>
              <select
                value={policyEnforcementMode}
                onChange={(e) => setPolicyEnforcementMode(e.target.value)}
                className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="flexible">Flexible (Allow Individual Course Override)</option>
                <option value="strict_no_refunds">Strict Non-Refundable (Disable All Refunds Platform-Wide)</option>
                <option value="enforce_platform_guarantee">Enforce Platform Guarantee on All Courses</option>
              </select>
              <span className="text-[11px] text-slate-400 block mt-1">
                Controls whether course-level settings take precedence over platform rules.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={savingGlobal}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-xs disabled:opacity-50"
            >
              {savingGlobal ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Global Policy</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: CENTRALIZED COURSE-LEVEL REFUND MATRIX */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-indigo-600" />
              <h2 className="font-heading text-base font-bold text-slate-900">
                Course Refund Policy Manager
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and dynamically toggle refund eligibility for individual courses directly from this screen.
            </p>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses or instructors..."
                className="h-9 w-48 sm:w-64 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={filterRefundable}
              onChange={(e) => setFilterRefundable(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Courses</option>
              <option value="true">Refundable Only</option>
              <option value="false">Non-Refundable Only</option>
            </select>

            <button
              type="button"
              onClick={loadCourses}
              disabled={loadingCourses}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-xs"
              title="Refresh list"
            >
              <RefreshCw size={14} className={loadingCourses ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-5">Course Title &amp; Instructor</th>
                <th className="py-3 px-5">Price / Type</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Refund Policy</th>
                <th className="py-3 px-5">Guarantee Window</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingCourses ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      <span>Loading course refund policies...</span>
                    </div>
                  </td>
                </tr>
              ) : courses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    No courses found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                courses.map((course) => {
                  const isRefundable = course.isRefundable ?? true;
                  const refundPeriodDays = course.refundPeriodDays ?? 30;
                  const isSavingThis = savingCourseId === course.courseId;

                  return (
                    <tr key={course.courseId} className="hover:bg-slate-50/70 transition">
                      {/* Course Title & Instructor */}
                      <td className="py-4 px-5 max-w-sm">
                        <div className="flex items-start gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-bold">
                            <BookOpen size={14} />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate" title={course.title}>
                              {course.title}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                              by {course.instructorName || course.instructorEmail || 'Instructor'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Price / Type */}
                      <td className="py-4 px-5 whitespace-nowrap font-semibold text-slate-800">
                        {formatPrice(course.price, course.currency, course.isFree)}
                      </td>

                      {/* Course Status */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            course.status === 'published'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {course.status}
                        </span>
                      </td>

                      {/* Refund Status Toggle */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isRefundable}
                            onChange={(e) => handleCourseRefundToggle(course, e.target.checked, refundPeriodDays)}
                            disabled={isSavingThis || course.isFree}
                            className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer disabled:opacity-50"
                          />
                          <span
                            className={`text-xs font-bold ${
                              course.isFree
                                ? 'text-slate-400'
                                : isRefundable
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {course.isFree
                              ? 'N/A (Free)'
                              : isRefundable
                              ? 'Refundable'
                              : 'Non-Refundable'}
                          </span>
                        </label>
                      </td>

                      {/* Guarantee Window Dropdown */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        {isRefundable && !course.isFree ? (
                          <select
                            value={refundPeriodDays}
                            onChange={(e) =>
                              handleCourseRefundToggle(course, true, Number(e.target.value))
                            }
                            disabled={isSavingThis}
                            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
                          >
                            <option value={30}>30 Days</option>
                            <option value={14}>14 Days</option>
                            <option value={7}>7 Days</option>
                          </select>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {course.isFree ? 'Free course' : 'No refund window'}
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        {isSavingThis ? (
                          <div className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-bold">
                            <div className="h-3 w-3 animate-spin rounded-full border border-indigo-600 border-t-transparent" />
                            <span>Updating...</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Auto-saved</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

