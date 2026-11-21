'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Layers3,
  Clock,
  Users,
  Video,
  CheckCircle2,
  AlertCircle,
  Share2,
  Sparkles,
  Loader2,
  Download,
  Mail,
  ShieldCheck,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { useWebinarStore } from '@/modules/webinars/stores/useWebinarStore';

const inputClass = (hasError) =>
  `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 ${
    hasError
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10'
      : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500/10'
  }`;

function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-rose-600">{message}</p>;
}

export default function PublicWebinarLandingPage() {
  // Next.js 14: read route params with useParams() (use(params) needs Next 15+)
  const { slug } = useParams();

  const {
    publicWebinar,
    isLoading,
    isRegistering,
    error,
    registrationResult,
    fetchPublicWebinarBySlug,
    registerPublic,
    resendConfirmation,
    clearMessages,
  } = useWebinarStore();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    customFields: {},
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const [resendEmail, setResendEmail] = useState('');
  const [showResendModal, setShowResendModal] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchPublicWebinarBySlug(slug);
    }
    return () => clearMessages();
  }, [slug, fetchPublicWebinarBySlug, clearMessages]);

  // Extract UTMs & Referrer from URL and browser on mount
  const extractAttribution = () => {
    if (typeof window === 'undefined') return {};
    const sp = new URLSearchParams(window.location.search);
    return {
      utmSource: sp.get('utm_source') || undefined,
      utmMedium: sp.get('utm_medium') || undefined,
      utmCampaign: sp.get('utm_campaign') || undefined,
      utmTerm: sp.get('utm_term') || undefined,
      utmContent: sp.get('utm_content') || undefined,
      referrer: document.referrer || undefined,
    };
  };

  // Same rules as the backend RegisterWebinarDto, so users see problems before submitting.
  const validateRegistration = (data, customDefs = []) => {
    const errs = {};
    const NAME_RE = /^\p{L}[\p{L}\p{M} .'-]*$/u;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    [
      ['firstName', 'First name'],
      ['lastName', 'Last name'],
    ].forEach(([key, label]) => {
      const v = data[key].trim();
      if (!v) errs[key] = `${label} is required`;
      else if (v.length > 50) errs[key] = `${label} must be 50 characters or fewer`;
      else if (!NAME_RE.test(v)) errs[key] = `${label} can only contain letters, spaces, ' . -`;
    });

    const email = data.email.trim();
    if (!email) errs.email = 'Email is required';
    else if (email.length > 254 || !EMAIL_RE.test(email)) errs.email = 'Enter a valid email address';

    const phone = data.phoneNumber.trim().replace(/[\s\-().]/g, '');
    if (!phone) errs.phoneNumber = 'Phone number is required';
    else if (!/^\+?[0-9]{7,15}$/.test(phone))
      errs.phoneNumber = 'Enter a valid phone number (7–15 digits, optional + country code)';

    customDefs.forEach((field) => {
      const v = data.customFields[field.id];
      const empty = v === undefined || v === null || v === false || (typeof v === 'string' && !v.trim());
      if (empty) {
        if (field.required) {
          errs[`custom_${field.id}`] =
            field.type === 'checkbox' ? `${field.label} must be checked` : `${field.label} is required`;
        }
        return;
      }
      if (field.type === 'number' && !Number.isFinite(Number(String(v).trim()))) {
        errs[`custom_${field.id}`] = `${field.label} must be a number`;
      } else if (field.type === 'text' && String(v).trim().length > 500) {
        errs[`custom_${field.id}`] = `${field.label} must be 500 characters or fewer`;
      }
    });

    return errs;
  };

  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const updateCustomField = (id, value) => {
    setFormData((prev) => ({ ...prev, customFields: { ...prev.customFields, [id]: value } }));
    const key = `custom_${id}`;
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmitRegistration = async (e) => {
    e.preventDefault();
    const customDefs = publicWebinar?.custom_registration_fields || [];
    const errs = validateRegistration(formData, customDefs);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const attribution = extractAttribution();

    // Only send answers to configured questions; numbers as numbers
    const customFieldResponses = {};
    customDefs.forEach((field) => {
      const v = formData.customFields[field.id];
      if (field.type === 'checkbox') customFieldResponses[field.id] = Boolean(v);
      else if (v !== undefined && String(v).trim() !== '') {
        customFieldResponses[field.id] = field.type === 'number' ? Number(String(v).trim()) : String(v).trim();
      }
    });

    try {
      await registerPublic(slug, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber: formData.phoneNumber.trim(),
        customFieldResponses,
        ...attribution,
      });
    } catch {
      // Error handled in store
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail) return;
    try {
      setResending(true);
      await resendConfirmation(slug, resendEmail);
      setResendStatus({ type: 'success', text: 'Confirmation email sent successfully!' });
    } catch (err) {
      setResendStatus({ type: 'error', text: err.message || 'Failed to resend confirmation' });
    } finally {
      setResending(false);
    }
  };

  const formatDateTime = (dateString, timezone = 'UTC') => {
    try {
      const d = new Date(dateString);
      return {
        full: d.toLocaleString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        date: d.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        time: d.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    } catch {
      return { full: dateString, date: dateString, time: '' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6ff] text-slate-600">
        <Loader2 size={40} className="animate-spin text-violet-600 mb-3" />
      </div>
    );
  }

  if (!publicWebinar) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f6ff] px-6 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Webinar Not Found</h2>
        <p className="mt-2 text-slate-500">The session you are looking for may have ended or was moved.</p>
        <Link
          href="/webinars"
          className="mt-6 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
        >
          Browse Upcoming Webinars
        </Link>
      </div>
    );
  }

  const schedule = formatDateTime(publicWebinar.start_time, publicWebinar.timezone);
  const primaryHost = publicWebinar.hosts?.[0] || null;

  return (
    <div className="min-h-screen bg-[#f7f6ff] text-[#191b38]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/60 bg-white/90 px-6 backdrop-blur-md sm:px-12">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
            <Layers3 size={18} />
          </span>
          <span>
            elevate<span className="text-violet-600">.</span>
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/webinars" className="text-slate-600 hover:text-violet-600 transition-colors">
            ← All Webinars
          </Link>
          <button
            onClick={() => setShowResendModal(true)}
            className="text-xs font-semibold text-violet-700 hover:underline"
          >
            Already registered? Find link
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-6 py-12 sm:px-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Left Column: Webinar Narrative & Host Team */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1 text-xs font-semibold text-violet-700 shadow-xs">
              <Sparkles size={14} className="text-violet-600" />
              <span>Live Interactive Masterclass</span>
            </div>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl sm:leading-tight">
              {publicWebinar.title}
            </h1>

            {publicWebinar.short_description && (
              <p className="mt-4 text-lg text-slate-600 leading-relaxed font-medium">
                {publicWebinar.short_description}
              </p>
            )}

            {/* Quick Timing Pills */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-xs">
                <Calendar size={16} className="text-violet-600" />
                <span>{schedule.date}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-xs">
                <Clock size={16} className="text-violet-600" />
                <span>{schedule.time} ({publicWebinar.timezone})</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-xs">
                <Video size={16} className="text-violet-600" />
                <span>
                  {publicWebinar.provider === 'zoom'
                    ? 'Zoom Video Conference'
                    : publicWebinar.provider === 'zoho'
                    ? 'Zoho Meeting'
                    : 'Google Meet Conference'}
                </span>
              </div>
            </div>

            {/* Cover Image */}
            {publicWebinar.cover_image_url && (
              <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
                <img
                  src={publicWebinar.cover_image_url}
                  alt={publicWebinar.title}
                  className="h-72 w-full object-cover"
                />
              </div>
            )}

            {/* Full Agenda / Description */}
            <div className="mt-10 rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xs">
              <h2 className="text-xl font-bold text-slate-900 mb-4">About This Live Session</h2>
              <div className="prose prose-slate max-w-none text-slate-600 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                {publicWebinar.description || 'Join this live session to interact directly with experts, learn proven architectural patterns, and take part in real-time Q&A.'}
              </div>
            </div>

            {/* Host Section */}
            {publicWebinar.hosts && publicWebinar.hosts.length > 0 && (
              <div className="mt-8 rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xs">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Meet Your Instructor & Hosts</h2>
                <div className="space-y-6">
                  {publicWebinar.hosts.map((host) => (
                    <div key={host.webinar_host_id} className="flex items-start gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 font-bold text-xl overflow-hidden shadow-xs">
                        {host.avatar_url ? (
                          <img
                            src={host.avatar_url}
                            alt={`${host.first_name} ${host.last_name}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          `${host.first_name?.[0] || 'H'}${host.last_name?.[0] || ''}`
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-base">
                            {host.first_name} {host.last_name}
                          </h3>
                          <span className="rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                            {host.host_role === 'primary_host' ? 'Lead Speaker' : 'Co-Host'}
                          </span>
                        </div>
                        {host.headline && <p className="text-xs text-slate-500 font-medium mt-0.5">{host.headline}</p>}
                        {host.bio && <p className="text-xs text-slate-600 mt-2 leading-relaxed">{host.bio}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Public Registration Form / Confirmation Card */}
          <div className="lg:col-span-5">
            <div className="sticky top-28 rounded-3xl border border-slate-200/90 bg-white p-8 shadow-xl">
              {registrationResult ? (
                /* Success Confirmation State */
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
                    <CheckCircle2 size={26} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">You Are Registered!</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    A confirmation email with calendar attachments and your personalized joining link has been sent to{' '}
                    <strong className="text-slate-800">{formData.email}</strong>.
                  </p>

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Session:</span>
                      <span className="font-bold text-slate-900">{publicWebinar.title}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Date & Time:</span>
                      <span className="font-bold text-slate-900">{schedule.full}</span>
                    </div>
                  </div>

                  {/* Join Link CTA (Vanity slug based - NO UUID in frontend URL!) */}
                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <Link
                      href={`/webinars/${slug}/join`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-violet-500/20 hover:bg-violet-700 transition-all"
                    >
                      <span>Go to Session Entrance</span>
                      <ArrowRight size={16} />
                    </Link>
                    <p className="mt-2 text-center text-xs text-slate-400">
                      The room entrance opens 15 minutes prior to scheduled start time.
                    </p>
                  </div>
                </div>
              ) : (
                /* Registration Input Form */
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                      Free Registration
                    </span>
                    <span className="text-xs text-slate-500 font-medium">Instant Confirmation</span>
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900">Save Your Seat</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    No account required. Fill in your details below to receive your personalized entrance link.
                  </p>

                  {error && (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
                      <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmitRegistration} noValidate className="mt-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="reg-first-name" className="block text-xs font-semibold text-slate-700 mb-1">
                          First Name *
                        </label>
                        <input
                          id="reg-first-name"
                          type="text"
                          autoComplete="given-name"
                          maxLength={50}
                          value={formData.firstName}
                          onChange={(e) => updateField('firstName', e.target.value)}
                          aria-invalid={Boolean(fieldErrors.firstName)}
                          className={inputClass(fieldErrors.firstName)}
                          placeholder="e.g. John"
                        />
                        <FieldError message={fieldErrors.firstName} />
                      </div>
                      <div>
                        <label htmlFor="reg-last-name" className="block text-xs font-semibold text-slate-700 mb-1">
                          Last Name *
                        </label>
                        <input
                          id="reg-last-name"
                          type="text"
                          autoComplete="family-name"
                          maxLength={50}
                          value={formData.lastName}
                          onChange={(e) => updateField('lastName', e.target.value)}
                          aria-invalid={Boolean(fieldErrors.lastName)}
                          className={inputClass(fieldErrors.lastName)}
                          placeholder="e.g. Doe"
                        />
                        <FieldError message={fieldErrors.lastName} />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1">
                        Work or Personal Email *
                      </label>
                      <input
                        id="reg-email"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        aria-invalid={Boolean(fieldErrors.email)}
                        className={inputClass(fieldErrors.email)}
                        placeholder="john@example.com"
                      />
                      <FieldError message={fieldErrors.email} />
                    </div>

                    <div>
                      <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                        Phone Number *
                      </label>
                      <input
                        id="reg-phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        maxLength={20}
                        value={formData.phoneNumber}
                        onChange={(e) => updateField('phoneNumber', e.target.value.replace(/[^0-9+\s\-().]/g, ''))}
                        aria-invalid={Boolean(fieldErrors.phoneNumber)}
                        className={inputClass(fieldErrors.phoneNumber)}
                        placeholder="+91 98765 43210"
                      />
                      <FieldError message={fieldErrors.phoneNumber} />
                    </div>

                    {/* Dynamic Custom Fields configured by Admin */}
                    {publicWebinar.custom_registration_fields?.map((field) => {
                      const errKey = `custom_${field.id}`;
                      const inputId = `reg-custom-${field.id}`;
                      if (field.type === 'checkbox') {
                        return (
                          <div key={field.id}>
                            <label htmlFor={inputId} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                id={inputId}
                                type="checkbox"
                                checked={Boolean(formData.customFields[field.id])}
                                onChange={(e) => updateCustomField(field.id, e.target.checked)}
                                aria-invalid={Boolean(fieldErrors[errKey])}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                              />
                              <span>
                                {field.label} {field.required && '*'}
                              </span>
                            </label>
                            <FieldError message={fieldErrors[errKey]} />
                          </div>
                        );
                      }
                      return (
                        <div key={field.id}>
                          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 mb-1">
                            {field.label}{' '}
                            {field.required ? '*' : <span className="text-slate-400 font-normal">(Optional)</span>}
                          </label>
                          {field.type === 'dropdown' ? (
                            <select
                              id={inputId}
                              value={formData.customFields[field.id] || ''}
                              onChange={(e) => updateCustomField(field.id, e.target.value)}
                              aria-invalid={Boolean(fieldErrors[errKey])}
                              className={inputClass(fieldErrors[errKey])}
                            >
                              <option value="">Select an option...</option>
                              {field.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={inputId}
                              type="text"
                              inputMode={field.type === 'number' ? 'decimal' : undefined}
                              maxLength={field.type === 'number' ? 20 : 500}
                              value={formData.customFields[field.id] || ''}
                              onChange={(e) => updateCustomField(field.id, e.target.value)}
                              aria-invalid={Boolean(fieldErrors[errKey])}
                              className={inputClass(fieldErrors[errKey])}
                              placeholder={`Enter ${field.label.toLowerCase()}...`}
                            />
                          )}
                          <FieldError message={fieldErrors[errKey]} />
                        </div>
                      );
                    })}

                    <button
                      type="submit"
                      disabled={isRegistering}
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-violet-500/20 hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-500/10 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {isRegistering ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Reserving your seat...</span>
                        </>
                      ) : (
                        <span>Confirm Free Registration</span>
                      )}
                    </button>
                  </form>

                  <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span>Instant confirmation • Your contact info is strictly confidential</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Resend Confirmation Modal */}
      {showResendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Find Your Join Link</h3>
            <p className="mt-1 text-xs text-slate-500">
              Enter the email address you used when registering, and we'll re-send your calendar invite and unique entrance link.
            </p>

            {resendStatus && (
              <div
                className={`mt-4 rounded-xl p-3 text-xs font-medium ${
                  resendStatus.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {resendStatus.text}
              </div>
            )}

            <form onSubmit={handleResend} className="mt-4 space-y-3">
              <input
                type="email"
                required
                placeholder="your.email@example.com"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/10"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResendModal(false);
                    setResendStatus(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-violet-700 disabled:opacity-50"
                >
                  {resending && <Loader2 size={12} className="animate-spin" />}
                  <span>Resend Invite</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

