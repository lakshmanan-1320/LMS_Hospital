'use client';

// Course player on the public site (/my-learning/[courseId]). Lesson/resource access is enforced
// by the API (enrollment). Based on the Student Learning Management player.

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  LoaderCircle,
  PlayCircle,
  RefreshCw,
  Video,
  Volume2,
  VolumeX,
  Check,
  ChevronLeft,
  Download,
  Paperclip,
  File,
  Star,
  Award,
} from 'lucide-react';

import { courseService } from '@/modules/courses/services/course.service';
import { useReviewStore } from '@/modules/reviews/stores/useReviewStore';
import StudentReviewModal from '@/modules/reviews/components/StudentReviewModal';

function StudentCourseLearningContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = params.courseId;
  const initialLessonId = searchParams.get('lessonId');

  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [lessonContent, setLessonContent] = useState(null);
  const [resources, setResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  // HLS is used only once the server has finished preparing it; until then the MP4 plays directly.
  const [hlsReady, setHlsReady] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [error, setError] = useState('');
  const [playbackError, setPlaybackError] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  // The course's own instructor viewing it without enrolling (Udemy-style instructor preview):
  // everything is viewable, nothing is tracked.
  const [previewMode, setPreviewMode] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const myReview = useReviewStore((state) => state.myReview);
  const isSubmittingReview = useReviewStore((state) => state.isSubmitting);
  const reviewActionError = useReviewStore((state) => state.actionError);
  const fetchMyReview = useReviewStore((state) => state.fetchMyReview);
  const submitReview = useReviewStore((state) => state.submitReview);
  const updateOwnReview = useReviewStore((state) => state.updateOwnReview);
  const deleteOwnReview = useReviewStore((state) => state.deleteOwnReview);
  const clearReviewActionError = useReviewStore((state) => state.clearActionError);

  useEffect(() => {
    if (courseId) {
      fetchMyReview(courseId);
    }
  }, [courseId, fetchMyReview]);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const lastSavedTimeRef = useRef(0);
  const hasSeekedInitialRef = useRef(false);
  const sessionIdRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess_${Date.now()}_${Math.random()}`
  );

  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const loadLesson = useCallback(async (lesson, updateUrl = true) => {
    setSelectedLesson(lesson);
    setLessonContent(null);
    setResources([]);
    setMediaUrl('');
    setHlsReady(false);
    setPlaybackError('');
    setLessonLoading(true);
    hasSeekedInitialRef.current = false;

    // Reset session ID for each new lesson stream
    sessionIdRef.current =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `sess_${Date.now()}_${Math.random()}`;

    if (updateUrl && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('lessonId', lesson.lessonId);
      window.history.replaceState(null, '', url.toString());
    }

    try {
      const response = await courseService.getStudentLesson(lesson.lessonId);
      const content = response?.lesson;

      if (!content) {
        throw new Error('Lesson content could not be loaded.');
      }

      setHlsReady(Boolean(response.media?.hlsReady));
      setLessonContent(content);
      setIsCompleted(Boolean(response.progress?.isCompleted || lesson.isCompleted));

      if (
        content.lessonType === 'video' ||
        content.lessonType === 'document'
      ) {
        if (!response.media) {
          throw new Error('Lesson media is unavailable.');
        }

        setMediaUrl(
          courseService.getStudentLessonMediaUrl(lesson.lessonId)
        );
      }

      // Load lesson resources
      setResourcesLoading(true);
      try {
        const resData = await courseService.getStudentLessonResources(lesson.lessonId);
        setResources(Array.isArray(resData) ? resData : resData?.items || []);
      } catch (rErr) {
        setResources([]);
      } finally {
        setResourcesLoading(false);
      }
    } catch (err) {
      setPlaybackError(
        err.message || 'Unable to load this lesson.'
      );
    } finally {
      setLessonLoading(false);
    }
  }, []);

  // HLS and Adaptive Streaming Setup with MP4 Fallback
  useEffect(() => {
    // The <video> element only exists once the lesson has finished loading (the "Loading lesson"
    // placeholder is shown until then), so wait for it; otherwise the player never gets a source.
    const video = videoRef.current;
    if (lessonLoading || !video || !selectedLesson || lessonContent?.lessonType !== 'video') return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const hlsUrl = courseService.getStudentLessonHlsUrl(selectedLesson.lessonId);
    const mp4Url = courseService.getStudentLessonMediaUrl(selectedLesson.lessonId);
    let cancelled = false;

    async function initPlayback() {
      // 0. HLS not prepared yet: stream the original MP4 right away (with range support).
      if (!hlsReady) {
        video.src = mp4Url;
        return;
      }

      // 1. Native HLS support (Safari, iOS)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        return;
      }

      // 2. HLS.js support (Chrome, Firefox, Edge, Desktop browsers)
      try {
        const HlsModule = await import('hls.js');
        const Hls = HlsModule.default;

        if (Hls && Hls.isSupported()) {
          const hls = new Hls({
            xhrSetup: (xhr) => {
              xhr.withCredentials = true;
            },
            enableWorker: true,
            maxBufferLength: 30,
          });

          hlsRef.current = hls;
          hls.loadSource(hlsUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;
            const lastPos = lessonContent?.progress?.lastPositionSeconds || 0;
            if (!hasSeekedInitialRef.current && lastPos > 2) {
              video.currentTime = lastPos;
              hasSeekedInitialRef.current = true;
            }
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (cancelled) return;
            if (data.fatal) {
              console.warn('HLS fatal error encountered, falling back to MP4 stream:', data);
              hls.destroy();
              hlsRef.current = null;
              video.src = mp4Url;
            }
          });
          return;
        }
      } catch (err) {
        console.warn('HLS.js initialization failed, falling back to MP4 stream:', err);
      }

      // 3. Fallback to direct MP4 Range streaming
      video.src = mp4Url;
    }

    initPlayback();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedLesson?.lessonId, lessonContent?.lessonType, hlsReady, lessonLoading]);

  // Initial Course Load & Resume Selection
  useEffect(() => {
    let active = true;

    async function loadCourse() {
      setLoading(true);
      setError('');

      try {
        const response = await courseService.getStudentCourseDetails(courseId);

        if (!active) return;

        if (!response?.course) {
          throw new Error('Course details could not be loaded.');
        }

        const isOwnerPreview = !response.enrollment?.isEnrolled && Boolean(response.enrollment?.isOwner);
        if (!response.enrollment?.isEnrolled && !isOwnerPreview) {
          throw new Error('You must enroll in this course to access its lessons.');
        }
        setPreviewMode(isOwnerPreview);

        const courseSections = response.sections || [];
        setCourse(response.course);
        setSections(courseSections);

        const allCourseLessons = courseSections.flatMap((s) => s.lessons || []);

        // Priority 1: URL parameter lessonId (deep link)
        let targetLesson = null;
        if (initialLessonId) {
          targetLesson = allCourseLessons.find((l) => l.lessonId === initialLessonId);
        }

        // Priority 2: Incomplete lesson with saved progress
        if (!targetLesson) {
          targetLesson = allCourseLessons.find(
            (l) => Number(l.lastPositionSeconds) > 0 && !l.isCompleted
          );
        }

        // Priority 3: First incomplete lesson
        if (!targetLesson) {
          targetLesson = allCourseLessons.find((l) => !l.isCompleted);
        }

        // Priority 4: First lesson in course
        if (!targetLesson && allCourseLessons.length > 0) {
          targetLesson = allCourseLessons[0];
        }

        // Auto-expand section containing target lesson
        if (targetLesson) {
          const parentSection = courseSections.find((s) =>
            (s.lessons || []).some((l) => l.lessonId === targetLesson.lessonId)
          );
          if (parentSection) {
            setExpandedSections({ [parentSection.sectionId]: true });
          } else if (courseSections.length > 0) {
            setExpandedSections({ [courseSections[0].sectionId]: true });
          }
          await loadLesson(targetLesson, false);
        } else if (courseSections.length > 0) {
          setExpandedSections({ [courseSections[0].sectionId]: true });
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load this course.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    if (courseId) loadCourse();

    return () => {
      active = false;
    };
  }, [courseId, initialLessonId, loadLesson]);

  const toggleSection = (sectionId) => {
    setExpandedSections((previous) => ({
      ...previous,
      [sectionId]: !previous[sectionId],
    }));
  };

  const allLessons = sections.flatMap((section) => section.lessons || []);
  const requiredLessons = allLessons.filter((l) => !l.isOptional);
  const totalRequired = requiredLessons.length;
  const completedRequired = requiredLessons.filter((l) => l.isCompleted).length;
  const progressPercent = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;

  const currentLessonIndex = allLessons.findIndex(
    (l) => l.lessonId === selectedLesson?.lessonId
  );
  const previousLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1
      ? allLessons[currentLessonIndex + 1]
      : null;

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes
      ? `${hours} hr ${remainingMinutes} min`
      : `${hours} hr`;
  };

  const handleVideoLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    const lastPos = lessonContent?.progress?.lastPositionSeconds || 0;
    if (
      !hasSeekedInitialRef.current &&
      lastPos > 2 &&
      lastPos < (video.duration || 999999) - 5
    ) {
      video.currentTime = lastPos;
      hasSeekedInitialRef.current = true;
    }
  };

  const handleVideoTimeUpdate = async () => {
    const video = videoRef.current;
    if (!video || !selectedLesson || previewMode) return;

    const currentTime = video.currentTime;
    const duration = video.duration || lessonContent?.durationSeconds || 0;

    // Heartbeat every 10 seconds
    if (Math.abs(currentTime - lastSavedTimeRef.current) >= 10) {
      lastSavedTimeRef.current = currentTime;
      try {
        await courseService.updateStudentProgress(
          selectedLesson.lessonId,
          Math.floor(currentTime),
          Math.floor(duration),
          sessionIdRef.current
        );
      } catch (e) {
        // Silent failure for heartbeat
      }
    }

    // Auto mark completed at 90%
    if (duration > 0 && currentTime / duration >= 0.9 && !isCompleted) {
      markCompleted();
    }
  };

  const markCompleted = async () => {
    if (!selectedLesson || completing || previewMode) return;
    setCompleting(true);
    try {
      await courseService.completeStudentLesson(selectedLesson.lessonId);
      setIsCompleted(true);
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          lessons: (section.lessons || []).map((l) =>
            l.lessonId === selectedLesson.lessonId
              ? { ...l, isCompleted: true }
              : l
          ),
        }))
      );
    } catch (err) {
      console.error('Failed to mark lesson completed', err);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoaderCircle className="animate-spin text-teal-600" size={36} />
        <span className="ml-3 text-sm text-slate-500">
          Loading your course...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
        <BookOpen size={40} className="mx-auto mb-3 text-red-400" />
        <h2 className="font-semibold text-slate-800">
          Unable to open course
        </h2>
        <p className="mt-2 text-sm text-red-600">{error}</p>
        <button
          onClick={() => router.push('/my-learning')}
          className="mt-5 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white"
        >
          Back to My Learning
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Progress */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <button
            onClick={() => router.push('/my-learning')}
            className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-teal-600"
          >
            <ArrowLeft size={17} />
            Back to My Learning
          </button>

          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">
            STUDENT LEARNING
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {course?.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {course?.subtitle || 'Continue your learning journey.'}
          </p>
        </div>

        {previewMode ? (
          <div className="min-w-[260px] max-w-sm rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900 shadow-xs">
            <p className="font-bold">Instructor preview</p>
            <p className="mt-1 text-xs leading-relaxed text-violet-800">
              You created this course, so you can view every lesson without enrolling. This is what your learners see.
              Progress and ratings aren&apos;t recorded in preview.
            </p>
          </div>
        ) : (
        /* Course Progress Card & Rating */
        <div className="min-w-[260px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Course Progress</span>
              <span className="text-teal-600">{progressPercent}%</span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-600 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {completedRequired} of {totalRequired} required lessons completed
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                clearReviewActionError();
                setReviewModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 transition-colors"
            >
              <Star size={13} className="fill-amber-400 text-amber-400" />
              {myReview ? `Your Rating (${myReview.rating}★)` : 'Rate Course'}
            </button>
            {myReview && (
              <span className="text-[11px] text-slate-400">Click to edit</span>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Course Completed Certificate Banner */}
      {progressPercent === 100 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 sm:p-5 text-emerald-950 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Award size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-900">
                Course Completed!
              </h3>
              <p className="text-xs sm:text-sm text-emerald-700">
                Your official Certificate of Completion has been generated and is ready to view or download.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard/student/certificates')}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            <Award size={16} />
            View Certificate
          </button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main Content Area */}
        <section className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-md">
            {lessonLoading ? (
              <div className="flex aspect-video items-center justify-center text-white">
                <LoaderCircle className="animate-spin text-teal-400" size={36} />
                <span className="ml-3 text-sm">Loading lesson...</span>
              </div>
            ) : selectedLesson && lessonContent ? (
              <>
                {lessonContent.lessonType === 'video' ? (
                  <video
                    ref={videoRef}
                    key={selectedLesson.lessonId}
                    controls
                    controlsList="nodownload"
                    crossOrigin="use-credentials"
                    preload="metadata"
                    playsInline
                    className="aspect-video w-full bg-black"
                    onLoadedMetadata={handleVideoLoadedMetadata}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onEnded={markCompleted}
                    onError={() =>
                      setPlaybackError(
                        'Video playback failed. Check whether the media is ready and accessible.'
                      )
                    }
                  >
                    Your browser does not support HTML5 video.
                  </video>
                ) : lessonContent.lessonType === 'document' && mediaUrl ? (
                  <iframe
                    key={selectedLesson.lessonId}
                    src={mediaUrl}
                    title={lessonContent.title}
                    className="h-[600px] w-full bg-white"
                  />
                ) : lessonContent.lessonType === 'text' ? (
                  <div className="min-h-[350px] bg-white p-6 sm:p-8">
                    <div className="mb-4 flex items-center gap-2 text-teal-600">
                      <FileText size={20} />
                      <span className="text-sm font-semibold">
                        Reading lesson
                      </span>
                    </div>

                    <h2 className="mb-5 text-xl font-bold text-slate-900">
                      {lessonContent.title}
                    </h2>

                    <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {lessonContent.contentText ||
                        'No lesson text is available.'}
                    </div>
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-slate-900 text-white">
                    <p className="text-sm">Lesson media is unavailable.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex aspect-video items-center justify-center bg-slate-900 text-white">
                <PlayCircle size={48} className="text-slate-400" />
                <span className="ml-3">Select a lesson to begin</span>
              </div>
            )}
          </div>

          {/* Audio Information / Silent Video Badge */}
          {lessonContent?.lessonType === 'video' && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2 text-xs">
                {lessonContent.hasAudio === false ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800 border border-amber-200">
                    <VolumeX size={14} className="text-amber-600" />
                    Silent Instructional Video (No audio track)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-700 border border-teal-100">
                    <Volume2 size={14} className="text-teal-600" />
                    Audio track: {lessonContent.audioCodec?.toUpperCase() || 'Stereo'}
                  </span>
                )}
              </div>

              {lessonContent.progress?.lastPositionSeconds > 2 && (
                <span className="text-xs text-slate-400">
                  Resumed from {formatDuration(lessonContent.progress.lastPositionSeconds)}
                </span>
              )}
            </div>
          )}

          {playbackError && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <span>{playbackError}</span>
              <button
                onClick={() => selectedLesson && loadLesson(selectedLesson)}
                className="flex shrink-0 items-center gap-1 font-semibold"
              >
                <RefreshCw size={15} />
                Retry
              </button>
            </div>
          )}

          {/* Lesson Actions & Info */}
          {lessonContent && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">
                        CURRENT LESSON
                      </p>
                      {selectedLesson?.isOptional && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          Optional
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {lessonContent.title}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {!previewMode && (
                    <button
                      onClick={markCompleted}
                      disabled={isCompleted || completing}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                          : 'bg-teal-600 text-white hover:bg-teal-700 shadow-xs'
                      }`}
                    >
                      {completing ? (
                        <LoaderCircle size={15} className="animate-spin" />
                      ) : isCompleted ? (
                        <Check size={15} />
                      ) : (
                        <CheckCircle2 size={15} />
                      )}
                      {isCompleted ? 'Completed' : 'Mark as Completed'}
                    </button>
                    )}

                    {lessonContent.durationSeconds > 0 && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock3 size={14} />
                        {formatDuration(lessonContent.durationSeconds)}
                      </span>
                    )}
                  </div>
                </div>

                {lessonContent.description && (
                  <p className="mt-4 text-sm leading-6 text-slate-600 border-t border-slate-100 pt-4">
                    {lessonContent.description}
                  </p>
                )}

                {/* Navigation between lessons */}
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                  <button
                    disabled={!previousLesson}
                    onClick={() => previousLesson && loadLesson(previousLesson)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-600 disabled:opacity-40 disabled:hover:text-slate-600"
                  >
                    <ChevronLeft size={16} />
                    Previous lesson
                  </button>

                  <button
                    disabled={!nextLesson}
                    onClick={() => nextLesson && loadLesson(nextLesson)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 disabled:opacity-40 disabled:hover:text-teal-600"
                  >
                    Next lesson
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Lesson Downloadable Resources */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip size={18} className="text-teal-600" />
                    <h3 className="text-base font-bold text-slate-900">
                      Lesson Resources
                    </h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {resources.length}
                  </span>
                </div>

                {resourcesLoading ? (
                  <div className="mt-4 flex items-center justify-center p-4 text-xs text-slate-400">
                    <LoaderCircle size={16} className="animate-spin mr-2 text-teal-600" />
                    Loading resources...
                  </div>
                ) : resources.length === 0 ? (
                  <p className="mt-4 text-xs text-slate-500">
                    No downloadable resources attached to this lesson.
                  </p>
                ) : (
                  <div className="mt-4 divide-y divide-slate-100">
                    {resources.map((res) => {
                      const downloadUrl = courseService.getStudentResourceDownloadUrl(
                        selectedLesson.lessonId,
                        res.resourceId
                      );
                      return (
                        <div
                          key={res.resourceId}
                          className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                              <File size={17} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {res.title || res.fileName}
                              </p>
                              <p className="text-xs text-slate-400">
                                {res.fileName} · {formatFileSize(Number(res.fileSizeBytes))}
                              </p>
                            </div>
                          </div>

                          <a
                            href={downloadUrl}
                            download={res.fileName || 'resource'}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-teal-600"
                          >
                            <Download size={14} />
                            Download
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Sidebar Lesson List */}
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-bold text-slate-900">Course Content</h2>
            <p className="mt-1 text-xs text-slate-500">
              {allLessons.length} lessons across {sections.length} sections
            </p>
          </div>

          <div className="max-h-[700px] overflow-y-auto">
            {sections.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No lessons are available yet.
              </div>
            ) : (
              sections.map((section, index) => (
                <div
                  key={section.sectionId}
                  className="border-b border-slate-100 last:border-0"
                >
                  <button
                    onClick={() => toggleSection(section.sectionId)}
                    className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-4 text-left hover:bg-slate-100 transition"
                  >
                    <div>
                      <p className="text-xs font-semibold text-teal-600">
                        SECTION {index + 1}
                      </p>
                      <h3 className="mt-0.5 text-sm font-semibold text-slate-800">
                        {section.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {section.lessons?.length || 0} lessons
                      </p>
                    </div>

                    {expandedSections[section.sectionId] ? (
                      <ChevronDown size={18} className="shrink-0 text-slate-500" />
                    ) : (
                      <ChevronRight size={18} className="shrink-0 text-slate-500" />
                    )}
                  </button>

                  {expandedSections[section.sectionId] && (
                    <div className="py-1">
                      {(section.lessons || []).map((lesson) => {
                        const isSelected =
                          selectedLesson?.lessonId === lesson.lessonId;
                        const lessonDone = lesson.isCompleted || (isSelected && isCompleted);

                        const LessonIcon =
                          lesson.lessonType === 'video'
                            ? Video
                            : lesson.lessonType === 'document'
                              ? FileText
                              : BookOpen;

                        return (
                          <button
                            key={lesson.lessonId}
                            onClick={() => loadLesson(lesson)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                              isSelected
                                ? 'bg-teal-50 text-teal-900 font-medium'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="mt-0.5 shrink-0">
                              {lessonDone ? (
                                <CheckCircle2 size={18} className="text-emerald-500" />
                              ) : isSelected ? (
                                <PlayCircle size={18} className="text-teal-600" />
                              ) : (
                                <LessonIcon size={18} className="text-slate-400" />
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5 text-sm">
                                <span className="truncate">{lesson.title}</span>
                                {lesson.isOptional && (
                                  <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-500">
                                    Optional
                                  </span>
                                )}
                              </span>

                              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="capitalize">{lesson.lessonType}</span>

                                {lesson.durationSeconds > 0 && (
                                  <span>
                                    {formatDuration(lesson.durationSeconds)}
                                  </span>
                                )}

                                {lesson.isPreview && (
                                  <span className="text-teal-600 font-medium">
                                    Preview
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Student Review Modal */}
      <StudentReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        existingReview={myReview}
        courseTitle={course?.title || 'Course'}
        onSubmit={async (payload) => {
          if (myReview) {
            const res = await updateOwnReview(myReview.reviewId, courseId, payload);
            if (res.success) setReviewModalOpen(false);
          } else {
            const res = await submitReview(courseId, payload);
            if (res.success) setReviewModalOpen(false);
          }
        }}
        onDelete={async () => {
          if (!myReview) return;
          const res = await deleteOwnReview(myReview.reviewId, courseId);
          if (res.success) setReviewModalOpen(false);
        }}
        isSubmitting={isSubmittingReview}
        error={reviewActionError}
      />
    </div>
  );
}

export default function StudentCourseLearningPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <LoaderCircle className="animate-spin text-teal-600" size={36} />
          <span className="ml-3 text-sm text-slate-500">
            Loading course classroom...
          </span>
        </div>
      }
    >
      <StudentCourseLearningContent />
    </Suspense>
  );
}
