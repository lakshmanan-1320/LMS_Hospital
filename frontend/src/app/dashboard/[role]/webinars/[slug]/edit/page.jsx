'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Video,
  ArrowLeft,
  Calendar,
  Users,
  Layers,
  Plus,
  Trash2,
  AlertCircle,
  Save,
  CheckCircle2,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  Lock,
  Award,
} from 'lucide-react';
import { useWebinarStore } from '@/modules/webinars/stores/useWebinarStore';
import { webinarService } from '@/modules/webinars/services/webinar.service';
import { userService } from '@/app/dashboard/services/user.service';
import { certificateService } from '@/modules/certificates/services/certificate.service';

export default function EditWebinarPage() {
  const params = useParams();
  const router = useRouter();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const role = rawRole?.toLowerCase() || 'admin';
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  // Role Access Guard: Only ADMIN can edit
  useEffect(() => {
    if (role !== 'admin') {
      router.replace(`/dashboard/${role}`);
    }
  }, [role, router]);

  const {
    adminWebinarDetails,
    fetchAdminWebinarDetails,
    updateWebinar,
    isLoading,
    isSaving,
    error,
    clearMessages,
  } = useWebinarStore();

  // Eligible LMS users for host selection
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState('');
  const fileInputRef = useRef(null);

  const [maxParticipants, setMaxParticipants] = useState(100);

  // Single Host Assignment
  const [hostMode, setHostMode] = useState('existing'); // 'existing' | 'custom'
  const [primaryHostId, setPrimaryHostId] = useState('');
  const [customHostEmail, setCustomHostEmail] = useState('');
  const [customHostName, setCustomHostName] = useState('');

  // Registration Form Fields (Standard + Custom)
  const [standardFields, setStandardFields] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [enableCertificate, setEnableCertificate] = useState(false);
  const [certAttendanceThreshold, setCertAttendanceThreshold] = useState(75);
  const [certMinMinutes, setCertMinMinutes] = useState('');
  const [formError, setFormError] = useState('');

  // Format role label cleanly
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

  // Fetch standard registration fields schema from API
  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const res = await webinarService.getRegistrationFieldsSchema();
        setStandardFields(res?.standardFields || []);
      } catch (err) {
        console.error('Failed to load standard registration fields:', err);
      }
    };
    fetchSchema();
  }, []);

  // Fetch eligible users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const res = await userService.getUsers({ limit: 100 });
        const list = res?.users || [];
        const eligible = list.filter((u) => !isStudentOnly(u));
        eligible.sort((a, b) => {
          const aRoles = Array.isArray(a.roles) ? a.roles.map((r) => r?.toUpperCase()) : [];
          const bRoles = Array.isArray(b.roles) ? b.roles.map((r) => r?.toUpperCase()) : [];
          const aIsIns = aRoles.includes('INSTRUCTOR');
          const bIsIns = bRoles.includes('INSTRUCTOR');
          if (aIsIns && !bIsIns) return -1;
          if (!aIsIns && bIsIns) return 1;
          return (a.first_name || '').localeCompare(b.first_name || '');
        });
        setAvailableUsers(eligible);
      } catch (err) {
        console.error('Failed to load eligible hosts:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Initial load of webinar details
  useEffect(() => {
    clearMessages();
    if (slug) {
      fetchAdminWebinarDetails(slug).then((data) => {
        if (data) {
          setTitle(data.title || '');
          setShortDescription(data.short_description || '');
          setDescription(data.description || '');
          setCoverImageUrl(data.cover_image_url || '');
          setMaxParticipants(data.max_participants || 100);

          if (data.standard_registration_fields?.length > 0) {
            setStandardFields(data.standard_registration_fields);
          }

          const fields = (data.custom_registration_fields || []).map((f) => ({
            ...f,
            optionsText: Array.isArray(f.options) ? f.options.join(', ') : '',
          }));
          setCustomFields(fields);

          const webinarId = data.webinar_id || data.id;
          if (webinarId) {
            certificateService
              .getWebinarSettings(webinarId)
              .then((res) => {
                if (res) {
                  setEnableCertificate(Boolean(res.enabled));
                  setCertAttendanceThreshold(
                    Number(res.minimum_attendance_percentage) || 75
                  );
                  setCertMinMinutes(
                    res.minimum_attendance_minutes
                      ? String(res.minimum_attendance_minutes)
                      : ''
                  );
                }
              })
              .catch((err) =>
                console.error('Failed to load certificate settings', err)
              );
          }

          // Populate current host
          if (data.hosts && data.hosts.length > 0) {
            const currentHost = data.hosts[0];
            setPrimaryHostId(currentHost.user_id);
            setCustomHostEmail(currentHost.email || '');
            setCustomHostName(
              currentHost.first_name
                ? `${currentHost.first_name} ${currentHost.last_name || ''}`.trim()
                : ''
            );
          }
        }
      });
    }
  }, [slug, fetchAdminWebinarDetails, clearMessages]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('Please enter a webinar title.');
      return;
    }

    // Host payload
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
      if (primaryHostId) {
        hostPayload = {
          hostId: primaryHostId,
        };
      }
    }

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
      shortDescription: shortDescription.trim() || undefined,
      description: description.trim() || undefined,
      coverImageUrl: coverImageUrl.trim() || undefined,
      maxParticipants: Number(maxParticipants) || 100,
      ...hostPayload,
      customRegistrationFields: processedCustomFields,
    };

    try {
      await updateWebinar(slug, payload);
      const webinarId = adminWebinarDetails?.webinar_id || adminWebinarDetails?.id;
      if (webinarId) {
        try {
          await certificateService.updateWebinarSettings(webinarId, {
            enabled: Boolean(enableCertificate),
            minimumAttendancePercentage: Number(certAttendanceThreshold) || 75,
            minimumAttendanceMinutes: certMinMinutes ? Number(certMinMinutes) : undefined,
          });
        } catch (certErr) {
          console.error('Failed to update certificate settings:', certErr);
        }
      }
      // Strictly navigate using vanity slug — NO UUID IN URL
      router.push(`/dashboard/${role}/webinars/${slug}`);
    } catch (err) {
      setFormError(err?.message || 'Failed to update webinar.');
    }
  };

  if (role !== 'admin') return null;

  if (isLoading && !title) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">Loading webinar details...</p>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="pb-4 border-b border-slate-200">
        <Link
          href={`/dashboard/${role}/webinars/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Hub (/{slug})</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Edit Webinar Details</h1>
        <p className="text-sm text-slate-500 font-mono mt-0.5">
          Vanity Slug: /{slug}
        </p>
      </div>

      {(formError || error) && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
          <div className="text-sm font-medium">{formError || error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Info & Cover Image */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-slate-900 pb-2 border-b border-slate-100">
            Webinar Content & Information
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Short Summary
                </label>
                <input
                  type="text"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Max Participant Capacity
                </label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Cover Image Upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Cover Image Banner
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

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Full Agenda & Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* SECTION 2: Single Host Assignment */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Webinar Host</h2>
                <p className="text-xs text-slate-500">
                  Assign the single designated session host. Choose an existing instructor or enter any email address.
                </p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setHostMode('existing')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
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
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
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

        {/* SECTION 3: Registration Form Fields (Unified Grid: Default Fields + Added Custom Fields) */}
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
            {/* Standard System Fields (Locked) */}
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

            {/* Dynamic Custom Fields Added By Admin (with delete provision) */}
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

        {/* Certificate of Participation Section */}
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

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Link
            href={`/dashboard/${role}/webinars/${slug}`}
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
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
