'use client';

import { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Star,
  ToggleLeft,
  ToggleRight,
  RotateCw,
  Search,
} from 'lucide-react';
import { courseService } from '../services/course.service';

export default function CourseLanguageSettingsView({ role = 'admin' }) {
  const [languages, setLanguages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // New Language Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [nativeName, setNativeName] = useState('');

  const loadLanguages = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await courseService.getAdminLanguages();
      setLanguages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load course languages.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLanguages();
  }, []);

  const handleAddLanguage = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!code.trim() || !name.trim()) {
      setError('Language code and name are required.');
      return;
    }

    setIsSaving(true);
    try {
      await courseService.createCourseLanguage({
        code: code.trim().toLowerCase(),
        name: name.trim(),
        nativeName: nativeName.trim() || undefined,
        isActive: true,
      });
      setSuccess(`Language "${name}" added successfully.`);
      setCode('');
      setName('');
      setNativeName('');
      setShowAddForm(false);
      await loadLanguages();
    } catch (err) {
      setError(err.message || 'Failed to add language.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (lang) => {
    setError('');
    setSuccess('');
    try {
      await courseService.updateCourseLanguage(lang.languageId, {
        isActive: !lang.isActive,
      });
      await loadLanguages();
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    }
  };

  const handleToggleDefault = async (lang) => {
    setError('');
    setSuccess('');
    const newDefaultState = !lang.isDefault;
    try {
      await courseService.updateCourseLanguage(lang.languageId, {
        isDefault: newDefaultState,
      });
      setSuccess(
        newDefaultState
          ? `"${lang.name}" is now the default language.`
          : `"${lang.name}" is no longer default.`
      );
      await loadLanguages();
    } catch (err) {
      setError(err.message || 'Failed to update default status.');
    }
  };

  const handleDelete = async (lang) => {
    if (lang.isDefault) {
      setError('Cannot delete the default platform language.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${lang.name}"?`)) {
      return;
    }

    setError('');
    setSuccess('');
    try {
      await courseService.deleteCourseLanguage(lang.languageId);
      setSuccess(`Language "${lang.name}" removed.`);
      await loadLanguages();
    } catch (err) {
      setError(err.message || 'Failed to delete language.');
    }
  };

  const filteredLanguages = languages.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q) ||
      (l.nativeName && l.nativeName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-ink">
            Global Settings
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Configure system-wide academic parameters, course instruction languages, and platform defaults.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2.5 bg-teal hover:bg-teal-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer flex-shrink-0"
        >
          <Plus size={16} />
          <span>Add Language</span>
        </button>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-700 flex items-center gap-2.5">
          <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800 flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Add Language Form Card */}
      {showAddForm && (
        <form
          onSubmit={handleAddLanguage}
          className="bg-paper border border-line rounded-2xl p-6 shadow-sm space-y-4 animate-fadeIn"
        >
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div>
              <h3 className="text-sm font-bold text-ink">Register New Course Language</h3>
              <p className="text-[11px] text-muted">
                Available to instructors in the course creation and editing dropdown.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-muted hover:text-ink font-semibold"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-ink uppercase tracking-wider mb-1">
                ISO Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. ta, hi, fr, es"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={10}
                required
                className="w-full px-3 py-2 bg-paper border border-line rounded-lg text-xs font-mono text-ink outline-none focus:border-teal"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-ink uppercase tracking-wider mb-1">
                English Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Tamil, Hindi, French"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                required
                className="w-full px-3 py-2 bg-paper border border-line rounded-lg text-xs text-ink outline-none focus:border-teal"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-ink uppercase tracking-wider mb-1">
                Native Script (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. தமிழ், हिन्दी, Français"
                value={nativeName}
                onChange={(e) => setNativeName(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2 bg-paper border border-line rounded-lg text-xs text-ink outline-none focus:border-teal"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Language'}
            </button>
          </div>
        </form>
      )}

      {/* Main Settings Panel */}
      <div className="bg-paper border border-line rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal/10 border border-teal/20 flex items-center justify-center text-teal">
              <Globe size={18} />
            </div>
            <div>
              <h2 className="text-base font-heading font-bold text-ink">
                Course Instruction Languages
              </h2>
              <p className="text-xs text-muted">
                Languages active here appear dynamically in instructor and course catalog dropdowns.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Filter languages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-44 pl-8 pr-3 py-1.5 bg-paper border border-line rounded-lg text-xs text-ink outline-none focus:border-teal"
              />
            </div>
            <button
              type="button"
              onClick={loadLanguages}
              disabled={isLoading}
              title="Refresh language list"
              className="p-2 border border-line rounded-lg text-muted hover:text-ink hover:bg-cream transition-colors cursor-pointer"
            >
              <RotateCw size={14} className={isLoading ? 'animate-spin text-teal' : ''} />
            </button>
          </div>
        </div>

        {/* Language Table */}
        {isLoading && languages.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-muted">
            <div className="w-7 h-7 border-3 border-teal border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs font-semibold">Loading platform languages...</span>
          </div>
        ) : filteredLanguages.length === 0 ? (
          <div className="py-10 text-center text-muted text-xs">
            No matching languages found.
          </div>
        ) : (
          <div className="divide-y divide-line/60">
            {filteredLanguages.map((lang) => (
              <div
                key={lang.languageId || lang.code}
                className="py-3.5 flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-cream text-muted border border-line">
                    {lang.code.toUpperCase()}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink">{lang.name}</span>
                      {lang.nativeName && (
                        <span className="text-xs text-muted font-normal">
                          ({lang.nativeName})
                        </span>
                      )}
                      {lang.isDefault && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Star size={10} className="fill-amber-500 text-amber-500" />
                          Default
                        </span>
                      )}
                      {!lang.isActive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Default / Undefault Button */}
                  {lang.isDefault ? (
                    <button
                      type="button"
                      onClick={() => handleToggleDefault(lang)}
                      className="px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:text-rose-600 bg-amber-50/50 hover:bg-rose-50 rounded-md border border-amber-200 transition-colors cursor-pointer"
                      title="Click to remove default status (Undefault)"
                    >
                      Undefault
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleDefault(lang)}
                      className="px-2.5 py-1 text-[11px] font-bold text-muted hover:text-teal hover:bg-cream rounded-md border border-line transition-colors cursor-pointer"
                      title="Set as default platform language"
                    >
                      Make Default
                    </button>
                  )}

                  {/* Toggle Active */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(lang)}
                    disabled={lang.isDefault}
                    title={
                      lang.isDefault
                        ? 'Default language must remain active'
                        : lang.isActive
                        ? 'Click to deactivate'
                        : 'Click to activate'
                    }
                    className={`p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      lang.isActive ? 'text-teal hover:bg-teal/10' : 'text-muted hover:bg-cream'
                    }`}
                  >
                    {lang.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>

                  {/* Delete */}
                  {!lang.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleDelete(lang)}
                      title="Delete language"
                      className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

