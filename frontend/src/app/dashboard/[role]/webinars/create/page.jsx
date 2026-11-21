'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Video,
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Shield,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  X,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Lock,
  Award,
} from 'lucide-react';
import { useWebinarStore } from '@/modules/webinars/stores/useWebinarStore';
import { userService } from '@/app/dashboard/services/user.service';
import { webinarService } from '@/modules/webinars/services/webinar.service';
import { certificateService } from '@/modules/certificates/services/certificate.service';

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+05:30)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+04:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+08:00)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
];

export default function CreateWebinarPage() {
  const params = useParams();
  const router = useRouter();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const role = rawRole?.toLowerCase() || 'admin';

  // Role Access Guard: Only ADMIN can create webinars
  useEffect(() => {
    if (role !== 'admin') {
      router.replace(`/dashboard/${role}`);
    }
  }, [role, router]);

  const { createWebinar, isSaving, error, clearMessages } = useWebinarStore();

  // All available LMS users for host assignment (Instructor, Admin, Staff, etc.)
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');

  // Cover Image File Upload
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Schedule & Provider
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [provider, setProvider] = useState('google_meet');
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [isPublicRegistration, setIsPublicRegistration] = useState(true);
  const [enableCertificate, setEnableCertificate] = useState(false);
  const [certAttendanceThreshold, setCertAttendanceThreshold] = useState(75);
  const [certMinMinutes, setCertMinMinutes] = useState('');

  // Host assignment (Single Host: Existing User or Custom Email)
  const [hostMode, setHostMode] = useState('existing'); // 'existing' | 'custom'
  const [primaryHostId, setPrimaryHostId] = useState('');
  const [customHostEmail, setCustomHostEmail] = useState('');
  const [customHostName, setCustomHostName] = useState('');

  // Registration Fields Schema (Standard System Fields loaded via API)
  const [standardFields, setStandardFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [customFields, setCustomFields] = useState([]);

  // Meeting Provider Live Status
  const [providerStatuses, setProviderStatuses] = useState({
    google_meet: { isConnected: false, isConfigured: false, accountEmail: '' },
    zoom: { isConnected: false, isConfigured: false, accountEmail: '' },
    zoho: { isConnected: false, isConfigured: false, accountEmail: '' },
  });

  // Local Validation Error
  const [formError, setFormError] = useState('');

  // Fetch provider status and standard registration fields schema from API
  useEffect(() => {
    webinarService.getProvidersStatus()
      .then((res) => {
        const providers = res?.providers || [];
        const google = providers.find((p) => p.id === 'google_meet');
        const zoom = providers.find((p) => p.id === 'zoom');
        const zoho = providers.find((p) => p.id === 'zoho');
        setProviderStatuses({
          google_meet: {
            isConnected: Boolean(google?.isConnected && google?.accountEmail),
            isConfigured: Boolean(google?.isConfigured),
            accountEmail: google?.accountEmail || '',
          },
          zoom: {
            isConnected: Boolean(zoom?.isConnected),
            isConfigured: Boolean(zoom?.isConfigured),
            accountEmail: zoom?.accountEmail || zoom?.accountName || '',
          },
          zoho: {
            isConnected: Boolean(zoho?.isConnected),
            isConfigured: Boolean(zoho?.isConfigured),
            accountEmail: zoho?.accountEmail || zoho?.accountName || '',
          },
        });
      })
      .catch(() => {});
  }, []);

  // Fetch standard registration fields schema from API
  useEffect(() => {
    const fetchFieldSchema = async () => {
      try {
        setLoadingFields(true);
        const res = await webinarService.getRegistrationFieldsSchema();
        setStandardFields(res?.standardFields || []);
      } catch (err) {
        console.error('Failed to load registration fields schema:', err);
      } finally {
        setLoadingFields(false);
      }
    };
    fetchFieldSchema();
  }, []);

  // Format role label cleanly (Instructor, Admin, etc.)
  const getRoleLabel = (u) => {
    const roles = Array.isArray(u.roles)
      ? u.roles.filter(Boolean).map((r) => r.toUpperCase())
      : u.role
      ? [u.role.toUpperCase()]
      : [];
    if (roles.includes('INSTRUCTOR')) return 'Instructor';
    if (roles.includes('ADMIN')) return 'Admin';
    if (roles.includes('SUPER_ADMIN')) return 'Super Admin';
    if (roles.length > 0) {
      const r = roles[0];
      return r.charAt(0) + r.slice(1).toLowerCase();
    }
    return 'Instructor';
  };

  // Check if user is only a student (students cannot host webinars)
  const isStudentOnly = (u) => {
    const roles = Array.isArray(u.roles)
      ? u.roles.filter(Boolean).map((r) => r.toUpperCase())
      : u.role
      ? [u.role.toUpperCase()]
      : [];
    return roles.includes('STUDENT') && !roles.includes('INSTRUCTOR') && !roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN');
  };

  // Fetch all eligible hosts (Instructors, Admins, etc. - students excluded)
  useEffect(() => {
    clearMessages();
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        // Fetch users from system
        const res = await userService.getUsers({ limit: 100 });
        const list = res?.users || [];

        // Exclude students
        const eligibleHosts = list.filter((u) => !isStudentOnly(u));

        // Sort Instructors first, then Admins
        eligibleHosts.sort((a, b) => {
          const aRoles = Array.isArray(a.roles) ? a.roles.map((r) => r?.toUpperCase()) : [];
          const bRoles = Array.isArray(b.roles) ? b.roles.map((r) => r?.toUpperCase()) : [];
          const aIsIns = aRoles.includes('INSTRUCTOR');
          const bIsIns = bRoles.includes('INSTRUCTOR');
          if (aIsIns && !bIsIns) return -1;
          if (!aIsIns && bIsIns) return 1;
          return (a.first_name || '').localeCompare(b.first_name || '');
        });

        setAvailableUsers(eligibleHosts);
        if (eligibleHosts.length > 0) {
          setPrimaryHostId(eligibleHosts[0].user_id);
        }
      } catch (err) {
        console.error('Failed to load users for host selection:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [clearMessages]);

  // Slug auto-generation from Title
  const slugify = (text) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val);
    if (autoSlug) {
      setSlug(slugify(val));
    }
  };

  // Cover Image File Upload Handler
  const handleCoverFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
      setCoverUploadError('Please select a JPG, PNG, or WebP image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setCoverUploadError('Cover image size must be under 5MB.');
      return;
    }

    try {
      setUploadingCover(true);
      setCoverUploadError('');
      const res = await webinarService.uploadCoverImage(file);
      if (res?.url) {
        setCoverImageUrl(res.url);
      }
    } catch (err) {
      setCoverUploadError(err?.message || 'Failed to upload cover image.');
    } finally {
      setUploadingCover(false);
    }
  };

  // Custom Field Management
  const addCustomField = () => {
    const newId = `field_${Date.now()}`;
    setCustomFields([
      ...customFields,
      {
        id: newId,
        label: '',
        type: 'text',
        required: false,
        optionsText: '',
      },
    ]);
  };

  const removeCustomField = (index) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const updateCustomField = (index, key, value) => {
    const updated = [...customFields];
    updated[index][key] = value;
    setCustomFields(updated);
  };

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('Please enter a webinar title.');
      return;
    }

    if (!slug.trim()) {
      setFormError('Please provide a unique vanity URL slug for the webinar.');
      return;
    }

    if (!startDate || !startTime || !endDate || !endTime) {
      setFormError('Please specify start and end dates and times.');
      return;
    }

    const startIso = new Date(`${startDate}T${startTime}`).toISOString();
    const endIso = new Date(`${endDate}T${endTime}`).toISOString();

    if (new Date(endIso) <= new Date(startIso)) {
      setFormError('End time must be after the start time.');
      return;
    }

    // Host payload validation (Single Host)
    let hostPayload = {};
    if (hostMode === 'custom') {
      if (!customHostEmail.trim()) {
        setFormError('Please enter the host email address.');
        return;
      }
      hostPayload = {
        hostEmail: customHostEmail.trim().toLowerCase(),
        hostName: customHostName.trim() || undefined,
      };
    } else {
      if (!primaryHostId) {
        setFormError('Please select a designated host for this session.');
        return;
      }
      hostPayload = {
        hostId: primaryHostId,
      };
    }

    // Build custom fields array
    const processedCustomFields = customFields
      .filter((f) => f.label.trim())
      .map((f) => ({
        id: f.id,
        label: f.label.trim(),
        type: f.type,
        required: Boolean(f.required),
        options:
          f.type === 'dropdown'
            ? f.optionsText
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
      }));

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      shortDescription: shortDescription.trim() || undefined,
      description: description.trim() || undefined,
      coverImageUrl: coverImageUrl.trim() || undefined,
      provider,
      startTime: startIso,
      endTime: endIso,
      timezone,
      maxParticipants: Number(maxParticipants) || 100,
      isPublicRegistration,
      ...hostPayload,
      customRegistrationFields: processedCustomFields,
    };

    try {
      const created = await createWebinar(payload);
      const webinarId = created?.webinar_id || created?.webinarId || created?.id;
      if (webinarId && enableCertificate) {
        try {
          await certificateService.updateWebinarSettings(webinarId, {
            enabled: true,
            minimumAttendancePercentage: Number(certAttendanceThreshold) || 75,
            minimumAttendanceMinutes: certMinMinutes ? Number(certMinMinutes) : undefined,
          });
        } catch (certErr) {
          console.error('Failed to save certificate settings:', certErr);
        }
      }
      // Strictly redirect using vanity slug — NO UUID IN URL
      router.push(`/dashboard/${role}/webinars/${created.slug || slug}`);
    } catch (err) {
      setFormError(err?.message || 'Failed to schedule webinar. Check fields and try again.');
    }
  };

  if (role !== 'admin') return null;

  return (
    <div className="w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="pb-4 border-b border-slate-200">
        <Link
          href={`/dashboard/${role}/webinars`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Webinars</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Schedule New Webinar</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure event details, upload cover image, assign any LMS user as host, and launch public registration.
        </p>
      </div>

      {/* Global Error Banner */}
      {(formError || error) && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
          <div className="text-sm font-medium">{formError || error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: Event Overview & Cover Image */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Video className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">Event Overview</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: Title & Slug */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Webinar Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Mastering Modern Cloud-Native Architectures"
                  value={title}
                  onChange={handleTitleChange}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Vanity Slug (NO UUIDs) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-slate-700">
                    Public Vanity Slug <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setAutoSlug(!autoSlug)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    {autoSlug ? 'Edit Manually' : 'Auto-Generate'}
                  </button>
                </div>
                <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                  <span className="px-3.5 py-2.5 bg-slate-50 text-slate-500 text-sm border-r border-slate-200 font-mono select-none">
                    /webinars/
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="mastering-cloud-native"
                    value={slug}
                    disabled={autoSlug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    className="flex-1 px-4 py-2.5 text-sm bg-white font-mono text-slate-800 disabled:bg-slate-50 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Human-readable vanity URL for ads, social media, and landing pages.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Short Summary
                </label>
                <input
                  type="text"
                  placeholder="A concise preview displayed on directory cards..."
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Right: Cover Image Upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Webinar Cover Image
              </label>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleCoverFileChange}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
              />

              {coverImageUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 group">
                  <img
                    src={coverImageUrl}
                    alt="Webinar Cover Preview"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white rounded-lg shadow hover:bg-slate-50"
                    >
                      Change Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverImageUrl('')}
                      className="p-1.5 text-white bg-rose-600 rounded-lg shadow hover:bg-rose-700"
                      title="Remove Image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-48 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20 transition group"
                >
                  {uploadingCover ? (
                    <div className="flex flex-col items-center text-indigo-600">
                      <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
                      <span className="text-xs font-semibold">Uploading cover image...</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-white rounded-full text-indigo-600 shadow-sm border border-slate-200 mb-2 group-hover:scale-105 transition">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">
                        Click to upload cover banner
                      </span>
                      <span className="text-xs text-slate-400 mt-1">
                        PNG, JPG, or WebP up to 5MB
                      </span>
                    </>
                  )}
                </div>
              )}

              {coverUploadError && (
                <p className="text-xs text-rose-600 mt-1.5 font-medium">{coverUploadError}</p>
              )}
            </div>
          </div>

          {/* Full Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Detailed Agenda & Description
            </label>
            <textarea
              rows={4}
              placeholder="Provide event overview, topics, what participants will learn, prerequisites..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* SECTION 2: Schedule & Broadcasting Platform */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">Schedule & Broadcasting Platform</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                Start Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                End Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Video Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="google_meet">Google Meet (Recommended)</option>
                <option value="zoom">Zoom</option>
                <option value="zoho">Zoho Meeting</option>
              </select>
              {provider === 'google_meet' && (
                <div className="mt-1.5 text-xs">
                  {providerStatuses.google_meet.isConnected ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-medium">
                      <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" />
                      Connected: {providerStatuses.google_meet.accountEmail}
                    </span>
                  ) : (
                    <span className="text-amber-700 flex items-center gap-1 font-medium">
                      <AlertCircle size={13} className="text-amber-600 flex-shrink-0" />
                      Google not connected.{' '}
                      <Link
                        href={`/dashboard/${role}/settings?tab=meeting-providers`}
                        className="underline font-semibold hover:text-amber-900"
                      >
                        Connect in Settings
                      </Link>
                    </span>
                  )}
                </div>
              )}

              {provider === 'zoom' && (
                <div className="mt-1.5 text-xs">
                  {providerStatuses.zoom.isConnected ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-medium">
                      <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" />
                      Zoom Server-to-Server Active ({providerStatuses.zoom.accountEmail || 'Ready'})
                    </span>
                  ) : providerStatuses.zoom.isConfigured ? (
                    <span className="text-sky-700 flex items-center gap-1 font-medium">
                      <CheckCircle2 size={13} className="text-sky-600 flex-shrink-0" />
                      Zoom Configured &amp; Ready
                    </span>
                  ) : (
                    <span className="text-amber-700 flex items-center gap-1 font-medium">
                      <AlertCircle size={13} className="text-amber-600 flex-shrink-0" />
                      Zoom not configured.{' '}
                      <Link
                        href={`/dashboard/${role}/settings?tab=meeting-providers`}
                        className="underline font-semibold hover:text-amber-900"
                      >
                        Configure in Settings
                      </Link>
                    </span>
                  )}
                </div>
              )}

              {provider === 'zoho' && (
                <div className="mt-1.5 text-xs">
                  {providerStatuses.zoho.isConnected ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-medium">
                      <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" />
                      Zoho Connected: {providerStatuses.zoho.accountEmail || 'Ready'}
                    </span>
                  ) : (
                    <span className="text-amber-700 flex items-center gap-1 font-medium">
                      <AlertCircle size={13} className="text-amber-600 flex-shrink-0" />
                      Zoho Meeting not connected.{' '}
                      <Link
                        href={`/dashboard/${role}/settings?tab=meeting-providers`}
                        className="underline font-semibold hover:text-amber-900"
                      >
                        Connect in Settings
                      </Link>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Maximum Capacity
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublicRegistration}
                onChange={(e) => setIsPublicRegistration(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-semibold text-slate-800">
                  Enable Public Registration
                </span>
                <p className="text-xs text-slate-500">
                  Allows visitors from Google Ads, Meta Ads, social media, and links to register without an LMS account.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* SECTION 2B: Certificate of Participation */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Certificate of Participation</h2>
                <p className="text-xs text-slate-500">
                  Optionally issue automated verifiable certificates to attendees who meet attendance criteria.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-1">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableCertificate}
                onChange={(e) => setEnableCertificate(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-semibold text-slate-800">
                  Enable Certificate of Participation (Default: OFF)
                </span>
                <p className="text-xs text-slate-500">
                  When enabled, attendees with registered LMS student accounts who fulfill the attendance threshold will receive a PDF certificate with a verifiable QR code upon session conclusion.
                </p>
              </div>
            </label>
          </div>

          {enableCertificate && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Minimum Attendance Percentage (%)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={certAttendanceThreshold}
                  onChange={(e) => setCertAttendanceThreshold(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="75"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Default: 75%. Minimum percentage of total webinar duration required to qualify.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Minimum Attendance Minutes (Optional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={certMinMinutes}
                  onChange={(e) => setCertMinMinutes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Leave blank to use percentage only"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Optional absolute minute threshold required in addition to percentage.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: Host Assignment (Single Host: Select Existing or Enter Any Email) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Webinar Host</h2>
                <p className="text-xs text-slate-500">
                  Assign one designated host. Select an existing instructor/admin or enter any email address.
                </p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setHostMode('existing')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  hostMode === 'existing'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Select Existing Host
              </button>
              <button
                type="button"
                onClick={() => setHostMode('custom')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  hostMode === 'custom'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Enter Any Host Email
              </button>
            </div>
          </div>

          {hostMode === 'existing' ? (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                Designated Host <span className="text-rose-500">*</span>
              </label>
              {loadingUsers ? (
                <div className="text-xs text-slate-400 py-2">Loading instructors and staff...</div>
              ) : availableUsers.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
                  No instructors or staff accounts found. Please click "+ Enter Any Host Email" above to type the host email.
                </div>
              ) : (
                <select
                  value={primaryHostId}
                  onChange={(e) => setPrimaryHostId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {availableUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.first_name} {u.last_name} ({getRoleLabel(u)} — {u.email})
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>The designated host receives live room launch controls and is displayed as the presenter.</span>
                <button
                  type="button"
                  onClick={() => setHostMode('custom')}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  + Not in list? Enter any new email
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Host Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required={hostMode === 'custom'}
                  placeholder="e.g., guest.speaker@external.com or host@company.com"
                  value={customHostEmail}
                  onChange={(e) => setCustomHostEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Enter any valid email. If no LMS account exists yet, a host account will be automatically provisioned.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Host Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Dr. Sarah Johnson"
                  value={customHostName}
                  onChange={(e) => setCustomHostName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                  <span>Displayed on the public registration page and confirmation emails.</span>
                  <button
                    type="button"
                    onClick={() => setHostMode('existing')}
                    className="text-indigo-600 font-semibold hover:underline"
                  >
                    ← Choose existing
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: Registration Form Fields (Unified Grid: Default Fields + Added Custom Fields) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Registration Form Fields</h2>
                <p className="text-xs text-slate-500">
                  Standard system fields are required by default. Added custom fields appear directly in the grid with a delete provision.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={addCustomField}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition shadow-xs self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Field</span>
            </button>
          </div>

          {/* Unified Grid of All Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Standard System Fields (Locked, loaded from API) */}
            {(standardFields?.length > 0
              ? standardFields
              : [
                  {
                    id: 'first_name',
                    label: 'First Name',
                    type: 'text',
                    description: 'Participant identity for attendance records and the calendar invite.',
                  },
                  {
                    id: 'last_name',
                    label: 'Last Name',
                    type: 'text',
                    description: 'Participant identity for attendance records and the calendar invite.',
                  },
                  {
                    id: 'email',
                    label: 'Email Address',
                    type: 'email',
                    description: 'Receives unique join authorization link, calendar invite, and session updates.',
                  },
                  {
                    id: 'phone',
                    label: 'Phone Number',
                    type: 'tel',
                    description: 'Contact verification and reminders (multiple participants may share a phone).',
                  },
                ]
            ).map((field) => (
              <div
                key={field.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">{field.label}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                    Default · Locked
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {field.description}
                </p>
                <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-indigo-600 font-semibold uppercase">
                  <span>Field Type: {field.type}</span>
                  <span className="text-emerald-700 font-sans font-bold">Required</span>
                </div>
              </div>
            ))}

            {/* Dynamic Custom Fields Added By Admin (Show in above fields grid with delete provision) */}
            {customFields.map((field, index) => (
              <div
                key={field.id}
                className="p-4 rounded-xl border-2 border-indigo-200 bg-white shadow-xs space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    Custom Field #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCustomField(index)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition"
                    title="Delete this custom field"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Field Label Input */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Field Label <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Degree, Company, Experience"
                    value={field.label}
                    onChange={(e) => updateCustomField(index, 'label', e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Field Type and Required */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      Type
                    </label>
                    <select
                      value={field.type}
                      onChange={(e) => updateCustomField(index, 'type', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="text">Short Text</option>
                      <option value="number">Number</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                  </div>

                  <div className="pt-4">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateCustomField(index, 'required', e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                      />
                      <span>Required</span>
                    </label>
                  </div>
                </div>

                {field.type === 'dropdown' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      Options (comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., B.Tech, M.Tech, MBA, Other"
                      value={field.optionsText}
                      onChange={(e) => updateCustomField(index, 'optionsText', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Quick Add Card Tile */}
            <button
              type="button"
              onClick={addCustomField}
              className="p-6 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20 rounded-xl flex flex-col items-center justify-center text-center transition group cursor-pointer min-h-[160px]"
            >
              <div className="p-2.5 bg-white rounded-full text-indigo-600 shadow-xs border border-slate-200 mb-2 group-hover:scale-105 transition">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Add Another Custom Field</span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                e.g., Degree, Organization, Industry
              </span>
            </button>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Link
            href={`/dashboard/${role}/webinars`}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl transition"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 shadow-md shadow-indigo-100"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Scheduling Event...</span>
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                <span>Schedule Webinar</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
