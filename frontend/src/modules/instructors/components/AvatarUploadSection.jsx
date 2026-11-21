'use client';

import { useRef } from 'react';
import { Camera, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, ExternalLink } from 'lucide-react';

export default function AvatarUploadSection({
  userId,
  slug,
  avatarUrl,
  firstName = '',
  lastName = '',
  email = '',
  isPublic = false,
  onToggleVisibility,
  onUploadAvatar,
  isUploading = false,
}) {
  const fileInputRef = useRef(null);

  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'IN';

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadAvatar(file);
      e.target.value = '';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Avatar & Identity */}
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-violet-100 bg-violet-50 text-violet-700 flex items-center justify-center font-bold text-2xl shadow-inner">
              {avatarUrl ? (
                <img
                  src={avatarUrl.startsWith('http') ? avatarUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${avatarUrl}`}
                  alt={`${firstName} ${lastName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white shadow-md hover:bg-violet-700 transition disabled:opacity-50"
              title="Upload new profile photo"
            >
              {isUploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Camera size={16} />
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {firstName} {lastName}
            </h2>
            <p className="text-sm text-slate-500">{email}</p>
            <p className="mt-1 text-xs text-slate-400">
              JPG, PNG, or WebP. Maximum file size: 2MB.
            </p>
          </div>
        </div>

        {/* Right: Public Profile Visibility Toggle */}
        <div className="flex flex-col sm:items-end gap-2">
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2">
              {isPublic ? (
                <Eye size={18} className="text-emerald-600" />
              ) : (
                <EyeOff size={18} className="text-slate-400" />
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Public Directory
                </p>
                <p className="text-xs text-slate-500">
                  {isPublic
                    ? 'Your profile is publicly visible'
                    : 'Profile is private (hidden from public)'}
                </p>
              </div>
            </div>

            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => onToggleVisibility(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-300 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
            </label>
          </div>

          {isPublic && (slug || userId) && (
            <a
              href={`/instructors/${slug || userId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition shadow-2xs"
            >
              <span>View Public Profile</span>
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

