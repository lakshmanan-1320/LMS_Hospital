'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Lock,
  Layers,
  DollarSign,
  Video,
  FileText,
  ListChecks,
  Upload,
  Play,
  Info,
  Sparkles,
  Globe,
  Image as ImageIcon,
  History,
  Send,
  RotateCcw,
  AlertTriangle,
  FileCheck,
  Tag,
  Ticket,
  ShieldCheck,
  ShieldAlert,
  Archive,
} from 'lucide-react';
import { useCourseStore } from '../stores/useCourseStore';
import { useCourseApprovalStore } from '../stores/useCourseApprovalStore';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { categoryService } from '@/modules/categories/services/category.service';
import { courseService } from '../services/course.service';
import { couponService } from '@/modules/coupons/services/coupon.service';
import CourseLanguageSettingsModal from './CourseLanguageSettingsModal';
import CourseSubmitModal from './CourseSubmitModal';
import CourseHistoryModal from './CourseHistoryModal';
import CourseReviewModal from './CourseReviewModal';
import CourseRejectModal from './CourseRejectModal';

const TABS = [
  { id: 'basics', label: 'Basic Info', icon: FileText },
  { id: 'curriculum_meta', label: 'Outcomes & Audience', icon: Layers },
  { id: 'pricing', label: 'Pricing & Access', icon: DollarSign },
  { id: 'media', label: 'Media & Assets', icon: Video },
  { id: 'checklist', label: 'Submission Checklist', icon: ListChecks },
];

export default function CourseEditorView({ courseRef, role = 'instructor' }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  // Set when this view rewrites the URL to a new slug, so that change doesn't trigger a refetch
  const slugRewriteRef = useRef(null);

  const {
    activeCourse,
    fetchCourseById,
    updateCourse,
    fetchChecklist,
    checklist,
    isLoading,
    isSaving,
    error,
    successMessage,
    clearAlerts,
  } = useCourseStore();

  // courseRef comes from the URL (slug). All API calls after the first load use the real course ID.
  const courseId = activeCourse?.courseId || activeCourse?.course_id || null;

  const {
    openSubmitModal,
    withdrawCourse,
    publishCourse,
    archiveCourse,
    openReviewModal,
    openHistoryModal,
    isActionLoading: isApprovalLoading,
  } = useCourseApprovalStore();

  const currentUser = useAuthStore((s) => s.user);
  const instructorId = activeCourse?.instructorId || activeCourse?.instructor_id;
  const isAuthor = role === 'instructor' && (!instructorId || !currentUser?.userId || currentUser.userId === instructorId);
  const isAdmin = role === 'admin' || role === 'super-admin';

  const handleWithdraw = async () => {
    if (!confirm('Are you sure you want to withdraw your submission? This will return the course to Draft status.')) return;
    try {
      await withdrawCourse(courseId);
      fetchCourseById(courseId);
      fetchChecklist(courseId);
    } catch (err) {
      // Handled by store
    }
  };

  const handlePublishCourse = async () => {
    if (!confirm('Are you sure you want to directly publish this course to the public catalogue?')) return;
    try {
      await publishCourse(courseId, 'Directly published by admin');
      fetchCourseById(courseId);
      fetchChecklist(courseId);
    } catch (err) {
      // Handled by store
    }
  };

  const handleArchiveCourse = async () => {
    if (!confirm('Are you sure you want to unpublish and archive this course?')) return;
    try {
      await archiveCourse(courseId, 'Archived by admin');
      fetchCourseById(courseId);
      fetchChecklist(courseId);
    } catch (err) {
      // Handled by store
    }
  };

  const handleSubmissionSuccess = () => {
    fetchCourseById(courseId);
    fetchChecklist(courseId);
  };

  const [activeTab, setActiveTab] = useState('basics');
  const [categories, setCategories] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  // Form Fields State
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [level, setLevel] = useState('all_levels');
  const [language, setLanguage] = useState('English');
  const [isFree, setIsFree] = useState(false);
  const [price, setPrice] = useState('0');
  const [discountPrice, setDiscountPrice] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [isRefundable, setIsRefundable] = useState(true);
  const [refundPeriodDays, setRefundPeriodDays] = useState(30);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [promoVideoAssetId, setPromoVideoAssetId] = useState('');
  const [targetAudience, setTargetAudience] = useState('');

  // Video Upload & Preview State
  const [uploadedVideoFile, setUploadedVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);

  // Thumbnail Image Upload State
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [showThumbnailUrlInput, setShowThumbnailUrlInput] = useState(false);

  // Dynamic Array Lists
  const [learningOutcomes, setLearningOutcomes] = useState([]);
  const [newOutcome, setNewOutcome] = useState('');
  const [requirements, setRequirements] = useState([]);
  const [newRequirement, setNewRequirement] = useState('');

  // Course Promotional Coupon State (Admin applied or proposed for review)
  const [courseCoupon, setCourseCoupon] = useState(null);
  const [adminCoupons, setAdminCoupons] = useState([]);
  const [loadingCoupon, setLoadingCoupon] = useState(false);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [couponMode, setCouponMode] = useState('admin'); // 'admin' | 'custom'
  const [selectedAdminCouponId, setSelectedAdminCouponId] = useState('');
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponType, setNewCouponType] = useState('percentage');
  const [newCouponValue, setNewCouponValue] = useState('');
  const [newCouponLimit, setNewCouponLimit] = useState('100');
  const [newCouponExpiry, setNewCouponExpiry] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  const [formError, setFormError] = useState('');

  // Load dynamic active instruction languages
  const loadLanguages = async () => {
    try {
      const data = await courseService.getCourseLanguages();
      if (Array.isArray(data) && data.length > 0) {
        setLanguages(data);
      }
    } catch (err) {
      console.error('Failed to load course languages:', err);
    }
  };

  // Load course details, languages, and categories on mount
  useEffect(() => {
    if (!courseRef) return;

    // Skip the refetch when this view only swapped the URL to the course's new slug
    if (slugRewriteRef.current === courseRef) {
      slugRewriteRef.current = null;
      return;
    }

    fetchCourseById(courseRef)
      .then((course) => {
        const id = course?.courseId || course?.course_id;
        if (id) fetchChecklist(id);
        // Old UUID links are rewritten to the readable slug URL
        if (course?.slug && course.slug !== courseRef) {
          slugRewriteRef.current = course.slug;
          router.replace(`/dashboard/${role}/courses/${course.slug}`);
        }
      })
      .catch(() => {});
  }, [courseRef, role, router, fetchCourseById, fetchChecklist]);

  useEffect(() => {
    loadLanguages();

    categoryService
      .getCategories({ isActive: true, limit: 100 })
      .then((res) => setCategories(res?.items || []))
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  // Sync form inputs when activeCourse changes
  useEffect(() => {
    if (!activeCourse) return;

    setTitle(activeCourse.title || '');
    setSubtitle(activeCourse.subtitle || '');
    setDescription(activeCourse.description || '');
    setCategoryId(activeCourse.categoryId || activeCourse.category_id || '');
    setLevel(activeCourse.level || 'all_levels');
    setLanguage(activeCourse.language || 'English');

    const freeVal = activeCourse.isFree !== undefined ? activeCourse.isFree : activeCourse.is_free;
    setIsFree(Boolean(freeVal));
    setPrice(String(activeCourse.price ?? 0));

    const discVal =
      activeCourse.discountPrice !== null && activeCourse.discountPrice !== undefined
        ? activeCourse.discountPrice
        : activeCourse.discount_price !== null && activeCourse.discount_price !== undefined
        ? activeCourse.discount_price
        : '';
    setDiscountPrice(discVal !== '' ? String(discVal) : '');

    setCurrency(activeCourse.currency || 'INR');

    const refundableVal = activeCourse.isRefundable ?? activeCourse.is_refundable;
    setIsRefundable(refundableVal !== undefined && refundableVal !== null ? Boolean(refundableVal) : true);

    const periodVal = activeCourse.refundPeriodDays ?? activeCourse.refund_period_days;
    setRefundPeriodDays(periodVal !== undefined && periodVal !== null ? Number(periodVal) : 30);

    setThumbnailUrl(activeCourse.thumbnailUrl || activeCourse.thumbnail_url || '');
    setPromoVideoAssetId(activeCourse.promoVideoAssetId || activeCourse.promo_video_asset_id || '');

    // Restore promo video player preview URL if attached
    const promoVid = activeCourse.promoVideo;
    if (promoVid?.url) {
      const fullUrl = promoVid.url.startsWith('http')
        ? promoVid.url
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${promoVid.url}`;
      setVideoPreviewUrl(fullUrl);
    } else {
      setVideoPreviewUrl('');
    }

    setTargetAudience(activeCourse.targetAudience || activeCourse.target_audience || '');

    const outcomes = activeCourse.learningOutcomes ?? activeCourse.learning_outcomes;
    setLearningOutcomes(Array.isArray(outcomes) ? outcomes : []);

    const reqs = activeCourse.requirements;
    setRequirements(Array.isArray(reqs) ? reqs : []);
    setFormError('');
  }, [activeCourse]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  // Load attached course coupon & active admin coupons for the dropdown
  useEffect(() => {
    if (!courseId) return;

    const loadCouponData = async () => {
      try {
        setLoadingCoupon(true);
        const [couponRes, adminCouponsRes] = await Promise.all([
          couponService.getCourseCoupon(courseId).catch(() => null),
          couponService.listCoupons({ isActive: true }).catch(() => null),
        ]);

        const curCoupon = couponRes?.data || null;
        setCourseCoupon(curCoupon);

        const rawList = adminCouponsRes?.items || adminCouponsRes?.data?.items || adminCouponsRes?.data || adminCouponsRes || [];
        const list = Array.isArray(rawList) ? rawList : [];
        setAdminCoupons(list);
        if (Array.isArray(list) && list.length > 0) {
          setSelectedAdminCouponId(list[0].coupon_id);
        }
      } catch (err) {
        console.error('Failed to load course coupon data:', err);
      } finally {
        setLoadingCoupon(false);
      }
    };

    loadCouponData();
  }, [courseId]);

  const handleApplyAdminCoupon = async () => {
    if (!selectedAdminCouponId) return;
    setSavingCoupon(true);
    setCouponError('');
    setCouponSuccess('');
    try {
      const res = await couponService.setCourseCoupon(courseId, {
        couponId: selectedAdminCouponId,
      });
      setCourseCoupon(res?.data || null);
      setCouponSuccess('Admin coupon applied to course successfully!');
      setTimeout(() => setCouponSuccess(''), 4000);
    } catch (err) {
      setCouponError(err?.response?.data?.message || err?.message || 'Failed to apply admin coupon.');
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleProposeCustomCoupon = async (e) => {
    e?.preventDefault();
    const clean = newCouponCode.trim().toUpperCase();
    if (!clean) {
      setCouponError('Coupon code is required.');
      return;
    }
    const val = parseFloat(newCouponValue);
    if (isNaN(val) || val <= 0) {
      setCouponError('Discount value must be greater than zero.');
      return;
    }
    if (newCouponType === 'percentage' && val > 100) {
      setCouponError('Percentage discount cannot exceed 100%.');
      return;
    }

    setSavingCoupon(true);
    setCouponError('');
    setCouponSuccess('');
    try {
      const payload = {
        code: clean,
        discount_type: newCouponType,
        discount_value: val,
        usage_limit: newCouponLimit ? parseInt(newCouponLimit, 10) : undefined,
        valid_until: newCouponExpiry ? new Date(newCouponExpiry).toISOString() : undefined,
      };
      const res = await couponService.setCourseCoupon(courseId, payload);
      setCourseCoupon(res?.data || null);
      setCouponSuccess('Course coupon proposed! It will be reviewed by admin upon course submission.');
      setNewCouponCode('');
      setNewCouponValue('');
      setTimeout(() => setCouponSuccess(''), 5000);
    } catch (err) {
      setCouponError(err?.response?.data?.message || err?.message || 'Failed to propose coupon.');
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleRemoveCourseCoupon = async () => {
    if (!window.confirm('Are you sure you want to remove the promotional coupon from this course?')) return;
    setSavingCoupon(true);
    setCouponError('');
    try {
      await couponService.removeCourseCoupon(courseId);
      setCourseCoupon(null);
      setCouponSuccess('Promotional coupon removed from course.');
      setTimeout(() => setCouponSuccess(''), 4000);
    } catch (err) {
      setCouponError(err?.response?.data?.message || err?.message || 'Failed to remove coupon.');
    } finally {
      setSavingCoupon(false);
    }
  };

  // Check if form has unsaved changes compared to backend state
  const isDirty = useMemo(() => {
    if (!activeCourse) return false;

    const savedPrice = String(activeCourse.price ?? 0);
    const savedDiscount =
      activeCourse.discountPrice !== null && activeCourse.discountPrice !== undefined
        ? String(activeCourse.discountPrice)
        : activeCourse.discount_price !== null && activeCourse.discount_price !== undefined
        ? String(activeCourse.discount_price)
        : '';

    const savedFree = Boolean(
      activeCourse.isFree !== undefined ? activeCourse.isFree : activeCourse.is_free,
    );
    const savedOutcomes = activeCourse.learningOutcomes ?? activeCourse.learning_outcomes ?? [];
    const savedReqs = activeCourse.requirements ?? [];
    const savedTarget = activeCourse.targetAudience || activeCourse.target_audience || '';
    const savedThumb = activeCourse.thumbnailUrl || activeCourse.thumbnail_url || '';
    const savedPromo = activeCourse.promoVideoAssetId || activeCourse.promo_video_asset_id || '';

    return (
      title !== (activeCourse.title || '') ||
      subtitle !== (activeCourse.subtitle || '') ||
      description !== (activeCourse.description || '') ||
      categoryId !== (activeCourse.categoryId || activeCourse.category_id || '') ||
      level !== (activeCourse.level || 'all_levels') ||
      language !== (activeCourse.language || 'English') ||
      isFree !== savedFree ||
      price !== savedPrice ||
      discountPrice !== savedDiscount ||
      currency !== (activeCourse.currency || 'INR') ||
      thumbnailUrl !== savedThumb ||
      promoVideoAssetId !== savedPromo ||
      targetAudience !== savedTarget ||
      JSON.stringify(learningOutcomes) !== JSON.stringify(savedOutcomes) ||
      JSON.stringify(requirements) !== JSON.stringify(savedReqs)
    );
  }, [
    activeCourse,
    title,
    subtitle,
    description,
    categoryId,
    level,
    language,
    isFree,
    price,
    discountPrice,
    currency,
    thumbnailUrl,
    promoVideoAssetId,
    targetAudience,
    learningOutcomes,
    requirements,
  ]);

  // Real-time Live Checklist Evaluation (evaluates what the user has actively filled in the form)
  const liveChecklistItems = useMemo(() => {
    const numPrice = parseFloat(price) || 0;
    const numDiscount = discountPrice.trim() !== '' ? parseFloat(discountPrice) : null;

    const titleOk = title.trim().length >= 10;
    const subtitleOk = subtitle.trim().length > 0;
    const descOk = description.trim().length >= 200;
    const catOk = Boolean(categoryId);
    const levelLangOk = Boolean(level && language);
    const outcomesCount = learningOutcomes.filter((o) => o && o.trim().length > 0).length;
    const outcomesOk = outcomesCount >= 4;
    const thumbnailOk = Boolean(thumbnailUrl.trim().length > 0);
    const pricingOk = isFree || numPrice > 0;
    const promoOk = Boolean(promoVideoAssetId && promoVideoAssetId.trim().length > 0);
    const curriculumOk = checklist?.items?.find((i) => i.key === 'curriculum')?.ok ?? false;

    return [
      {
        key: 'title',
        ok: titleOk,
        label: 'Course Title',
        message: titleOk
          ? `Title is set (${title.trim().length} chars).`
          : 'Must be at least 10 characters.',
      },
      {
        key: 'subtitle',
        ok: subtitleOk,
        label: 'Subtitle',
        message: subtitleOk ? 'Subtitle is present.' : 'Course subtitle is required.',
      },
      {
        key: 'description',
        ok: descOk,
        label: 'Description',
        message: descOk
          ? `Detailed description meets requirement (${description.trim().length} / 200 chars).`
          : `Must be at least 200 characters (currently ${description.trim().length}).`,
      },
      {
        key: 'category',
        ok: catOk,
        label: 'Category',
        message: catOk ? 'Category is selected and active.' : 'Academic category selection is required.',
      },
      {
        key: 'level_language',
        ok: levelLangOk,
        label: 'Level & Language',
        message: levelLangOk
          ? `Level (${level}) and language (${language}) are configured.`
          : 'Level and instruction language must both be set.',
      },
      {
        key: 'outcomes',
        ok: outcomesOk,
        label: 'Learning Outcomes',
        message: outcomesOk
          ? `${outcomesCount} learning outcomes specified (requirement met).`
          : `At least 4 learning outcomes required (currently ${outcomesCount}).`,
      },
      {
        key: 'thumbnail',
        ok: thumbnailOk,
        label: 'Course Thumbnail',
        message: thumbnailOk ? 'Thumbnail image is uploaded.' : 'Course thumbnail image is required.',
      },
      {
        key: 'pricing',
        ok: pricingOk,
        label: 'Pricing Configuration',
        message: isFree
          ? 'Configured as free access.'
          : numPrice > 0
          ? `Price set to ${currency} ${numPrice}${numDiscount ? ` (Sale: ${currency} ${numDiscount})` : ''}.`
          : 'Paid courses must have a price greater than 0.',
      },
      {
        key: 'promo_video',
        ok: promoOk,
        label: 'Promotional Video (Trailer)',
        message: promoOk
          ? 'Promotional video trailer is uploaded and attached.'
          : 'Promotional video trailer is required before submitting.',
      },
      {
        key: 'curriculum',
        ok: curriculumOk,
        label: 'Curriculum & Lessons',
        message: curriculumOk
          ? 'Active section with published lessons present.'
          : 'Must have at least one active section with an active lesson (created via Curriculum Builder).',
      },
    ];
  }, [
    title,
    subtitle,
    description,
    categoryId,
    level,
    language,
    learningOutcomes,
    thumbnailUrl,
    isFree,
    price,
    discountPrice,
    currency,
    promoVideoAssetId,
    checklist,
  ]);

  const liveReadyCount = liveChecklistItems.filter((i) => i.ok).length;
  const isLiveReady = liveReadyCount === 10;

  if (isLoading || !activeCourse) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center text-muted">
        <div className="w-8 h-8 border-3 border-teal border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-sm font-semibold">Loading course editor...</span>
      </div>
    );
  }

  const isPublished = activeCourse.status === 'published';
  const isLocked = !isAdmin && (!isAuthor || (activeCourse.status !== 'draft' && activeCourse.status !== 'rejected' && !isPublished));

  // --- Dynamic Array Handlers ---
  const handleAddOutcome = (e) => {
    e?.preventDefault();
    if (newOutcome.trim()) {
      setLearningOutcomes([...learningOutcomes, newOutcome.trim()]);
      setNewOutcome('');
    }
  };

  const handleRemoveOutcome = (idx) => {
    setLearningOutcomes(learningOutcomes.filter((_, i) => i !== idx));
  };

  const handleAddRequirement = (e) => {
    e?.preventDefault();
    if (newRequirement.trim()) {
      setRequirements([...requirements, newRequirement.trim()]);
      setNewRequirement('');
    }
  };

  const handleRemoveRequirement = (idx) => {
    setRequirements(requirements.filter((_, i) => i !== idx));
  };

  // --- Thumbnail Image Upload Handler ---
  const handleThumbnailUpload = async (file) => {
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
      setFormError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image size exceeds 5MB limit.');
      return;
    }

    setIsUploadingThumbnail(true);
    setFormError('');
    try {
      const res = await courseService.uploadThumbnail(file);
      if (res?.url) {
        setThumbnailUrl(res.url);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to upload thumbnail image.');
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  // --- Video File Selection & Direct Upload Handler ---
  const handleVideoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^video\/(mp4|webm|quicktime|x-matroska|ogg)/i)) {
      setFormError('Please select a valid video file (MP4, WebM, MOV, MKV).');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setFormError('Video file size exceeds maximum 500MB limit.');
      return;
    }

    // Immediate local preview for responsive UX
    const tempUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(tempUrl);
    setUploadedVideoFile(file);
    setIsUploadingVideo(true);
    setVideoUploadProgress(0);
    setFormError('');

    try {
      const res = await courseService.uploadPromoVideo(courseId, file, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setVideoUploadProgress(percent);
        }
      });

      if (res?.assetId) {
        setPromoVideoAssetId(res.assetId);
        if (res.url) {
          setVideoPreviewUrl(res.url);
        }
        await fetchCourseById(courseId);
        await fetchChecklist(courseId);
      }
    } catch (err) {
      console.error('Failed to upload promotional video:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to upload promotional video.');
      setVideoPreviewUrl('');
      setUploadedVideoFile(null);
      setPromoVideoAssetId('');
    } finally {
      setIsUploadingVideo(false);
      setVideoUploadProgress(0);
    }
  };

  const handleRemovePromoVideo = async () => {
    if (isLocked) return;
    setUploadedVideoFile(null);
    setVideoPreviewUrl('');
    setPromoVideoAssetId('');
    try {
      await updateCourse(courseId, { promoVideoAssetId: null });
      await fetchCourseById(courseId);
      await fetchChecklist(courseId);
    } catch (err) {
      console.error('Failed to unlink promo video:', err);
    }
  };

  const handleOpenSubmit = () => {
    if (!promoVideoAssetId || !promoVideoAssetId.trim()) {
      setFormError('Course promotional video trailer is mandatory before submitting for platform review.');
      setActiveTab('media');
      return;
    }
    openSubmitModal(courseId, activeCourse.title);
  };

  // --- Save / Submit Handler ---
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setFormError('');
    clearAlerts();

    if (isLocked) {
      setFormError(`Course is locked while in status "${activeCourse.status}". Cannot edit.`);
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length < 2) {
      setFormError('Course title must be at least 2 characters.');
      return;
    }

    const numericPrice = parseFloat(price) || 0;
    const numericDiscount = discountPrice.trim() !== '' ? parseFloat(discountPrice) : null;

    if (!isFree) {
      if (numericPrice <= 0) {
        setFormError('Paid courses must have a price greater than 0.');
        setActiveTab('pricing');
        return;
      }
      if (numericDiscount !== null) {
        if (numericDiscount < 0) {
          setFormError('Discount price cannot be negative.');
          setActiveTab('pricing');
          return;
        }
        if (numericDiscount >= numericPrice) {
          setFormError('Discount price must be lower than the standard price.');
          setActiveTab('pricing');
          return;
        }
      }
    }

    // Valid UUID v4 check helper
    const isUuid = (val) =>
      typeof val === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val.trim());

    const validPromoAssetId =
      promoVideoAssetId && isUuid(promoVideoAssetId) ? promoVideoAssetId.trim() : null;

    const payload = {
      title: trimmedTitle,
      subtitle: subtitle.trim() || null,
      description: description.trim() || null,
      categoryId: categoryId || null,
      level,
      language: language.trim() || 'English',
      isFree,
      price: isFree ? 0 : numericPrice,
      discountPrice: isFree ? null : numericDiscount,
      currency: currency.trim().toUpperCase() || 'INR',
      isRefundable: isFree ? false : isRefundable,
      refundPeriodDays: isFree ? 0 : isRefundable ? Number(refundPeriodDays) : 0,
      thumbnailUrl: thumbnailUrl.trim() || null,
      promoVideoAssetId: validPromoAssetId,
      targetAudience: targetAudience.trim() || null,
      learningOutcomes,
      requirements,
    };

    try {
      const updated = await updateCourse(courseId, payload);
      // A title change regenerates the slug on drafts, so keep the URL in sync
      const newSlug = updated?.slug || useCourseStore.getState().activeCourse?.slug;
      if (newSlug && newSlug !== courseRef) {
        slugRewriteRef.current = newSlug;
        router.replace(`/dashboard/${role}/courses/${newSlug}`);
      }
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Bar with Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/${role}/courses`}
            className="p-2 border border-line rounded-xl text-muted hover:text-ink hover:bg-cream transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted">/{activeCourse.slug}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                  activeCourse.status === 'draft'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : activeCourse.status === 'published'
                    ? 'bg-teal-50 text-teal border-teal/30'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {activeCourse.status?.replace('_', ' ')}
              </span>
            </div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-ink truncate max-w-xl">
              {activeCourse.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* History Icon Button */}
          <button
            type="button"
            onClick={() => openHistoryModal(courseId, activeCourse.title)}
            className="p-2 border border-line rounded-lg text-muted hover:text-ink hover:bg-cream transition-colors cursor-pointer"
            title="View status audit history"
          >
            <History size={16} />
          </button>

          {/* Readiness Pill (Reflects live readiness score in real-time) */}
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
              isLiveReady
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title="Click to view submission readiness checklist"
          >
            <CheckCircle2 size={14} className={isLiveReady ? 'text-emerald-600' : 'text-amber-600'} />
            <span>Ready: {liveReadyCount}/10</span>
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLocked}
            className={`px-4 py-2 text-white rounded-lg text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer ${
              isDirty
                ? 'bg-teal hover:bg-teal-dark ring-2 ring-teal/30 animate-pulse'
                : 'bg-ink hover:bg-ink/90'
            }`}
          >
            <Save size={15} />
            <span>{isSaving ? 'Saving...' : isDirty ? 'Save Changes *' : 'Saved'}</span>
          </button>

          {/* Submit for Review Button (Draft or Rejected) - ONLY for author */}
          {isAuthor && (activeCourse.status === 'draft' || activeCourse.status === 'rejected') && (
            <button
              type="button"
              onClick={handleOpenSubmit}
              className="px-4 py-2 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              title="Submit course to platform reviewers"
            >
              <Send size={14} />
              <span>Submit for Review</span>
            </button>
          )}

          {/* Withdraw Submission Button (Pending Review) - ONLY for author */}
          {isAuthor && activeCourse.status === 'pending_review' && (
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={isApprovalLoading}
              className="px-4 py-2 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 rounded-lg text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Withdraw submission back to draft"
            >
              <RotateCcw size={14} />
              <span>{isApprovalLoading ? 'Withdrawing...' : 'Withdraw'}</span>
            </button>
          )}

          {/* Admin Direct Publish Action (Can directly publish from draft, pending_review, or approved without approval) */}
          {isAdmin && activeCourse.status !== 'published' && activeCourse.status !== 'archived' && (
            <button
              type="button"
              onClick={handlePublishCourse}
              disabled={isApprovalLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Publish course directly to catalogue without approval"
            >
              <Globe size={14} />
              <span>{isApprovalLoading ? 'Publishing...' : 'Publish Course'}</span>
            </button>
          )}

          {/* Admin Unpublish / Archive Action */}
          {isAdmin && activeCourse.status === 'published' && (
            <button
              type="button"
              onClick={handleArchiveCourse}
              disabled={isApprovalLoading}
              className="px-3.5 py-2 bg-paper border border-line text-slate-700 hover:bg-slate-100 rounded-lg text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Unpublish course and move to archive"
            >
              <Archive size={14} />
              <span>{isApprovalLoading ? 'Archiving...' : 'Unpublish / Archive'}</span>
            </button>
          )}

          {/* Admin Review Submission Button (Pending Review) - ONLY for Admin / Reviewer */}
          {!isAuthor && isAdmin && activeCourse.status === 'pending_review' && (
            <button
              type="button"
              onClick={() => openReviewModal(courseId)}
              className="px-4 py-2 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Review submission details and approve or reject"
            >
              <FileCheck size={14} />
              <span>Review Submission</span>
            </button>
          )}
        </div>
      </div>

      {/* Rejection Alert Banner if status is rejected */}
      {activeCourse.status === 'rejected' && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-900 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-rose-800">
            <AlertTriangle size={16} className="text-rose-600 flex-shrink-0" />
            <span>Course Submission Returned for Revision:</span>
          </div>
          <div className="pl-6 text-xs text-rose-800 font-medium italic bg-white/70 p-3 rounded-lg border border-rose-200/60 leading-relaxed">
            "{activeCourse.rejectionReason || activeCourse.rejection_reason || 'Revisions required by platform reviewer before approval.'}"
          </div>
          <p className="text-[11px] text-rose-700 pl-6">
            Please make the requested adjustments above, click <strong>Save Changes</strong>, and then <strong>Submit for Review</strong> when complete.
          </p>
        </div>
      )}

      {/* Live Published Info Banner */}
      {isPublished && (
        <div className="bg-teal-50 border border-teal/30 rounded-xl p-3.5 text-xs text-teal-dark flex items-center gap-2.5">
          <Info size={16} className="text-teal flex-shrink-0" />
          <span>
            This course is currently <strong>Published</strong>. Metadata edits saved here will take effect immediately without changing course publication status or disrupting existing student enrollments.
          </span>
        </div>
      )}

      {/* Edit Lock Banner if non-draft */}
      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 flex items-center gap-2.5">
          <Lock size={16} className="text-amber-600 flex-shrink-0" />
          <span>
            This course is currently in <strong className="uppercase">{activeCourse.status}</strong> status. Edits are locked to preserve submission review integrity.
          </span>
        </div>
      )}

      {/* Global Alerts */}
      {(formError || error) && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-700 flex items-center gap-2.5">
          <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
          <span>{formError || error}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800 flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tab Selector */}
      <div className="flex items-center gap-1.5 border-b border-line overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-paper text-teal border border-line shadow-xs'
                  : 'text-muted hover:text-ink hover:bg-cream/60'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-teal' : 'text-muted'} />
              <span>{tab.label}</span>
              {tab.id === 'checklist' && (
                <span className="w-2 h-2 rounded-full bg-coral" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-paper border border-line rounded-2xl p-6 sm:p-7 shadow-sm">
        {/* TAB 1: BASIC INFO */}
        {activeTab === 'basics' && (
          <div className="space-y-5 max-w-3xl">
            <div>
              <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                Course Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLocked}
                maxLength={200}
                className="w-full px-3.5 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink outline-none focus:border-teal focus:ring-1 focus:ring-teal/30 disabled:bg-cream/50"
              />
              <span className="text-[10px] text-muted block mt-1">
                At least 10 characters required for submission readiness.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                Subtitle
              </label>
              <input
                type="text"
                placeholder="A compelling 1-line hook explaining what students will achieve..."
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                disabled={isLocked}
                maxLength={300}
                className="w-full px-3.5 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink outline-none focus:border-teal focus:ring-1 focus:ring-teal/30 disabled:bg-cream/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                rows={6}
                placeholder="Comprehensive course overview, syllabus highlights, and who should take this course (at least 200 characters)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLocked}
                className="w-full px-3.5 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink outline-none focus:border-teal focus:ring-1 focus:ring-teal/30 resize-y disabled:bg-cream/50"
              />
              <div className="flex justify-between items-center text-[10px] text-muted mt-1">
                <span>Detailed course description.</span>
                <span className={description.trim().length >= 200 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                  {description.trim().length} / 200 chars min
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={isLocked}
                  className="w-full px-3 py-2 bg-paper border border-line rounded-lg text-xs font-semibold text-ink outline-none focus:border-teal disabled:bg-cream/50 cursor-pointer"
                >
                  <option value="">— Select Category —</option>
                  {categories.map((c) => {
                    const cId = c.categoryId || c.category_id;
                    return (
                      <option key={cId} value={cId}>
                        {c.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                  Difficulty Level
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  disabled={isLocked}
                  className="w-full px-3 py-2 bg-paper border border-line rounded-lg text-xs font-semibold text-ink outline-none focus:border-teal disabled:bg-cream/50 cursor-pointer"
                >
                  <option value="all_levels">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              {/* Dynamic Instruction Language Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                    Instruction Language
                  </label>
                  {role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => setIsLanguageModalOpen(true)}
                      className="text-[11px] text-teal hover:text-teal-dark font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Manage global instruction languages"
                    >
                      <Globe size={12} />
                      <span>Manage</span>
                    </button>
                  )}
                </div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={isLocked}
                  className="w-full px-3 py-2 bg-paper border border-line rounded-lg text-xs font-semibold text-ink outline-none focus:border-teal disabled:bg-cream/50 cursor-pointer"
                >
                  {languages.length > 0 ? (
                    languages.map((l) => (
                      <option key={l.languageId || l.code} value={l.name}>
                        {l.name} {l.nativeName && l.nativeName !== l.name ? `(${l.nativeName})` : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="English">English</option>
                      <option value="Tamil">Tamil (தமிழ்)</option>
                      <option value="Hindi">Hindi (हिन्दी)</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OUTCOMES & REQUIREMENTS */}
        {activeTab === 'curriculum_meta' && (
          <div className="space-y-6 max-w-3xl">
            {/* Learning Outcomes */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-ink uppercase tracking-wider">
                  What will students learn? (Outcomes)
                </label>
                <span className={`text-[11px] font-bold ${learningOutcomes.length >= 4 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {learningOutcomes.length} of 4 minimum
                </span>
              </div>
              <p className="text-xs text-muted mb-3">
                List the core competencies, skills, or projects students will master upon completion.
              </p>

              {!isLocked && (
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="e.g. Build enterprise-grade backend APIs with NestJS"
                    value={newOutcome}
                    onChange={(e) => setNewOutcome(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddOutcome(e)}
                    className="w-full px-3.5 py-2 bg-paper border border-line rounded-lg text-xs text-ink outline-none focus:border-teal"
                  />
                  <button
                    type="button"
                    onClick={handleAddOutcome}
                    className="px-3.5 py-2 bg-cream hover:bg-cream/80 border border-line text-ink rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {learningOutcomes.map((outcome, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-line/70 bg-cream/30 flex items-center justify-between gap-2 text-xs text-ink"
                  >
                    <span className="flex-1">{outcome}</span>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOutcome(idx)}
                        className="text-muted hover:text-rose-600 p-1 cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div className="pt-4 border-t border-line/60">
              <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                Prerequisites & Requirements
              </label>
              <p className="text-xs text-muted mb-3">
                Any tools, prior experience, or software needed before taking this course.
              </p>

              {!isLocked && (
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="e.g. Basic knowledge of JavaScript and HTML"
                    value={newRequirement}
                    onChange={(e) => setNewRequirement(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddRequirement(e)}
                    className="w-full px-3.5 py-2 bg-paper border border-line rounded-lg text-xs text-ink outline-none focus:border-teal"
                  />
                  <button
                    type="button"
                    onClick={handleAddRequirement}
                    className="px-3.5 py-2 bg-cream hover:bg-cream/80 border border-line text-ink rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {requirements.map((req, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-line/70 bg-cream/30 flex items-center justify-between gap-2 text-xs text-ink"
                  >
                    <span className="flex-1">{req}</span>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRequirement(idx)}
                        className="text-muted hover:text-rose-600 p-1 cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Target Audience */}
            <div className="pt-4 border-t border-line/60">
              <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                Target Audience
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Aspiring full-stack engineers, frontend developers migrating to backend..."
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                disabled={isLocked}
                className="w-full px-3.5 py-2 bg-paper border border-line rounded-lg text-xs text-ink outline-none focus:border-teal disabled:bg-cream/50 resize-y"
              />
            </div>
          </div>
        )}

        {/* TAB 3: PRICING & ACCESS (Restyled with Clean Inputs & Currency Prefixes) */}
        {activeTab === 'pricing' && (
          <div className="space-y-5 max-w-xl">
            {/* Free vs Paid Toggle */}
            <div className="p-4 rounded-xl border border-line bg-cream/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                  Course Access Type
                </span>
                <p className="text-xs text-muted mt-0.5">
                  {isFree
                    ? 'Free course. Anyone enrolled can view content without paying.'
                    : 'Paid commercial course. Students must purchase to unlock access.'}
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFree}
                  onChange={(e) => setIsFree(e.target.checked)}
                  disabled={isLocked}
                  className="w-4 h-4 rounded text-teal accent-teal cursor-pointer"
                />
                <span className="text-xs font-bold text-ink">Free Access</span>
              </label>
            </div>

            {!isFree && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 items-start">
                {/* Currency */}
                <div>
                  <label className="flex items-center text-xs font-bold text-ink uppercase tracking-wider mb-1.5 h-5">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    disabled={isLocked}
                    className="w-full h-10 px-3 bg-paper border border-line rounded-lg text-xs font-bold text-ink outline-none focus:border-teal cursor-pointer"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>

                {/* Base Price */}
                <div>
                  <label className="flex items-center justify-between text-xs font-bold text-ink uppercase tracking-wider mb-1.5 h-5">
                    <span>Base Price</span>
                    <span className="text-red-500 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted pointer-events-none">
                      {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£'}
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      disabled={isLocked}
                      placeholder="999"
                      className="w-full h-10 pl-8 pr-3 bg-paper border border-line rounded-lg text-xs font-bold text-ink outline-none focus:border-teal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <span className="text-[10px] text-muted block mt-1">Must be &gt; 0</span>
                </div>

                {/* Discount Price */}
                <div>
                  <label className="flex items-center justify-between text-xs font-bold text-ink uppercase tracking-wider mb-1.5 h-5">
                    <span>Discount</span>
                    <span className="text-[10px] text-muted font-normal lowercase">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted pointer-events-none">
                      {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountPrice}
                      onChange={(e) => setDiscountPrice(e.target.value)}
                      disabled={isLocked}
                      placeholder="499"
                      className="w-full h-10 pl-8 pr-3 bg-paper border border-line rounded-lg text-xs font-bold text-ink outline-none focus:border-teal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <span className="text-[10px] text-muted block mt-1">Must be &lt; Base Price</span>
                </div>
              </div>
            )}

            {/* Dynamic Refund & Guarantee Policy (Udemy Model) */}
            {!isFree && (
              <div className="pt-4 border-t border-line/70 space-y-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <RotateCcw size={15} className="text-teal" />
                    <span className="text-xs font-bold text-ink uppercase tracking-wider">
                      Money-Back Guarantee & Refund Policy
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Control student refund eligibility for this course. Follows Udemy&apos;s 30-day money-back guarantee model with automated anti-abuse fraud protection.
                  </p>
                </div>

                {/* Refund Toggle & Window Selector */}
                <div className="p-4 rounded-xl border border-line bg-cream/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-ink block">
                        Allow Student Refunds
                      </span>
                      <p className="text-[11px] text-muted mt-0.5">
                        {isRefundable
                          ? 'Students can request a refund within the configured window.'
                          : 'Course is marked as non-refundable. Refund requests will be automatically blocked.'}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRefundable}
                        onChange={(e) => setIsRefundable(e.target.checked)}
                        disabled={isLocked}
                        className="w-4 h-4 rounded text-teal accent-teal cursor-pointer"
                      />
                      <span className="text-xs font-bold text-ink">
                        {isRefundable ? 'Refunds Allowed' : 'Non-Refundable'}
                      </span>
                    </label>
                  </div>

                  {isRefundable ? (
                    <div className="pt-3 border-t border-line/60 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                          Guarantee Period Window
                        </label>
                        <select
                          value={refundPeriodDays}
                          onChange={(e) => setRefundPeriodDays(Number(e.target.value))}
                          disabled={isLocked}
                          className="w-full max-w-xs h-10 px-3 bg-paper border border-line rounded-lg text-xs font-bold text-ink outline-none focus:border-teal cursor-pointer"
                        >
                          <option value={30}>30 Days (Standard Udemy Guarantee)</option>
                          <option value={14}>14 Days (Short Window)</option>
                          <option value={7}>7 Days (Limited Window)</option>
                        </select>
                      </div>

                      {/* Anti-Abuse Protection Badge */}
                      <div className="p-3 rounded-lg border border-teal-200 bg-teal-50/70 text-teal-900 flex items-start gap-2.5">
                        <ShieldCheck size={16} className="text-teal-700 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-relaxed">
                          <span className="font-bold">Udemy Anti-Abuse Protection Active: </span>
                          Refunds are automatically disqualified if a student completes <strong>50% or more</strong> of the course curriculum. This prevents content scraping and protects instructor revenue.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/70 text-amber-900 flex items-start gap-2.5">
                      <ShieldAlert size={16} className="text-amber-700 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <span className="font-bold">Non-refundable Notice: </span>
                        This course will display a &quot;Non-refundable&quot; badge on course details, checkout, and invoices. Students will not see refund options.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Course Promotional Coupon Section */}
            {!isFree && (
              <div className="pt-4 border-t border-line/70 space-y-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Tag size={15} className="text-teal" />
                    <span className="text-xs font-bold text-ink uppercase tracking-wider">
                      Course Promotional Coupon
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Apply an existing admin promotional coupon or propose a custom discount code for this course. Proposed coupons are sent for review and activated upon admin approval.
                  </p>
                </div>

                {couponSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
                    <span>{couponSuccess}</span>
                  </div>
                )}

                {couponError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle size={15} className="text-rose-500 flex-shrink-0" />
                    <span>{couponError}</span>
                  </div>
                )}

                {loadingCoupon ? (
                  <div className="text-xs text-muted py-2">Checking course coupon status...</div>
                ) : courseCoupon ? (
                  /* Attached Coupon Card */
                  <div className="p-4 rounded-xl border border-line bg-cream/30 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-paper border border-line text-ink">
                          {courseCoupon.code}
                        </span>
                        <span className="text-xs font-bold text-teal">
                          {courseCoupon.discount_type === 'percentage'
                            ? `${Number(courseCoupon.discount_value)}% OFF`
                            : `₹${Number(courseCoupon.discount_value)} OFF`}
                        </span>
                      </div>

                      {courseCoupon.is_active ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Active · Live for Students
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Pending Approval · Sent with Review
                        </span>
                      )}
                    </div>

                    {courseCoupon.description && (
                      <p className="text-xs text-muted">{courseCoupon.description}</p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-line/60">
                      <span>
                        Usage: {courseCoupon.used_count || 0} / {courseCoupon.usage_limit || '∞'}
                        {courseCoupon.valid_until && ` · Exp: ${new Date(courseCoupon.valid_until).toLocaleDateString()}`}
                      </span>

                      {!isLocked && (
                        <button
                          type="button"
                          onClick={handleRemoveCourseCoupon}
                          disabled={savingCoupon}
                          className="text-red-600 hover:text-red-700 font-bold cursor-pointer"
                        >
                          {savingCoupon ? 'Removing...' : 'Remove Coupon'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : !isLocked ? (
                  /* Mode Selector to apply Admin Coupon or propose new */
                  <div className="p-4 rounded-xl border border-line bg-cream/20 space-y-3">
                    <div className="flex rounded-lg border border-line bg-paper p-0.5 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setCouponMode('admin');
                          setCouponError('');
                        }}
                        className={`flex-1 py-1.5 rounded-md text-center transition cursor-pointer ${
                          couponMode === 'admin' ? 'bg-teal text-white shadow-xs' : 'text-muted hover:text-ink'
                        }`}
                      >
                        Apply Admin Coupon
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCouponMode('custom');
                          setCouponError('');
                        }}
                        className={`flex-1 py-1.5 rounded-md text-center transition cursor-pointer ${
                          couponMode === 'custom' ? 'bg-teal text-white shadow-xs' : 'text-muted hover:text-ink'
                        }`}
                      >
                        Propose New Coupon
                      </button>
                    </div>

                    {couponMode === 'admin' ? (
                      /* Option A: Admin Coupons */
                      <div className="space-y-3 pt-1">
                        {adminCoupons.length === 0 ? (
                          <p className="text-xs text-muted">
                            No active admin-created coupons available right now.
                          </p>
                        ) : (
                          <>
                            <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                              Select Admin Promotional Coupon
                            </label>
                            <select
                              value={selectedAdminCouponId}
                              onChange={(e) => setSelectedAdminCouponId(e.target.value)}
                              className="w-full h-10 px-3 bg-paper border border-line rounded-lg text-xs font-bold text-ink outline-none focus:border-teal cursor-pointer"
                            >
                              {adminCoupons.map((c) => (
                                <option key={c.coupon_id} value={c.coupon_id}>
                                  {c.code} ({c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}) — {c.description || 'Platform Promotion'}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={handleApplyAdminCoupon}
                              disabled={savingCoupon || !selectedAdminCouponId}
                              className="px-4 py-2 rounded-lg bg-teal text-white text-xs font-bold transition hover:bg-teal-dark disabled:opacity-50 cursor-pointer"
                            >
                              {savingCoupon ? 'Applying...' : 'Apply Coupon to Course'}
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      /* Option B: Propose Custom Coupon */
                      <form onSubmit={handleProposeCustomCoupon} className="space-y-3 pt-1">
                        <div>
                          <label className="flex items-center justify-between text-xs font-bold text-ink uppercase tracking-wider mb-1">
                            <span>Coupon Code</span>
                            <button
                              type="button"
                              onClick={() => {
                                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                                let rand = '';
                                for (let i = 0; i < 4; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
                                setNewCouponCode(`SAVE-${rand}`);
                              }}
                              className="text-[11px] text-teal font-bold hover:underline cursor-pointer"
                            >
                              + Generate
                            </button>
                          </label>
                          <input
                            type="text"
                            value={newCouponCode}
                            onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                            placeholder="e.g. REACT50"
                            maxLength={30}
                            required
                            className="w-full h-10 px-3 bg-paper border border-line rounded-lg text-xs font-mono font-bold text-ink uppercase outline-none focus:border-teal"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                              Discount Type
                            </label>
                            <select
                              value={newCouponType}
                              onChange={(e) => setNewCouponType(e.target.value)}
                              className="w-full h-10 px-3 bg-paper border border-line rounded-lg text-xs font-bold text-ink outline-none focus:border-teal cursor-pointer"
                            >
                              <option value="percentage">% Percentage Off</option>
                              <option value="fixed">₹ Fixed Amount Off</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                              {newCouponType === 'percentage' ? 'Percent (%)' : 'Amount (₹)'}
                            </label>
                            <input
                              type="number"
                              min="0.01"
                              max={newCouponType === 'percentage' ? '100' : '99999'}
                              step="any"
                              value={newCouponValue}
                              onChange={(e) => setNewCouponValue(e.target.value)}
                              placeholder={newCouponType === 'percentage' ? '50' : '500'}
                              required
                              className="w-full h-10 px-3 bg-paper border border-line rounded-lg text-xs font-bold text-ink outline-none focus:border-teal"
                            />
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-paper border border-line text-[11px] text-muted space-y-1">
                          <p className="font-bold text-ink flex items-center gap-1">
                            <Info size={12} className="text-teal" />
                            Approval Workflow Notice
                          </p>
                          <p>
                            This coupon is created with status <strong>Pending Approval</strong>. When you click <strong>Submit for Review</strong>, platform admins will review both your course and this promotional coupon. Upon admin approval, the coupon will be automatically activated.
                          </p>
                        </div>

                        <button
                          type="submit"
                          disabled={savingCoupon || !newCouponCode || !newCouponValue}
                          className="px-4 py-2 rounded-lg bg-teal text-white text-xs font-bold transition hover:bg-teal-dark disabled:opacity-50 cursor-pointer"
                        >
                          {savingCoupon ? 'Proposing...' : 'Save Proposed Coupon'}
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    No promotional coupon is attached to this course.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MEDIA & ASSETS (Includes Interactive Video Dropzone & Preview) */}
        {activeTab === 'media' && (
          <div className="space-y-6 max-w-2xl">
            {/* Thumbnail Upload Section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-ink uppercase tracking-wider">
                  Course Thumbnail (Cover Image)
                </label>
                {!isLocked && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowThumbnailUrlInput(!showThumbnailUrlInput)}
                      className="text-[11px] text-muted hover:text-ink font-semibold cursor-pointer"
                    >
                      {showThumbnailUrlInput ? 'Hide URL input' : 'Enter image URL'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setThumbnailUrl(
                          'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800'
                        )
                      }
                      className="text-[11px] text-teal hover:text-teal-dark font-bold cursor-pointer"
                    >
                      + Sample Cover
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted mb-3">
                The primary 16:9 banner displayed on student course cards, search catalogs, and the course header.
              </p>

              {/* Hidden Image File Input */}
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleThumbnailUpload(file);
                }}
                className="hidden"
                disabled={isLocked}
              />

              {!thumbnailUrl ? (
                /* Interactive Image Dropzone */
                <div
                  onClick={() => !isLocked && !isUploadingThumbnail && thumbnailInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isLocked || isUploadingThumbnail) return;
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleThumbnailUpload(file);
                  }}
                  className={`border-2 border-dashed border-line rounded-2xl p-6 text-center transition-all ${
                    isLocked || isUploadingThumbnail
                      ? 'bg-cream/40 cursor-not-allowed'
                      : 'hover:border-teal hover:bg-cream/30 cursor-pointer'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-cream border border-line flex items-center justify-center text-teal mx-auto mb-2">
                    {isUploadingThumbnail ? (
                      <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ImageIcon size={22} />
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-ink">
                    {isUploadingThumbnail ? 'Uploading thumbnail to storage...' : 'Click to upload or drag & drop course thumbnail'}
                  </h4>
                  <p className="text-[11px] text-muted mt-0.5">
                    Supports PNG, JPG, or WebP (Recommended 16:9 ratio, max 5MB)
                  </p>
                </div>
              ) : (
                /* Thumbnail Preview Card */
                <div className="rounded-2xl border border-line overflow-hidden bg-ink/5 p-3">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-cream mb-2 max-w-md">
                    <img
                      src={thumbnailUrl}
                      alt="Course thumbnail cover"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs px-1">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold min-w-0">
                      <CheckCircle2 size={15} className="flex-shrink-0" />
                      <span className="truncate max-w-xs">{thumbnailUrl}</span>
                    </div>
                    {!isLocked && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => thumbnailInputRef.current?.click()}
                          className="text-xs text-teal hover:text-teal-dark font-bold cursor-pointer"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => setThumbnailUrl('')}
                          className="text-xs text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Optional Manual URL Input */}
              {showThumbnailUrlInput && (
                <div className="mt-3">
                  <input
                    type="url"
                    placeholder="Or paste direct image URL (e.g. https://images.unsplash.com/...)"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    disabled={isLocked}
                    className="w-full px-3.5 py-2 bg-paper border border-line rounded-lg text-xs text-ink outline-none focus:border-teal"
                  />
                </div>
              )}
            </div>

            {/* Promotional Video Upload Section */}
            <div className="pt-4 border-t border-line/60">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-ink uppercase tracking-wider">
                  Course Promotional Video (Trailer) *
                </label>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                  Required
                </span>
              </div>
              <p className="text-xs text-muted mb-3">
                Upload a short 1-2 minute video trailer introducing your course to prospective students on the public landing page. This promotional trailer is mandatory for platform review.
              </p>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                onChange={handleVideoFileChange}
                className="hidden"
                disabled={isLocked || isUploadingVideo}
              />

              {/* Upload Progress Bar */}
              {isUploadingVideo ? (
                <div className="border border-teal/40 bg-teal/5 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center text-teal mx-auto animate-pulse">
                    <Upload size={22} />
                  </div>
                  <h4 className="text-xs font-bold text-ink">
                    Uploading Promotional Trailer ({videoUploadProgress}%)...
                  </h4>
                  <div className="w-full max-w-xs mx-auto h-2 rounded-full bg-line/60 overflow-hidden">
                    <div
                      className="h-full bg-teal transition-all duration-150"
                      style={{ width: `${videoUploadProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted">
                    Storing video and registering platform media asset...
                  </p>
                </div>
              ) : !videoPreviewUrl ? (
                /* Video Dropzone */
                <div
                  onClick={() => !isLocked && fileInputRef.current?.click()}
                  className={`border-2 border-dashed border-line rounded-2xl p-6 text-center transition-all ${
                    isLocked
                      ? 'bg-cream/40 cursor-not-allowed'
                      : 'hover:border-teal hover:bg-cream/30 cursor-pointer'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-cream border border-line flex items-center justify-center text-teal mx-auto mb-2">
                    <Upload size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-ink">
                    Click to upload promotional video
                  </h4>
                  <p className="text-[11px] text-muted mt-0.5">
                    Supports MP4, WebM, or MOV format (Recommended 1080p, up to 500MB)
                  </p>
                </div>
              ) : (
                /* Video Player Preview */
                <div className="rounded-2xl border border-line overflow-hidden bg-ink/5 p-3">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-black mb-2">
                    <video
                      key={videoPreviewUrl}
                      src={videoPreviewUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs px-1">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                      <CheckCircle2 size={15} />
                      <span>{uploadedVideoFile?.name || activeCourse?.promoVideo?.title || 'Promotional Trailer Ready'}</span>
                    </div>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={handleRemovePromoVideo}
                        className="text-xs text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Educational Guidance for Curriculum Lessons */}
              <div className="mt-4 p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 flex items-start gap-2.5 text-xs text-blue-900">
                <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block mb-0.5 font-bold">Where do course syllabus lectures go?</strong>
                  <span>
                    This video is specifically your <strong>promotional trailer</strong>. Your complete lecture videos, syllabus modules, and video lessons are authored inside the <strong>Curriculum Builder (Module 6)</strong> under each section.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CHECKLIST & READINESS (Live Real-Time Form State Evaluation) */}
        {activeTab === 'checklist' && (
          <div className="space-y-5 max-w-3xl">
            {/* Unsaved Changes Banner */}
            {isDirty && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
                  <span>
                    You have <strong>unsaved changes</strong> in your course editor. Click below to save your changes to the database and update your official score.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isLocked}
                  className="px-4 py-2 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs font-bold shadow-sm whitespace-nowrap cursor-pointer flex-shrink-0"
                >
                  {isSaving ? 'Saving...' : 'Save & Validate'}
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 className="font-heading text-base font-bold text-ink">
                  Module 7 Submission Readiness
                </h3>
                <p className="text-xs text-muted">
                  Live verification of the 10 automated requirements required to submit for platform review.
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  isLiveReady
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {isLiveReady ? 'Ready to Submit' : `${liveReadyCount}/10 Requirements Met`}
              </span>
            </div>

            {/* Checklist Items Grid */}
            <div className="grid grid-cols-1 gap-2.5">
              {liveChecklistItems.map((item) => (
                <div
                  key={item.key}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
                    item.ok
                      ? 'bg-paper border-line/70'
                      : 'bg-rose-50/40 border-rose-200'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {item.ok ? (
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    ) : (
                      <AlertCircle size={16} className="text-rose-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                      {item.label}
                    </span>
                    <p className="text-xs text-muted mt-0.5">{item.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Admin Direct Publish Callout on Checklist Tab */}
            {isAdmin && activeCourse.status !== 'published' && activeCourse.status !== 'archived' && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-ink">
                  <strong className="block font-bold text-emerald-900 mb-0.5">Publish directly to the platform?</strong>
                  <span className="text-emerald-700">
                    As an administrator, you can directly publish this course to the public catalogue without awaiting review or approval.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handlePublishCourse}
                  disabled={isApprovalLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer flex-shrink-0"
                >
                  <Globe size={14} />
                  <span>{isApprovalLoading ? 'Publishing...' : 'Publish Course Directly'}</span>
                </button>
              </div>
            )}

            {/* Submit Action Callout on Checklist Tab - ONLY for course author */}
            {isAuthor && (activeCourse.status === 'draft' || activeCourse.status === 'rejected') && (
              <div className="p-4 rounded-xl border border-teal/30 bg-teal/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-ink">
                  <strong className="block font-bold mb-0.5">Ready to publish to the platform?</strong>
                  <span className="text-muted">
                    {isLiveReady
                      ? 'All requirements satisfied. You can submit your course for administrative review.'
                      : 'Complete the remaining checklist requirements above to enable review submission.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenSubmit}
                  disabled={!isLiveReady}
                  className="px-5 py-2.5 bg-teal hover:bg-teal-dark disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer flex-shrink-0"
                >
                  <Send size={14} />
                  <span>Submit for Review</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Course Language Settings Modal for Admin */}
      {role === 'admin' && (
        <CourseLanguageSettingsModal
          isOpen={isLanguageModalOpen}
          onClose={() => setIsLanguageModalOpen(false)}
          onUpdated={loadLanguages}
        />
      )}

      {/* Course Approval Modals */}
      <CourseSubmitModal
        checklist={checklist}
        onSuccess={handleSubmissionSuccess}
      />
      <CourseHistoryModal />
      <CourseReviewModal onSuccess={handleSubmissionSuccess} />
      <CourseRejectModal onSuccess={handleSubmissionSuccess} />
    </div>
  );
}
