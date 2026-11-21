'use client';

import { useState, useEffect } from 'react';
import {
  Globe,
  Linkedin,
  Github,
  Twitter,
  Youtube,
  Facebook,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  BookOpen,
  Share2,
} from 'lucide-react';
import AvatarUploadSection from './AvatarUploadSection';
import SkillsTagInput from './SkillsTagInput';
import QualificationsRepeater from './QualificationsRepeater';

export default function InstructorProfileEditor({
  profile,
  onSave,
  onUploadAvatar,
  isSaving = false,
  isUploadingAvatar = false,
  error = null,
  successMessage = null,
  onClearMessages,
}) {
  const [formData, setFormData] = useState({
    slug: '',
    headline: '',
    bio: '',
    experienceYears: '',
    qualifications: [],
    expertise: [],
    skills: [],
    websiteUrl: '',
    linkedinUrl: '',
    githubUrl: '',
    twitterUrl: '',
    youtubeUrl: '',
    facebookUrl: '',
    isPublic: false,
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Sync profile data to form when loaded
  useEffect(() => {
    if (profile) {
      setFormData({
        slug: profile.slug || '',
        headline: profile.headline || '',
        bio: profile.bio || '',
        experienceYears:
          profile.experienceYears !== null && profile.experienceYears !== undefined
            ? profile.experienceYears
            : '',
        qualifications: Array.isArray(profile.qualifications)
          ? profile.qualifications
          : [],
        expertise: Array.isArray(profile.expertise) ? profile.expertise : [],
        skills: Array.isArray(profile.skills) ? profile.skills : [],
        websiteUrl: profile.websiteUrl || '',
        linkedinUrl: profile.linkedinUrl || '',
        githubUrl: profile.githubUrl || '',
        twitterUrl: profile.twitterUrl || '',
        youtubeUrl: profile.youtubeUrl || '',
        facebookUrl: profile.facebookUrl || '',
        isPublic: Boolean(profile.isPublic),
      });
      setHasChanges(false);
    }
  }, [profile]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    if (onClearMessages) onClearMessages();
  };

  const handleToggleVisibility = (checked) => {
    handleChange('isPublic', checked);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prepare payload
    const payload = {
      slug: formData.slug.trim().toLowerCase() || undefined,
      headline: formData.headline.trim() || undefined,
      bio: formData.bio.trim() || undefined,
      experienceYears:
        formData.experienceYears === ''
          ? undefined
          : Number(formData.experienceYears),
      qualifications: formData.qualifications.filter(
        (q) => q.title?.trim() && q.issuer?.trim(),
      ),
      expertise: formData.expertise,
      skills: formData.skills,
      websiteUrl: formData.websiteUrl.trim() || undefined,
      linkedinUrl: formData.linkedinUrl.trim() || undefined,
      githubUrl: formData.githubUrl.trim() || undefined,
      twitterUrl: formData.twitterUrl.trim() || undefined,
      youtubeUrl: formData.youtubeUrl.trim() || undefined,
      facebookUrl: formData.facebookUrl.trim() || undefined,
      isPublic: formData.isPublic,
    };

    await onSave(payload);
    setHasChanges(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Notifications / Toasts */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <div className="flex-1">{successMessage}</div>
        </div>
      )}

      {/* 2. Avatar & Public Visibility Card */}
      <AvatarUploadSection
        userId={profile?.userId}
        slug={formData.slug || profile?.slug}
        avatarUrl={profile?.avatarUrl}
        firstName={profile?.firstName}
        lastName={profile?.lastName}
        email={profile?.email}
        isPublic={formData.isPublic}
        onToggleVisibility={handleToggleVisibility}
        onUploadAvatar={onUploadAvatar}
        isUploading={isUploadingAvatar}
      />

      {/* 3. Professional Identity & Experience */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Briefcase size={18} className="text-violet-600" />
          <h2 className="text-base font-bold text-slate-900">
            Professional Identity
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-12">
          {/* Professional Headline */}
          <div className="sm:col-span-9 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Professional Headline *
              </label>
              <span className="text-xs text-slate-400">
                {formData.headline.length} / 120
              </span>
            </div>
            <input
              type="text"
              required
              maxLength={120}
              placeholder="e.g. Principal Cloud Architect & Author"
              value={formData.headline}
              onChange={(e) => handleChange('headline', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
            />
            <p className="text-xs text-slate-400">
              A concise professional title displayed under your name on course cards.
            </p>
          </div>

          {/* Years of Experience */}
          <div className="sm:col-span-3 space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Years of Experience
            </label>
            <input
              type="number"
              min={0}
              max={70}
              placeholder="e.g. 10"
              value={formData.experienceYears}
              onChange={(e) => handleChange('experienceYears', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
            />
          </div>

          {/* Custom Profile URL Slug (Vanity URL) */}
          <div className="sm:col-span-12 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Public Profile URL (Vanity Slug)
              </label>
              <span className="text-xs text-slate-400">
                /instructors/{formData.slug || 'your-name'}
              </span>
            </div>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:border-violet-500 bg-white">
              <span className="inline-flex items-center bg-slate-50 px-3.5 text-xs text-slate-500 border-r border-slate-200 select-none font-mono">
                /instructors/
              </span>
              <input
                type="text"
                maxLength={60}
                placeholder="jane-doe"
                value={formData.slug}
                onChange={(e) => {
                  const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                  handleChange('slug', cleaned);
                }}
                className="w-full bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none font-mono"
              />
            </div>
            <p className="text-xs text-slate-400">
              Clean, SEO-friendly link to share your public teaching profile. Lowercase letters, numbers, and hyphens only (e.g. <span className="font-mono text-slate-600">jane-doe</span>).
            </p>
          </div>
        </div>

        {/* Biography */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">
              Biography & Teaching Pedagogy
            </label>
            <span className="text-xs text-slate-400">
              {formData.bio.length} / 10,000
            </span>
          </div>
          <textarea
            rows={5}
            maxLength={10000}
            placeholder="Tell prospective students about your professional background, industry experience, and teaching philosophy..."
            value={formData.bio}
            onChange={(e) => handleChange('bio', e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 4. Subject Expertise & Technical Skills */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <BookOpen size={18} className="text-violet-600" />
          <h2 className="text-base font-bold text-slate-900">
            Expertise & Competencies
          </h2>
        </div>

        <SkillsTagInput
          label="Primary Topics & Subject Expertise"
          placeholder="e.g. Cloud Architecture, Microservices, DevOps"
          tags={formData.expertise}
          onChange={(newTags) => handleChange('expertise', newTags)}
          maxTags={15}
          helperText="Broad subject categories you teach. Press Enter or comma to add."
        />

        <div className="border-t border-slate-100 pt-5">
          <SkillsTagInput
            label="Technical Skills & Technologies"
            placeholder="e.g. Kubernetes, NestJS, Next.js, Docker, PostgreSQL"
            tags={formData.skills}
            onChange={(newTags) => handleChange('skills', newTags)}
            maxTags={30}
            helperText="Specific frameworks, languages, tools, and platforms you specialize in."
          />
        </div>
      </div>

      {/* 5. Qualifications & Credentials */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <QualificationsRepeater
          qualifications={formData.qualifications}
          onChange={(newQualifications) =>
            handleChange('qualifications', newQualifications)
          }
          maxItems={20}
        />
      </div>

      {/* 6. Social Media & Portfolio Links */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Share2 size={18} className="text-violet-600" />
          <h2 className="text-base font-bold text-slate-900">
            Portfolio & Social Presence
          </h2>
        </div>

        <p className="text-xs text-slate-500">
          Provide your external profiles so prospective students and platform administrators can verify your industry background.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Website */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Globe size={14} className="text-slate-500" /> Website / Portfolio
            </label>
            <input
              type="url"
              maxLength={500}
              placeholder="https://yourportfolio.dev"
              value={formData.websiteUrl}
              onChange={(e) => handleChange('websiteUrl', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
            />
          </div>

          {/* LinkedIn */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Linkedin size={14} className="text-blue-600" /> LinkedIn Profile
            </label>
            <input
              type="url"
              maxLength={500}
              placeholder="https://linkedin.com/in/yourprofile"
              value={formData.linkedinUrl}
              onChange={(e) => handleChange('linkedinUrl', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
            />
          </div>

          {/* GitHub */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Github size={14} className="text-slate-800" /> GitHub Profile
            </label>
            <input
              type="url"
              maxLength={500}
              placeholder="https://github.com/yourusername"
              value={formData.githubUrl}
              onChange={(e) => handleChange('githubUrl', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
            />
          </div>

          {/* X / Twitter */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Twitter size={14} className="text-sky-500" /> X (Twitter)
            </label>
            <input
              type="url"
              maxLength={500}
              placeholder="https://twitter.com/yourhandle"
              value={formData.twitterUrl}
              onChange={(e) => handleChange('twitterUrl', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
            />
          </div>

          {/* YouTube */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Youtube size={14} className="text-red-600" /> YouTube Channel
            </label>
            <input
              type="url"
              maxLength={500}
              placeholder="https://youtube.com/@yourchannel"
              value={formData.youtubeUrl}
              onChange={(e) => handleChange('youtubeUrl', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
            />
          </div>

          {/* Facebook */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Facebook size={14} className="text-blue-700" /> Facebook Page
            </label>
            <input
              type="url"
              maxLength={500}
              placeholder="https://facebook.com/yourpage"
              value={formData.facebookUrl}
              onChange={(e) => handleChange('facebookUrl', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 7. Floating Save Changes Action Bar */}
      <div className="sticky bottom-6 z-20 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-md">
        <div className="text-xs text-slate-500">
          {hasChanges ? (
            <span className="font-semibold text-amber-600">
              ● You have unsaved changes
            </span>
          ) : (
            <span>All changes saved to your profile</span>
          )}
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 transition"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>Save Profile</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

