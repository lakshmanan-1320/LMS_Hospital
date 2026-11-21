'use client';

import { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Video,
  Eye,
  User,
  Tag,
  DollarSign,
  AlertCircle,
  FileCheck,
  Send,
  BookOpen,
  Target,
  ListChecks,
  FileText,
  Sparkles,
  Globe,
  Calendar,
  Film,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  History as HistoryIcon,
  Play,
  HardDrive,
  Info,
} from 'lucide-react';
import { useCourseApprovalStore } from '../stores/useCourseApprovalStore';
import { useAuthStore } from '@/app/login/stores/useAuthStore';

export default function CourseReviewModal({ onSuccess }) {
  const {
    reviewModal,
    closeReviewModal,
    activeReview,
    isLoadingReview,
    approveCourse,
    publishCourse,
    openRejectModal,
    isActionLoading,
    error,
  } = useCourseApprovalStore();

  const currentUser = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'videos' | 'curriculum' | 'outcomes' | 'audit'
  const [approvalNote, setApprovalNote] = useState('');
  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  if (!reviewModal.isOpen) return null;

  const course = activeReview?.course;
  const curriculum = activeReview?.curriculumSummary;
  const checklist = activeReview?.checklist;
  const proposedCoupon = activeReview?.proposedCoupon;
  const historyList = activeReview?.latestHistory || [];

  // Anti-self-review check: Check if current reviewer is the author
  const courseAuthorId = course?.instructorId || course?.instructor_id;
  const isSelfAuthor = Boolean(currentUser?.userId && courseAuthorId && currentUser.userId === courseAuthorId);

  // Format video duration seconds to readable text
  const formatDuration = (totalSec = 0) => {
    const sec = Number(totalSec) || 0;
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds > 0 ? `${seconds}s` : ''}`.trim();
    if (minutes > 0) return `${minutes}m ${seconds > 0 ? `${seconds}s` : ''}`.trim();
    return `${seconds}s`;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(2)} MB`;
  };

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: prev[sectionId] === undefined ? false : !prev[sectionId],
    }));
  };

  const handleApprove = async () => {
    if (isSelfAuthor) return;
    try {
      await approveCourse(reviewModal.courseId, approvalNote.trim());
      setShowApprovalConfirm(false);
      setApprovalNote('');
      if (onSuccess) onSuccess();
    } catch {
      // Error handled by store
    }
  };

  const handleDirectPublish = async () => {
    if (!confirm('Are you sure you want to directly publish this course to the catalogue without awaiting separate approval?')) return;
    try {
      await publishCourse(reviewModal.courseId, 'Directly published by admin from review');
      closeReviewModal();
      if (onSuccess) onSuccess();
    } catch {
      // Error handled by store
    }
  };

  const handleRejectClick = () => {
    if (isSelfAuthor) return;
    openRejectModal(reviewModal.courseId, course?.title || 'Selected Course');
  };

  const instructorDisplayName =
    course?.instructor?.name ||
    course?.instructorName ||
    (course?.instructor?.firstName
      ? `${course.instructor.firstName} ${course.instructor.lastName || ''}`.trim()
      : 'Author');

  const instructorEmail = course?.instructor?.email || course?.instructorEmail || 'No email provided';
  const categoryDisplayName = course?.category?.name || course?.categoryName || 'Uncategorized';

  const outcomes = Array.isArray(course?.learningOutcomes) ? course.learningOutcomes : [];
  const requirements = Array.isArray(course?.requirements) ? course.requirements : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-paper border border-line rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="p-5 border-b border-line bg-cream/40 flex items-start justify-between gap-4 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-teal/10 text-teal flex-shrink-0 mt-0.5">
              <FileCheck size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal bg-teal/10 px-2 py-0.5 rounded-md">
                  {categoryDisplayName}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink/70 bg-line/60 px-2 py-0.5 rounded-md">
                  {course?.level || 'All Levels'}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink/70 bg-line/60 px-2 py-0.5 rounded-md">
                  {course?.language || 'English'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border bg-amber-50 text-amber-700 border-amber-200">
                  {course?.status || 'PENDING_REVIEW'}
                </span>
              </div>
              <h3 className="font-heading text-lg sm:text-xl font-bold text-ink line-clamp-1">
                {course?.title || 'Course Approval Review'}
              </h3>
              <p className="text-xs text-muted line-clamp-1 mt-0.5">
                Review syllabus, video assets, instructor details, and quality compliance before publication
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeReviewModal}
            className="p-2 rounded-xl text-muted hover:text-ink hover:bg-cream transition-colors cursor-pointer flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex items-center gap-1 px-5 border-b border-line bg-paper overflow-x-auto no-scrollbar flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'border-teal text-teal'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <BookOpen size={14} />
            <span>Course Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('videos')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'videos'
                ? 'border-teal text-teal'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Film size={14} />
            <span>Videos & Media</span>
            {course?.promoVideo && (
              <span className="w-2 h-2 rounded-full bg-teal" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('curriculum')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'curriculum'
                ? 'border-teal text-teal'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Layers size={14} />
            <span>Curriculum & Lessons ({curriculum?.lessonCount || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('outcomes')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'outcomes'
                ? 'border-teal text-teal'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Target size={14} />
            <span>Learning Outcomes ({outcomes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'audit'
                ? 'border-teal text-teal'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <ShieldCheck size={14} />
            <span>10-Point Audit</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                checklist?.ready
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {checklist?.ready ? '10/10' : 'Incomplete'}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoadingReview ? (
            <div className="py-24 text-center text-xs text-muted flex flex-col items-center gap-3">
              <div className="w-9 h-9 border-2 border-teal border-t-transparent rounded-full animate-spin" />
              <span>Loading complete course details and media verification...</span>
            </div>
          ) : !course ? (
            <div className="py-20 text-center text-xs text-muted">
              <AlertCircle size={28} className="mx-auto mb-2 text-rose-500" />
              <p>Unable to load course review details.</p>
            </div>
          ) : (
            <>
              {/* Anti-Self-Review Warning Banner */}
              {isSelfAuthor && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Author Anti-Self-Review Restriction</strong>
                    <span>
                      You are logged in as the author of this course. Platform integrity rules require an independent reviewer or another administrator to approve or reject your submission.
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* TAB 1: COURSE OVERVIEW & DETAILS */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Top Details Card with Thumbnail */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5 rounded-2xl border border-line bg-cream/20">
                    {/* Thumbnail Image */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                        Course Thumbnail
                      </span>
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-line bg-cream shadow-xs">
                        {course.thumbnailUrl ? (
                          <img
                            src={course.thumbnailUrl}
                            alt={course.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted p-4 text-center">
                            <BookOpen size={28} className="text-muted/40 mb-1" />
                            <span className="text-[11px]">No Thumbnail Set</span>
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-muted text-center truncate">
                        {course.thumbnailUrl || 'Not uploaded'}
                      </div>
                    </div>

                    {/* Metadata & Instructor Details */}
                    <div className="md:col-span-2 space-y-4">
                      <div>
                        <span className="text-[11px] font-bold text-teal uppercase tracking-wider block mb-1">
                          {categoryDisplayName} • {course.level} • {course.language}
                        </span>
                        <h4 className="font-heading text-lg font-bold text-ink leading-snug">
                          {course.title}
                        </h4>
                        {course.subtitle && (
                          <p className="text-xs text-muted mt-1 leading-relaxed">
                            {course.subtitle}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-line/60">
                        {/* Instructor Card */}
                        <div className="p-3 rounded-xl bg-paper border border-line/80">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1 flex items-center gap-1">
                            <User size={12} className="text-teal" />
                            <span>Course Author / Instructor</span>
                          </span>
                          <div className="text-xs font-bold text-ink">
                            {instructorDisplayName}
                          </div>
                          <div className="text-[11px] text-muted truncate">
                            {instructorEmail}
                          </div>
                        </div>

                        {/* Pricing & Access Card */}
                        <div className="p-3 rounded-xl bg-paper border border-line/80">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1 flex items-center gap-1">
                            <DollarSign size={12} className="text-teal" />
                            <span>Pricing & Access</span>
                          </span>
                          <div className="text-xs font-bold text-ink">
                            {course.isFree ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                                Free Access
                              </span>
                            ) : (
                              <span>
                                {course.currency} {Number(course.price).toFixed(2)}
                              </span>
                            )}
                          </div>
                          {course.discountPrice && (
                            <div className="text-[11px] text-muted">
                              Discount: {course.currency} {Number(course.discountPrice).toFixed(2)}
                            </div>
                          )}
                        </div>

                        {/* Proposed Course Promotional Coupon (if any) */}
                        {proposedCoupon && (
                          <div className="p-3 rounded-xl bg-paper border border-teal/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-teal block mb-1 flex items-center gap-1">
                              <Tag size={12} />
                              <span>Course Coupon</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-line/60 text-ink">
                                {proposedCoupon.code}
                              </span>
                              <span className="text-xs font-bold text-teal">
                                {proposedCoupon.discount_type === 'percentage'
                                  ? `${Number(proposedCoupon.discount_value)}% OFF`
                                  : `₹${Number(proposedCoupon.discount_value)} OFF`}
                              </span>
                            </div>
                            <div className="text-[10px] mt-1">
                              {proposedCoupon.is_active ? (
                                <span className="text-emerald-700 font-semibold">Active · Redeemable</span>
                              ) : (
                                <span className="text-amber-700 font-semibold">
                                  Pending Review · Activates on Course Approval
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Technical Identifiers */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted pt-1">
                        <div>
                          <span>Slug: </span>
                          <code className="text-ink font-mono bg-line/40 px-1 py-0.5 rounded">
                            {course.slug}
                          </code>
                        </div>
                        <div>
                          <span>Submitted: </span>
                          <span className="text-ink font-medium">
                            {course.submittedAt
                              ? new Date(course.submittedAt).toLocaleDateString()
                              : 'Not recorded'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Full Course Description */}
                  <div className="p-5 rounded-2xl border border-line bg-paper space-y-2">
                    <h5 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={14} className="text-teal" />
                      <span>Detailed Description ({course.description?.length || 0} characters)</span>
                    </h5>
                    <div className="text-xs text-ink/90 leading-relaxed whitespace-pre-line bg-cream/20 p-4 rounded-xl border border-line/60 max-h-52 overflow-y-auto">
                      {course.description || 'No description provided.'}
                    </div>
                  </div>

                  {/* Requirements & Target Audience */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Requirements */}
                    <div className="p-4 rounded-xl border border-line bg-paper space-y-2.5">
                      <h5 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                        <ListChecks size={14} className="text-teal" />
                        <span>Prerequisites & Requirements ({requirements.length})</span>
                      </h5>
                      {requirements.length > 0 ? (
                        <ul className="space-y-1.5 text-xs text-muted">
                          {requirements.map((req, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal flex-shrink-0 mt-1.5" />
                              <span className="text-ink leading-relaxed">{req}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted italic">
                          No prerequisites required. Open to all students.
                        </p>
                      )}
                    </div>

                    {/* Target Audience */}
                    <div className="p-4 rounded-xl border border-line bg-paper space-y-2.5">
                      <h5 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                        <Target size={14} className="text-teal" />
                        <span>Target Audience</span>
                      </h5>
                      {course.targetAudience ? (
                        <p className="text-xs text-ink leading-relaxed">
                          {course.targetAudience}
                        </p>
                      ) : (
                        <p className="text-xs text-muted italic">
                          Target audience not specified.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: VIDEOS & MEDIA DETAILS */}
              {activeTab === 'videos' && (
                <div className="space-y-6">
                  {/* Promotional Video Section */}
                  <div className="p-5 rounded-2xl border border-line bg-cream/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                        <Film size={16} className="text-teal" />
                        <span>Course Promotional Video Asset</span>
                      </h5>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          course.promoVideo
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        }`}
                      >
                        {course.promoVideo ? 'Uploaded' : 'Optional (None Uploaded)'}
                      </span>
                    </div>

                    {course.promoVideo ? (
                      <div className="p-4 rounded-xl bg-paper border border-line space-y-3">
                        {course.promoVideo.url && (
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-black mb-3 border border-line shadow-xs">
                            <video
                              src={
                                course.promoVideo.url.startsWith('http')
                                  ? course.promoVideo.url
                                  : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${course.promoVideo.url}`
                              }
                              controls
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-teal/10 text-teal flex items-center justify-center flex-shrink-0">
                              <Play size={22} className="ml-0.5" />
                            </div>
                            <div>
                              <h6 className="text-sm font-bold text-ink">
                                {course.promoVideo.title || 'Promotional Video'}
                              </h6>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted mt-0.5">
                                <span>Duration: <strong className="text-ink">{formatDuration(course.promoVideo.durationSeconds)}</strong></span>
                                <span>•</span>
                                <span>Status: <strong className="text-emerald-600 uppercase font-bold">{course.promoVideo.processingStatus || 'Ready'}</strong></span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-line text-xs">
                          <div>
                            <span className="text-[10px] text-muted uppercase font-bold block">Asset ID</span>
                            <span className="font-mono text-ink text-[11px] truncate block" title={course.promoVideo.assetId}>
                              {course.promoVideo.assetId}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted uppercase font-bold block">File Name</span>
                            <span className="text-ink truncate block">
                              {course.promoVideo.originalFileName || 'promo_video.mp4'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted uppercase font-bold block">File Size</span>
                            <span className="text-ink">
                              {formatFileSize(course.promoVideo.fileSizeBytes)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted uppercase font-bold block">MIME Type</span>
                            <span className="text-ink">
                              {course.promoVideo.mimeType || 'video/mp4'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-paper border border-dashed border-line text-center space-y-1.5">
                        <Film size={24} className="mx-auto text-muted/50 mb-1" />
                        <div className="text-xs font-bold text-ink">No Promotional Video Attached</div>
                        <p className="text-[11px] text-muted max-w-md mx-auto">
                          Promotional videos are optional on the platform. The course passes compliance without one.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Curriculum Videos Summary Cards */}
                  <div>
                    <h5 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Video size={14} className="text-teal" />
                      <span>Curriculum Video Metrics</span>
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl border border-line bg-paper text-center">
                        <Layers size={16} className="mx-auto text-teal mb-1" />
                        <div className="text-lg font-bold text-ink">{curriculum?.sectionCount || 0}</div>
                        <div className="text-[11px] text-muted">Active Sections</div>
                      </div>
                      <div className="p-3.5 rounded-xl border border-line bg-paper text-center">
                        <Video size={16} className="mx-auto text-teal mb-1" />
                        <div className="text-lg font-bold text-ink">{curriculum?.lessonCount || 0}</div>
                        <div className="text-[11px] text-muted">Published Lessons</div>
                      </div>
                      <div className="p-3.5 rounded-xl border border-line bg-paper text-center">
                        <Clock size={16} className="mx-auto text-teal mb-1" />
                        <div className="text-lg font-bold text-ink">{formatDuration(curriculum?.totalDurationSeconds)}</div>
                        <div className="text-[11px] text-muted">Total Video Time</div>
                      </div>
                      <div className="p-3.5 rounded-xl border border-line bg-paper text-center">
                        <Eye size={16} className="mx-auto text-teal mb-1" />
                        <div className="text-lg font-bold text-ink">{curriculum?.previewLessonCount || 0}</div>
                        <div className="text-[11px] text-muted">Free Previews</div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Lesson Video Breakdown */}
                  <div className="p-5 rounded-2xl border border-line bg-paper space-y-3">
                    <h5 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Film size={14} className="text-teal" />
                        <span>Uploaded Lesson Videos & Media Files</span>
                      </span>
                      <span className="text-[11px] text-muted lowercase font-normal">
                        {curriculum?.lessonCount || 0} lessons total
                      </span>
                    </h5>

                    {curriculum?.sections && curriculum.sections.length > 0 ? (
                      <div className="space-y-3">
                        {curriculum.sections.map((sec, secIdx) => (
                          <div key={sec.sectionId} className="border border-line rounded-xl overflow-hidden">
                            <div className="bg-cream/40 px-3.5 py-2 flex items-center justify-between text-xs font-bold text-ink">
                              <span>Section {secIdx + 1}: {sec.title}</span>
                              <span className="text-[11px] text-muted font-normal">
                                {sec.lessons?.length || 0} lesson(s)
                              </span>
                            </div>
                            <div className="divide-y divide-line/60">
                              {sec.lessons && sec.lessons.length > 0 ? (
                                sec.lessons.map((les, lesIdx) => (
                                  <div key={les.lessonId} className="p-3 flex items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-6 h-6 rounded-md bg-teal/10 text-teal flex items-center justify-center text-[11px] font-bold">
                                        {lesIdx + 1}
                                      </div>
                                      <div>
                                        <div className="font-bold text-ink flex items-center gap-2">
                                          <span>{les.title}</span>
                                          {les.isPreview && (
                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal/10 text-teal">
                                              Free Preview
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                                          <span className="uppercase">{les.lessonType || 'video'}</span>
                                          {les.assetFileName && (
                                            <>
                                              <span>•</span>
                                              <span className="truncate max-w-[180px]">{les.assetFileName}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-right flex-shrink-0">
                                      <div className="font-bold text-ink flex items-center justify-end gap-1">
                                        <Clock size={12} className="text-muted" />
                                        <span>{formatDuration(les.durationSeconds)}</span>
                                      </div>
                                      <span className="text-[10px] text-emerald-600 uppercase font-bold">
                                        {les.assetProcessingStatus || 'Ready'}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="p-3 text-xs text-muted text-center italic">
                                  No lessons in this section.
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-muted italic">
                        No sections or lessons found.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: CURRICULUM SYLLABUS */}
              {activeTab === 'curriculum' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-ink uppercase tracking-wider">
                        Syllabus Structure
                      </h5>
                      <p className="text-xs text-muted">
                        Complete sequence of sections, instructional units, and student lessons
                      </p>
                    </div>
                    <div className="text-xs font-bold text-teal">
                      {curriculum?.sectionCount || 0} Sections • {curriculum?.lessonCount || 0} Lessons
                    </div>
                  </div>

                  {curriculum?.sections && curriculum.sections.length > 0 ? (
                    <div className="space-y-3">
                      {curriculum.sections.map((sec, secIdx) => {
                        const isExpanded = expandedSections[sec.sectionId] !== false; // default open
                        const sectionDuration = (sec.lessons || []).reduce(
                          (acc, cur) => acc + (Number(cur.durationSeconds) || 0),
                          0
                        );
                        return (
                          <div
                            key={sec.sectionId}
                            className="border border-line rounded-xl overflow-hidden bg-paper"
                          >
                            <button
                              type="button"
                              onClick={() => toggleSection(sec.sectionId)}
                              className="w-full px-4 py-3 bg-cream/30 hover:bg-cream/60 transition-colors flex items-center justify-between text-left cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                {isExpanded ? (
                                  <ChevronDown size={16} className="text-muted" />
                                ) : (
                                  <ChevronRight size={16} className="text-muted" />
                                )}
                                <div>
                                  <span className="text-xs font-bold text-ink block">
                                    Section {secIdx + 1}: {sec.title}
                                  </span>
                                  <span className="text-[11px] text-muted">
                                    {sec.lessons?.length || 0} lesson(s) • {formatDuration(sectionDuration)}
                                  </span>
                                </div>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="divide-y divide-line/60 px-4">
                                {sec.lessons && sec.lessons.length > 0 ? (
                                  sec.lessons.map((les, lesIdx) => (
                                    <div
                                      key={les.lessonId}
                                      className="py-2.5 flex items-center justify-between text-xs gap-3"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-muted font-mono w-5">
                                          {secIdx + 1}.{lesIdx + 1}
                                        </span>
                                        <span className="font-medium text-ink">{les.title}</span>
                                        {les.isPreview && (
                                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal/10 text-teal">
                                            Free Preview
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 text-muted text-xs flex-shrink-0">
                                        <span className="uppercase text-[11px]">{les.lessonType}</span>
                                        <span>{formatDuration(les.durationSeconds)}</span>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="py-3 text-xs text-muted text-center italic">
                                    No lessons added to this section.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted italic border border-dashed border-line rounded-xl">
                      No curriculum structure available.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: LEARNING OUTCOMES */}
              {activeTab === 'outcomes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-ink uppercase tracking-wider">
                        Learning Outcomes
                      </h5>
                      <p className="text-xs text-muted">
                        Specific competencies, tools, and capabilities students will acquire
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal/10 text-teal">
                      {outcomes.length} Outcomes Listed
                    </span>
                  </div>

                  {outcomes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {outcomes.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border border-line bg-paper flex items-start gap-3 shadow-xs"
                        >
                          <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check size={14} className="stroke-[2.5]" />
                          </div>
                          <span className="text-xs text-ink leading-relaxed font-medium">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted italic border border-dashed border-line rounded-xl">
                      No learning outcomes specified.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: 10-POINT AUDIT CHECKLIST & AUDIT TRAIL */}
              {activeTab === 'audit' && (
                <div className="space-y-6">
                  {/* Automated Checklist */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h5 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                          <FileCheck size={14} className="text-teal" />
                          <span>Automated 10-Point Checklist Audit</span>
                        </h5>
                        <p className="text-xs text-muted">
                          System verification of all administrative quality rules
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          checklist?.ready
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {checklist?.ready ? '10/10 Requirements Pass' : 'Requirements Incomplete'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {checklist?.items?.map((item) => (
                        <div
                          key={item.key}
                          className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                            item.ok
                              ? 'bg-paper border-line text-ink'
                              : 'bg-rose-50/60 border-rose-200 text-rose-800'
                          }`}
                        >
                          {item.ok ? (
                            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="leading-relaxed">
                            <span className="font-bold uppercase tracking-wider text-[10px] block opacity-70 mb-0.5">
                              {item.key.replace(/_/g, ' ')}
                            </span>
                            <span>{item.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Audit History Timeline */}
                  <div className="pt-4 border-t border-line space-y-3">
                    <h5 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                      <HistoryIcon size={14} className="text-teal" />
                      <span>Review & Status Audit Trail</span>
                    </h5>

                    {historyList.length > 0 ? (
                      <div className="divide-y divide-line/60 rounded-xl border border-line bg-paper">
                        {historyList.map((h) => (
                          <div key={h.history_id} className="p-3 text-xs flex items-start justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-ink">
                                  {h.from_status ? `${h.from_status} → ${h.to_status}` : h.to_status}
                                </span>
                                <span className="text-[11px] text-muted">by {h.changed_by_name || 'System'}</span>
                              </div>
                              {h.note && (
                                <p className="text-[11px] text-muted/90 italic">"{h.note}"</p>
                              )}
                            </div>
                            <span className="text-[10px] text-muted whitespace-nowrap">
                              {new Date(h.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-xs text-muted text-center italic border border-dashed border-line rounded-xl">
                        No previous transitions recorded.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inline Approval Confirmation Note Area */}
              {showApprovalConfirm && (
                <div className="p-4 rounded-xl border border-teal/40 bg-teal/5 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <h6 className="text-xs font-bold text-teal flex items-center gap-1.5">
                      <CheckCircle2 size={15} />
                      <span>Confirm Course Approval</span>
                    </h6>
                    <button
                      type="button"
                      onClick={() => setShowApprovalConfirm(false)}
                      className="text-xs text-muted hover:text-ink cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <textarea
                    value={approvalNote}
                    onChange={(e) => setApprovalNote(e.target.value)}
                    rows={2}
                    placeholder="Add an optional congratulatory or guidance note for the instructor..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal bg-paper"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowApprovalConfirm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted hover:text-ink cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isActionLoading}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal hover:bg-teal-dark shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isActionLoading ? 'Approving...' : 'Yes, Approve Course'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-line bg-cream/30 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={closeReviewModal}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted hover:text-ink hover:bg-cream transition-colors cursor-pointer"
          >
            Close
          </button>

          {!showApprovalConfirm && course && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleRejectClick}
                disabled={isSelfAuthor || isActionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
                title={isSelfAuthor ? 'Author cannot reject own course' : 'Reject course with feedback notes'}
              >
                <AlertTriangle size={14} />
                <span>Reject</span>
              </button>
              <button
                type="button"
                onClick={() => setShowApprovalConfirm(true)}
                disabled={isSelfAuthor || isActionLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal hover:bg-teal-dark disabled:opacity-40 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                title={isSelfAuthor ? 'Author cannot approve own course' : 'Approve course'}
              >
                <CheckCircle2 size={14} />
                <span>Approve Course</span>
              </button>
              <button
                type="button"
                onClick={handleDirectPublish}
                disabled={isActionLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                title="Publish directly to catalogue without awaiting separate approval"
              >
                <Globe size={14} />
                <span>Publish Directly</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
