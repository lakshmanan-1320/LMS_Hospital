'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Globe,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Star,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { courseService } from '../services/course.service';

export default function CourseLanguageSettingsModal({ isOpen, onClose, onUpdated }) {
  const [languages, setLanguages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    if (isOpen) {
      loadLanguages();
      setShowAddForm(false);
      setCode('');
      setName('');
      setNativeName('');
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      if (onUpdated) onUpdated();
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
      if (onUpdated) onUpdated();
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
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to update default status.');
    }
  };

  const handleDelete = async (lang) => {
    if (lang.isDefault) {
      setError('Cannot delete the default platform language.');
      return;
    }

    if (!confirm(`Are you sure you want to remove "${lang.name}"?`)) return;

    setError('');
    setSuccess('');
    try {
      await courseService.deleteCourseLanguage(lang.languageId);
      setSuccess(`Language "${lang.name}" removed.`);
      await loadLanguages();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to delete language.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-paper border border-line rounded-2xl p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cream border border-line flex items-center justify-center text-teal flex-shrink-0">
              <Globe size={20} />
            </div>
            <div>
              <div className="eyebrow flex items-center gap-1.5 text-[11px] font-bold text-teal uppercase mb-0.5">
                Admin Settings
              </div>
              <h2 className="font-heading text-xl font-bold text-ink">
                Course Language Settings
              </h2>
              <p className="text-xs text-muted">
                Maintain allowed instruction languages dynamically for course authors.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-cream transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-center gap-2 mb-4">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2 mb-4">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Add Language Button / Form */}
        <div className="mb-4">
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full py-2.5 px-3 border border-dashed border-line hover:border-teal rounded-xl text-xs font-bold text-teal flex items-center justify-center gap-1.5 transition-all hover:bg-cream/40 cursor-pointer"
            >
              <Plus size={15} />
              <span>Add New Supported Language</span>
            </button>
          ) : (
            <form
              onSubmit={handleAddLanguage}
              className="p-4 rounded-xl border border-line bg-cream/30 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink uppercase tracking-wider">
                  New Language Definition
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-muted hover:text-ink text-xs font-bold"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-ink uppercase tracking-wider mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ml"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={10}
                    required
                    className="w-full px-2.5 py-1.5 bg-paper border border-line rounded-lg text-xs font-mono text-ink outline-none focus:border-teal"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-ink uppercase tracking-wider mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Malayalam"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 bg-paper border border-line rounded-lg text-xs text-ink outline-none focus:border-teal"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-ink uppercase tracking-wider mb-1">
                    Native Script
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. മലയാളം"
                    value={nativeName}
                    onChange={(e) => setNativeName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-paper border border-line rounded-lg text-xs text-ink outline-none focus:border-teal"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Adding...' : 'Save Language'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Languages List */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted">
              Loading language configurations...
            </div>
          ) : (
            languages.map((lang) => (
              <div
                key={lang.languageId}
                className="p-3.5 rounded-xl border border-line bg-paper hover:bg-cream/20 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cream border border-line flex items-center justify-center text-xs font-mono font-bold text-teal flex-shrink-0">
                    {lang.code.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink">{lang.name}</span>
                      {lang.nativeName && (
                        <span className="text-[11px] text-muted font-medium">
                          ({lang.nativeName})
                        </span>
                      )}
                      {lang.isDefault && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal border border-teal/20">
                          Default
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted block">
                      Status: {lang.isActive ? 'Active in course selector' : 'Disabled / Hidden'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Default / Undefault Button */}
                  {lang.isDefault ? (
                    <button
                      type="button"
                      onClick={() => handleToggleDefault(lang)}
                      className="text-[10px] text-amber-700 hover:text-rose-600 font-semibold px-2 py-1 rounded border border-amber-200 bg-amber-50/50 hover:bg-rose-50 cursor-pointer transition-colors"
                      title="Click to remove default status (Undefault)"
                    >
                      Undefault
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleDefault(lang)}
                      className="text-[10px] text-muted hover:text-teal font-semibold px-2 py-1 rounded border border-line hover:bg-cream cursor-pointer transition-colors"
                      title="Set as default platform language"
                    >
                      Make Default
                    </button>
                  )}

                  {/* Active Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(lang)}
                    className="p-1 text-muted hover:text-ink cursor-pointer"
                    title={lang.isActive ? 'Deactivate language' : 'Activate language'}
                  >
                    {lang.isActive ? (
                      <ToggleRight size={22} className="text-teal" />
                    ) : (
                      <ToggleLeft size={22} className="text-muted/60" />
                    )}
                  </button>

                  {/* Delete Button */}
                  {!lang.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleDelete(lang)}
                      className="p-1 text-muted hover:text-rose-600 cursor-pointer"
                      title="Delete language"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-line mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-ink text-white hover:bg-ink/90 rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

