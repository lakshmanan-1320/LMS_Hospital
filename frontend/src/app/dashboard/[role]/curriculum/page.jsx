'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BookOpen, Plus, Trash2, Video, FileText,
  ChevronDown, ChevronRight, Loader2, Lock,
  RefreshCw, CheckCircle2, AlertCircle, UploadCloud,
  Check, X, MessageSquare, Volume2, VolumeX, ShieldCheck,
  ArrowUp, ArrowDown, Info
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { curriculumService } from '@/modules/curriculum/services/curriculum.service';

function CurriculumPageContent() {
  const params = useParams();
  const role = Array.isArray(params.role) ? params.role[0] : params.role;
  const isAdmin = role === 'admin';

  const [activeTab, setActiveTab] = useState('curriculum'); // 'curriculum' | 'replacements'
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [expanded, setExpanded] = useState({});

  // Section & Lesson form states
  const [sectionForm, setSectionForm] = useState({ title: '', description: '' });
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [lessonForm, setLessonForm] = useState({
    title: '',
    description: '',
    lessonType: 'video',
    contentText: '',
    durationSeconds: 0,
    isPreview: false,
    sortOrder: 0
  });
  const [activeSection, setActiveSection] = useState('');
  const [lessonFile, setLessonFile] = useState(null);
  const [editingLessonId, setEditingLessonId] = useState(null);

  // Replacement requests state
  const [replacementRequests, setReplacementRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Request Replacement Modal
  const [requestModalLesson, setRequestModalLesson] = useState(null);
  const [replacementReason, setReplacementReason] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  // Upload Replacement Modal
  const [uploadModalRequest, setUploadModalRequest] = useState(null);
  const [replacementFile, setReplacementFile] = useState(null);
  const [uploadingReplacement, setUploadingReplacement] = useState(false);
  const [uploadedAsset, setUploadedAsset] = useState(null);
  const [applyingReplacement, setApplyingReplacement] = useState(false);

  // Admin Review Modal / Action
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await curriculumService.getCourses();
      const list = Array.isArray(result) ? result : [];
      setCourses(list);

      if (list.length) {
        setCourseId((previous) =>
          list.some((course) => course.course_id === previous)
            ? previous
            : list[0].course_id
        );
      } else {
        setCourseId('');
        setSections([]);
      }
    } catch (err) {
      setError(err.message || 'Unable to load courses.');
    } finally {
      setLoading(false);
    }
  };

  const loadCurriculum = async (id) => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const result = await curriculumService.getCurriculum(id);
      setSections(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || 'Unable to load curriculum.');
      setSections([]);
    } finally {
      setLoading(false);
    }
  };

  const loadReplacementRequests = useCallback(async () => {
    try {
      setRequestsLoading(true);
      const res = isAdmin
        ? await curriculumService.getAdminReplacementRequests()
        : await curriculumService.getMyReplacementRequests();
      setReplacementRequests(res?.requests || []);
    } catch (err) {
      console.error('Failed to load replacement requests', err);
    } finally {
      setRequestsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (courseId) {
      loadCurriculum(courseId);
    }
    loadReplacementRequests();
  }, [courseId, loadReplacementRequests]);

  const selectedCourse = courses.find((course) => course.course_id === courseId);
  const isPublished = selectedCourse?.status === 'published';
  const isLocked = Boolean(
    selectedCourse &&
    selectedCourse.status !== 'draft' &&
    selectedCourse.status !== 'rejected' &&
    !isPublished
  );

  // Map requests by lessonId for quick lookup
  const requestsByLesson = replacementRequests.reduce((acc, req) => {
    if (req.lesson_id) {
      // Keep most relevant request if multiple
      if (!acc[req.lesson_id] || ['pending', 'approved'].includes(req.status)) {
        acc[req.lesson_id] = req;
      }
    }
    return acc;
  }, {});

  const pendingRequestsCount = replacementRequests.filter(
    (r) => r.status === 'pending'
  ).length;

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const moveSection = async (index, direction) => {
    if (saving) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const newSections = [...sections];
    const [moved] = newSections.splice(index, 1);
    newSections.splice(targetIndex, 0, moved);

    const sectionIds = newSections.map((s) => s.section_id);
    setSections(newSections);
    try {
      setSaving(true);
      await curriculumService.reorderSections(courseId, sectionIds);
      showSuccess('Sections reordered successfully.');
      await loadCurriculum(courseId);
    } catch (err) {
      setError(err.message || 'Failed to reorder sections.');
      await loadCurriculum(courseId);
    } finally {
      setSaving(false);
    }
  };

  const moveLesson = async (sectionId, lessons, index, direction) => {
    if (saving) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;

    const newLessons = [...lessons];
    const [moved] = newLessons.splice(index, 1);
    newLessons.splice(targetIndex, 0, moved);

    const lessonIds = newLessons.map((l) => l.lessonId || l.lesson_id);
    try {
      setSaving(true);
      await curriculumService.reorderLessons(sectionId, lessonIds);
      showSuccess('Lessons reordered successfully.');
      await loadCurriculum(courseId);
    } catch (err) {
      setError(err.message || 'Failed to reorder lessons.');
      await loadCurriculum(courseId);
    } finally {
      setSaving(false);
    }
  };

  // Section Actions
  const createSection = async (event) => {
    event.preventDefault();
    if (isLocked) return;
    if (!sectionForm.title.trim()) return;

    try {
      setSaving(true);
      setError('');
      await curriculumService.createSection(courseId, sectionForm);
      setSectionForm({ title: '', description: '' });
      await loadCurriculum(courseId);
    } catch (err) {
      setError(err.message || 'Unable to create section.');
    } finally {
      setSaving(false);
    }
  };

  const updateSection = async (event) => {
    event.preventDefault();
    if (!sectionForm.title.trim() || !editingSectionId) return;

    try {
      setSaving(true);
      setError('');
      await curriculumService.updateSection(editingSectionId, { ...sectionForm });
      setSectionForm({ title: '', description: '' });
      setEditingSectionId(null);
      await loadCurriculum(courseId);
    } catch (err) {
      setError(err.message || 'Unable to update section.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSection = async (sectionId) => {
    if (isLocked) return;
    if (!window.confirm('Delete this section and its lessons?')) return;

    try {
      setError('');
      await curriculumService.deleteSection(sectionId);
      await loadCurriculum(courseId);
    } catch (err) {
      setError(err.message || 'Unable to delete section.');
    }
  };

  // Lesson Actions
  const createLesson = async (event) => {
    event.preventDefault();
    if (isLocked) return;
    if (!lessonForm.title.trim() || !activeSection) return;

    try {
      setSaving(true);
      setError('');

      if (isPublished && editingLessonId && lessonFile) {
        setError('Direct video replacement on published course lessons is blocked. Please use the Request Video Replacement workflow.');
        setSaving(false);
        return;
      }

      let contentAssetId;
      if (lessonFile) {
        const upload = await curriculumService.uploadMedia(courseId, lessonFile);
        contentAssetId = upload?.asset?.asset_id;
      }

      const payload = {
        ...lessonForm,
        durationSeconds: Number(lessonForm.durationSeconds) || 0,
        ...(contentAssetId ? { contentAssetId } : {})
      };

      if (editingLessonId) {
        await curriculumService.updateLesson(editingLessonId, payload);
      } else {
        await curriculumService.createLesson(activeSection, {
          ...payload,
          sortOrder: undefined
        });
      }

      setLessonForm({
        title: '',
        description: '',
        lessonType: 'video',
        contentText: '',
        durationSeconds: 0,
        isPreview: false,
        sortOrder: 0
      });
      setLessonFile(null);
      setActiveSection('');
      setEditingLessonId(null);
      await loadCurriculum(courseId);
    } catch (err) {
      setError(err.message || 'Unable to save lesson.');
    } finally {
      setSaving(false);
    }
  };

  const deleteLesson = async (lessonId) => {
    if (isLocked) return;
    if (!window.confirm('Delete this lesson?')) return;

    try {
      setError('');
      await curriculumService.deleteLesson(lessonId);
      await loadCurriculum(courseId);
    } catch (err) {
      setError(err.message || 'Unable to delete lesson.');
    }
  };

  const togglePreview = async (lesson) => {
    if (isLocked) return;
    try {
      await curriculumService.updateLesson(lesson.lessonId, {
        isPreview: !lesson.isPreview
      });
      await loadCurriculum(courseId);
    } catch (err) {
      setError(err.message || 'Unable to update preview setting.');
    }
  };

  // Replacement Request Actions
  const handleOpenRequestModal = (lesson) => {
    setRequestModalLesson(lesson);
    setReplacementReason('');
  };

  const handleSubmitReplacementRequest = async (e) => {
    e.preventDefault();
    if (!requestModalLesson || !courseId) return;

    if (replacementReason.trim().length < 10) {
      setError('Please provide a descriptive reason for the replacement (at least 10 characters).');
      return;
    }

    try {
      setRequestSubmitting(true);
      setError('');
      await curriculumService.createReplacementRequest(
        courseId,
        requestModalLesson.lessonId,
        replacementReason.trim()
      );
      setRequestModalLesson(null);
      setReplacementReason('');
      showSuccess('Replacement request submitted for Admin review.');
      await loadReplacementRequests();
    } catch (err) {
      setError(err.message || 'Failed to submit replacement request.');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleOpenUploadModal = (request) => {
    setUploadModalRequest(request);
    setReplacementFile(null);
    setUploadedAsset(request.replacement_asset || null);
  };

  const handleUploadReplacement = async (e) => {
    e.preventDefault();
    if (!uploadModalRequest || !replacementFile) return;

    try {
      setUploadingReplacement(true);
      setError('');
      const res = await curriculumService.uploadReplacementVideo(
        uploadModalRequest.request_id,
        replacementFile
      );
      setUploadedAsset(res?.asset || null);
      showSuccess('Replacement video uploaded and validated successfully!');
      await loadReplacementRequests();
    } catch (err) {
      setError(err.message || 'Failed to upload replacement video.');
    } finally {
      setUploadingReplacement(false);
    }
  };

  const handleApplyReplacement = async () => {
    if (!uploadModalRequest) return;

    try {
      setApplyingReplacement(true);
      setError('');
      await curriculumService.applyReplacement(uploadModalRequest.request_id);
      showSuccess('Replacement video successfully applied to published course lesson!');
      setUploadModalRequest(null);
      setReplacementFile(null);
      setUploadedAsset(null);
      await loadCurriculum(courseId);
      await loadReplacementRequests();
    } catch (err) {
      setError(err.message || 'Failed to apply video replacement.');
    } finally {
      setApplyingReplacement(false);
    }
  };

  const handleReviewRequest = async (status) => {
    if (!reviewingRequest) return;

    try {
      setReviewSubmitting(true);
      setError('');
      await curriculumService.reviewReplacementRequest(reviewingRequest.request_id, {
        status,
        reviewComment: reviewComment.trim()
      });
      showSuccess(`Replacement request ${status} successfully.`);
      setReviewingRequest(null);
      setReviewComment('');
      await loadReplacementRequests();
    } catch (err) {
      setError(err.message || 'Failed to review request.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Curriculum Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Organise courses, manage lesson videos, and handle controlled media replacements.
          </p>
        </div>

        {/* Tab switcher for Admin */}
        {isAdmin && (
          <div className="flex items-center rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setActiveTab('curriculum')}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                activeTab === 'curriculum'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Curriculum Editor
            </button>
            <button
              onClick={() => setActiveTab('replacements')}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                activeTab === 'replacements'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Replacement Requests
              {pendingRequestsCount > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-700">
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-emerald-800">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ADMIN REPLACEMENTS VIEW */}
      {isAdmin && activeTab === 'replacements' ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Published Course Video Replacement Requests
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Review replacement requests submitted by instructors for published course lessons.
                </p>
              </div>
              <button
                onClick={loadReplacementRequests}
                disabled={requestsLoading}
                className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
              >
                <RefreshCw size={14} className={requestsLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {replacementRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
              <ShieldCheck size={36} className="mx-auto text-slate-300 mb-2" />
              No replacement requests have been submitted.
            </div>
          ) : (
            <div className="space-y-3">
              {replacementRequests.map((req) => (
                <div
                  key={req.request_id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                            req.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : req.status === 'approved'
                                ? 'bg-blue-100 text-blue-800'
                                : req.status === 'applied'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {req.status}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(req.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="mt-2 text-base font-bold text-slate-900">
                        Lesson: {req.lesson_title || req.lesson_id}
                      </h3>
                      <p className="text-xs font-medium text-slate-500">
                        Course: {req.course_title || req.course_id} · Instructor: {req.requester_name || req.requester_email || req.requested_by}
                      </p>

                      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-100">
                        <span className="font-semibold text-slate-900">Replacement Reason: </span>
                        {req.replacement_reason}
                      </div>

                      {req.review_comment && (
                        <div className="mt-2 rounded-xl bg-violet-50 p-3 text-xs text-violet-900 border border-violet-100">
                          <span className="font-semibold">Admin Comment: </span>
                          {req.review_comment}
                        </div>
                      )}
                    </div>

                    {/* Actions for Admin */}
                    <div className="flex items-center gap-2">
                      {req.status === 'pending' && (
                        <button
                          onClick={() => setReviewingRequest(req)}
                          className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                        >
                          Review Request
                        </button>
                      )}

                      {req.status === 'approved' && req.replacement_asset_id && (
                        <button
                          onClick={() => handleOpenUploadModal(req)}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Apply Replacement
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        /* CURRICULUM EDITOR VIEW */
        <>
          {/* Course Selector */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Select course
            </label>

            <select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setActiveSection('');
              }}
              className="w-full max-w-xl rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-violet-500"
            >
              <option value="">Choose a course</option>
              {courses.map((course) => (
                <option key={course.course_id} value={course.course_id}>
                  {course.title} — {course.status}
                </option>
              ))}
            </select>

            {selectedCourse && (
              <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-500">
                <span>{selectedCourse.section_count || 0} sections</span>
                <span>{selectedCourse.lesson_count || 0} lessons</span>
                <span className="capitalize">
                  Status: <strong className="text-slate-800">{selectedCourse.status}</strong>
                </span>
              </div>
            )}
          </section>

          {!loading && !courses.length && (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <BookOpen size={36} className="mx-auto text-slate-400" />
              <h2 className="mt-3 font-semibold text-slate-800">
                No courses available
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Courses assigned to you will appear here.
              </p>
            </section>
          )}

          {courseId && (
            <>
              {/* Locked Course Notice (archived / pending review) */}
              {isLocked && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-xs">
                  <div className="flex items-start gap-3">
                    <Lock size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <strong className="block font-bold">
                        Course is {selectedCourse?.status?.toUpperCase()} — Curriculum Structure Locked
                      </strong>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        To preserve enrollment and review integrity, editing syllabus sections and lessons is locked while in review or archived.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Published Course Live Banner */}
              {isPublished && (
                <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 text-sm text-teal-900 shadow-xs">
                  <div className="flex items-start gap-3">
                    <ShieldCheck size={20} className="text-teal-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <strong className="block font-bold">
                        Course is PUBLISHED — Live Curriculum Management
                      </strong>
                      <p className="text-xs text-teal-800 leading-relaxed">
                        You can add new sections and lessons, update titles and descriptions, and reorder content. Newly added lessons will be available immediately to enrolled students.
                        <br />
                        <strong>To replace existing video in a published lesson:</strong> use the <em>&quot;Request Video Replacement&quot;</em> button on that lesson to preserve student progress and review history.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Add/Edit Section Form (Unlocked courses only) */}
              {!isLocked && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="mb-4 flex items-center gap-2">
                    <Plus size={19} className="text-violet-600" />
                    <h2 className="font-semibold text-slate-900">
                      {editingSectionId ? 'Edit section' : 'Add new section'}
                    </h2>
                  </div>

                  <form
                    onSubmit={editingSectionId ? updateSection : createSection}
                    className="space-y-3"
                  >
                    <input
                      required
                      maxLength={200}
                      placeholder="Section title (e.g. Introduction)"
                      value={sectionForm.title}
                      onChange={(e) =>
                        setSectionForm({
                          ...sectionForm,
                          title: e.target.value
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-violet-500"
                    />

                    <textarea
                      rows={2}
                      maxLength={2000}
                      placeholder="Section description (optional)"
                      value={sectionForm.description}
                      onChange={(e) =>
                        setSectionForm({
                          ...sectionForm,
                          description: e.target.value
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-violet-500"
                    />

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                      >
                        {saving
                          ? 'Saving...'
                          : editingSectionId
                            ? 'Update section'
                            : 'Add section'}
                      </button>
                      {editingSectionId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSectionId(null);
                            setSectionForm({ title: '', description: '' });
                          }}
                          className="rounded-xl border px-5 py-2.5 text-sm"
                        >
                          Cancel edit
                        </button>
                      )}
                    </div>
                  </form>
                </section>
              )}

              {/* Sections & Lessons List */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">Course content</h2>
                  <span className="text-sm text-slate-500">{sections.length} sections</span>
                </div>

                {loading ? (
                  <div className="flex justify-center rounded-2xl bg-white p-10">
                    <Loader2 className="animate-spin text-violet-600" />
                  </div>
                ) : sections.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                    No sections yet. Add your first section above.
                  </div>
                ) : (
                  sections.map((section, index) => (
                    <div
                      key={section.section_id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded({
                              ...expanded,
                              [section.section_id]: !expanded[section.section_id]
                            })
                          }
                          className="flex min-w-0 items-center gap-3 text-left"
                        >
                          {expanded[section.section_id] ? (
                            <ChevronDown size={19} className="text-slate-500" />
                          ) : (
                            <ChevronRight size={19} className="text-slate-500" />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">
                              {index + 1}. {section.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {section.lessons?.length || 0} lessons
                            </p>
                          </div>
                        </button>

                        {!isLocked && (
                          <div className="flex items-center gap-2">
                            {/* Section Reorder Arrows */}
                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                              <button
                                type="button"
                                disabled={index === 0 || saving}
                                onClick={() => moveSection(index, 'up')}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                                title="Move section up"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <div className="w-[1px] h-4 bg-slate-200" />
                              <button
                                type="button"
                                disabled={index === sections.length - 1 || saving}
                                onClick={() => moveSection(index, 'down')}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                                title="Move section down"
                              >
                                <ArrowDown size={14} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveSection(section.section_id);
                                setLessonForm({
                                  title: '',
                                  description: '',
                                  lessonType: 'video',
                                  contentText: '',
                                  durationSeconds: 0,
                                  isPreview: false,
                                  sortOrder: 0
                                });
                                setEditingLessonId(null);
                              }}
                              className="flex items-center gap-1 rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                            >
                              <Plus size={15} /> Add lesson
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSectionId(section.section_id);
                                setSectionForm({
                                  title: section.title || '',
                                  description: section.description || ''
                                });
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSection(section.section_id)}
                              className="rounded-xl p-2 text-red-500 hover:bg-red-50"
                              title="Delete section"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        )}
                      </div>

                      {expanded[section.section_id] && (
                        <div className="border-t border-slate-100 bg-slate-50 p-4">
                          {section.lessons?.length ? (
                            <div className="space-y-2">
                              {section.lessons.map((lesson, lessonIndex) => {
                                const request = requestsByLesson[lesson.lessonId];

                                return (
                                  <div
                                    key={lesson.lessonId}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
                                  >
                                    <div className="flex items-center gap-3">
                                      {lesson.lessonType === 'video' ? (
                                        <Video className="text-violet-600 shrink-0" size={19} />
                                      ) : (
                                        <FileText className="text-violet-600 shrink-0" size={19} />
                                      )}
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-semibold text-slate-800">
                                            {lessonIndex + 1}. {lesson.title}
                                          </p>

                                          {/* Replacement status pills */}
                                          {request && (
                                            <span
                                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                                request.status === 'pending'
                                                  ? 'bg-amber-100 text-amber-800'
                                                  : request.status === 'approved'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : request.status === 'applied'
                                                      ? 'bg-emerald-100 text-emerald-800'
                                                      : 'bg-red-100 text-red-800'
                                              }`}
                                            >
                                              {request.status === 'pending' && 'Replacement Pending'}
                                              {request.status === 'approved' && 'Replacement Approved'}
                                              {request.status === 'applied' && 'Video Replaced'}
                                              {request.status === 'rejected' && 'Replacement Rejected'}
                                            </span>
                                          )}
                                        </div>

                                        <p className="text-xs capitalize text-slate-500">
                                          {lesson.lessonType}
                                          {lesson.durationSeconds
                                            ? ` · ${Math.ceil(lesson.durationSeconds / 60)} min`
                                            : ''}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      {/* Lesson Reorder Arrows */}
                                      {!isLocked && (
                                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50 mr-1">
                                          <button
                                            type="button"
                                            disabled={lessonIndex === 0 || saving}
                                            onClick={() => moveLesson(section.section_id, section.lessons, lessonIndex, 'up')}
                                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                                            title="Move lesson up"
                                          >
                                            <ArrowUp size={13} />
                                          </button>
                                          <div className="w-[1px] h-3 bg-slate-200" />
                                          <button
                                            type="button"
                                            disabled={lessonIndex === section.lessons.length - 1 || saving}
                                            onClick={() => moveLesson(section.section_id, section.lessons, lessonIndex, 'down')}
                                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                                            title="Move lesson down"
                                          >
                                            <ArrowDown size={13} />
                                          </button>
                                        </div>
                                      )}

                                      {/* Preview toggle */}
                                      <label
                                        className={`flex items-center gap-1 text-xs ${
                                          isLocked
                                            ? 'text-slate-400 cursor-not-allowed'
                                            : 'text-slate-600 cursor-pointer'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          disabled={isLocked}
                                          checked={!!lesson.isPreview}
                                          onChange={() => togglePreview(lesson)}
                                        />
                                        Preview
                                      </label>

                                      {/* Published Course: Replacement Flow */}
                                      {isPublished && lesson.lessonType === 'video' && (
                                        <div className="mx-1">
                                          {!request || request.status === 'rejected' ? (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenRequestModal(lesson)}
                                              className="rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition shadow-2xs"
                                            >
                                              Request Video Replacement
                                            </button>
                                          ) : request.status === 'pending' ? (
                                            <span className="text-xs text-amber-700 font-medium">
                                              Awaiting admin review...
                                            </span>
                                          ) : request.status === 'approved' ? (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenUploadModal(request)}
                                              className="rounded-xl bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-2xs"
                                            >
                                              Upload & Apply Video
                                            </button>
                                          ) : request.status === 'applied' ? (
                                            <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
                                              <CheckCircle2 size={13} /> Replaced
                                            </span>
                                          ) : null}
                                        </div>
                                      )}

                                      {/* Lesson Edit / Delete Actions */}
                                      {!isLocked && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingLessonId(lesson.lessonId);
                                              setActiveSection(section.section_id);
                                              setLessonForm({
                                                title: lesson.title || '',
                                                description: lesson.description || '',
                                                lessonType: lesson.lessonType || 'video',
                                                contentText: lesson.contentText || '',
                                                durationSeconds: lesson.durationSeconds || 0,
                                                isPreview: !!lesson.isPreview,
                                                sortOrder: lesson.sortOrder || 0
                                              });
                                              setLessonFile(null);
                                            }}
                                            className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => deleteLesson(lesson.lessonId)}
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                            title="Delete lesson"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">
                              No lessons in this section yet.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </section>
            </>
          )}

          {/* Add / Edit Lesson Modal for Draft Courses */}
          {activeSection && !isLocked && (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
              <div className="my-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">
                    {editingLessonId ? 'Edit lesson' : 'Add lesson'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('');
                      setLessonFile(null);
                    }}
                    className="text-slate-500 hover:text-slate-900"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={createLesson} className="space-y-4">
                  <input
                    required
                    maxLength={200}
                    placeholder="Lesson title"
                    value={lessonForm.title}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        title: e.target.value
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
                  />

                  <textarea
                    rows={2}
                    maxLength={2000}
                    placeholder="Lesson description"
                    value={lessonForm.description}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        description: e.target.value
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
                  />

                  <div>
                    <label className="mb-1 block text-sm font-medium">Lesson type</label>
                    <select
                      value={lessonForm.lessonType}
                      onChange={(e) => {
                        setLessonForm({
                          ...lessonForm,
                          lessonType: e.target.value
                        });
                        setLessonFile(null);
                      }}
                      className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
                    >
                      <option value="video">Video</option>
                      <option value="document">Document</option>
                      <option value="text">Text lesson</option>
                    </select>
                  </div>

                  {lessonForm.lessonType === 'text' ? (
                    <textarea
                      rows={5}
                      placeholder="Enter lesson content"
                      value={lessonForm.contentText}
                      onChange={(e) =>
                        setLessonForm({
                          ...lessonForm,
                          contentText: e.target.value
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
                    />
                  ) : isPublished && editingLessonId ? (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Info size={15} className="text-blue-600 shrink-0" />
                        <span>Editing Published Lesson Metadata</span>
                      </div>
                      <p className="text-blue-700 leading-relaxed pl-5">
                        Title, description, and preview settings can be updated here. To replace this lesson&apos;s video file, please use the <strong>Request Video Replacement</strong> workflow on the lesson card.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Upload {lessonForm.lessonType}
                      </label>
                      <input
                        required={!editingLessonId}
                        type="file"
                        accept={
                          lessonForm.lessonType === 'video'
                            ? 'video/mp4,video/webm,video/quicktime'
                            : '.pdf,.doc,.docx,.ppt,.pptx'
                        }
                        onChange={(e) => setLessonFile(e.target.files?.[0] || null)}
                        className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Maximum upload size: 500 MB.
                      </p>
                    </div>
                  )}

                  <input
                    type="number"
                    min="0"
                    placeholder="Duration in seconds"
                    value={lessonForm.durationSeconds}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        durationSeconds: e.target.value
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
                  />

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={lessonForm.isPreview}
                      onChange={(e) =>
                        setLessonForm({
                          ...lessonForm,
                          isPreview: e.target.checked
                        })
                      }
                    />
                    Allow students to preview this lesson
                  </label>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection('');
                        setLessonFile(null);
                      }}
                      className="rounded-xl border px-4 py-2.5 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={saving}
                      className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {saving && <Loader2 size={15} className="animate-spin" />}
                      {saving
                        ? 'Saving...'
                        : editingLessonId
                          ? 'Update lesson'
                          : 'Create lesson'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* REQUEST VIDEO REPLACEMENT MODAL */}
      {requestModalLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Request Video Replacement
              </h2>
              <button
                onClick={() => setRequestModalLesson(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReplacementRequest} className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 border border-slate-100">
                <p>
                  <strong>Lesson:</strong> {requestModalLesson.title}
                </p>
                <p className="mt-1">
                  <strong>Course:</strong> {selectedCourse?.title}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Replacement <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain why the video needs to be replaced (e.g. 'Uploaded video was missing audio track; replacing with full audio commentary')."
                  value={replacementReason}
                  onChange={(e) => setReplacementReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-violet-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Minimum 10 characters. An Admin will review this request.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestModalLesson(null)}
                  className="rounded-xl border px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestSubmitting || replacementReason.trim().length < 10}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {requestSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD & APPLY REPLACEMENT MODAL */}
      {uploadModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Upload & Apply Replacement Video
                </h2>
                <p className="text-xs text-slate-500">
                  Request #{uploadModalRequest.request_id?.slice(0, 8)}
                </p>
              </div>
              <button
                onClick={() => setUploadModalRequest(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 border border-slate-100 space-y-1">
                <p><strong>Lesson:</strong> {uploadModalRequest.lesson_title || uploadModalRequest.lesson_id}</p>
                <p><strong>Reason:</strong> {uploadModalRequest.replacement_reason}</p>
                {uploadModalRequest.review_comment && (
                  <p><strong>Admin Note:</strong> {uploadModalRequest.review_comment}</p>
                )}
              </div>

              {/* Step 1: Upload Video */}
              <form onSubmit={handleUploadReplacement} className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Select new video file (MP4, WebM)
                </label>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => setReplacementFile(e.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs"
                />

                <button
                  type="submit"
                  disabled={uploadingReplacement || !replacementFile}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadingReplacement ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Uploading & Processing FFprobe...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={14} />
                      Upload Replacement
                    </>
                  )}
                </button>
              </form>

              {/* Step 2: Show Metadata Validation & Apply */}
              {uploadedAsset && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    Video Uploaded & Validated
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400">Duration: </span>
                      {Math.ceil((uploadedAsset.duration_seconds || 0) / 60)} min ({uploadedAsset.duration_seconds || 0}s)
                    </div>
                    <div>
                      <span className="text-slate-400">Resolution: </span>
                      {uploadedAsset.width && uploadedAsset.height
                        ? `${uploadedAsset.width}x${uploadedAsset.height}`
                        : 'Standard'}
                    </div>
                    <div>
                      <span className="text-slate-400">Video Codec: </span>
                      {uploadedAsset.video_codec || 'H.264'}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">Audio Track: </span>
                      {uploadedAsset.has_audio ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <Volume2 size={13} /> {uploadedAsset.audio_codec?.toUpperCase() || 'Present'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                          <VolumeX size={13} /> Silent (No Audio)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleApplyReplacement}
                      disabled={applyingReplacement}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs"
                    >
                      {applyingReplacement ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Applying Replacement Atomically...
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          Apply Replacement to Published Lesson
                        </>
                      )}
                    </button>
                    <p className="mt-1.5 text-center text-[11px] text-slate-400">
                      Replaces the lesson media in-place without resetting student progress or enrollments.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN REVIEW MODAL */}
      {reviewingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Review Replacement Request
              </h2>
              <button
                onClick={() => setReviewingRequest(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 border border-slate-100 space-y-1">
                <p><strong>Lesson:</strong> {reviewingRequest.lesson_title || reviewingRequest.lesson_id}</p>
                <p><strong>Course:</strong> {reviewingRequest.course_title || reviewingRequest.course_id}</p>
                <p><strong>Instructor:</strong> {reviewingRequest.requester_name || reviewingRequest.requester_email || reviewingRequest.requested_by}</p>
                <p className="pt-1 border-t border-slate-200 mt-1">
                  <strong>Reason:</strong> {reviewingRequest.replacement_reason}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Review Comment / Feedback
                </label>
                <textarea
                  rows={3}
                  placeholder="Optional review note or instruction..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={reviewSubmitting}
                  onClick={() => handleReviewRequest('rejected')}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={reviewSubmitting}
                  onClick={() => handleReviewRequest('approved')}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                >
                  {reviewSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Approve Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CurriculumPage() {
  const params = useParams();
  const router = useRouter();
  const rawRole = Array.isArray(params?.role) ? params.role[0] : params?.role;

  useEffect(() => {
    // Curriculum is managed by Admins and Instructors; Super Admin is governance-only
    if (rawRole === 'super-admin') {
      router.replace('/dashboard/super-admin');
    }
  }, [rawRole, router]);

  if (rawRole === 'super-admin') {
    return null;
  }

  return <CurriculumPageContent />;
}
