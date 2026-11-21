'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Lock,
  Clock,
  Globe,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
  Loader2,
  Users,
  ShieldCheck,
  Link2,
  Pencil,
  Search,
  PowerOff,
  ArrowRight,
} from 'lucide-react';
import {
  usePlatformModuleStore,
  MODULE_VIEWS,
  rowMode,
  notApplicableReason,
  lockReason,
} from '../stores/usePlatformModuleStore';

const GROUPS = [
  { key: 'public', label: 'Public website' },
  { key: 'learning', label: 'Learning & purchasing' },
  { key: 'teaching', label: 'Teaching' },
  { key: 'operations', label: 'Operations' },
  { key: 'governance', label: 'Governance' },
];

const viewMeta = (view) => MODULE_VIEWS.find((v) => v.key === view) || MODULE_VIEWS[0];

const VIEW_HELP = {
  platform:
    'Master switch. A module that is off is unavailable to everyone, whatever the audience settings say (Admins can still view its past records; data is kept). Use the audience views to choose who sees modules that are on.',
  public: 'Choose which modules appear on the public website for every visitor, signed in or not, while the module is on.',
};

const valueLabels = (view) => (view === 'platform' ? ['On', 'Off'] : ['Visible', 'Hidden']);

function Toggle({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-indigo-600' : 'bg-gray-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function ModuleRow({ module, view, modulesByKey }) {
  const { isEditing, draft, valueOf, toggle } = usePlatformModuleStore();
  const value = valueOf(module);
  const mode = rowMode(module, view);
  const locked = mode === 'locked';
  const changed = module.key in draft;
  const [onLabel, offLabel] = valueLabels(view);
  const notApplicable = mode === 'na';

  return (
    <div
      className={`flex items-start gap-4 px-5 py-4 transition-colors ${changed ? 'bg-indigo-50/60' : ''} ${
        notApplicable ? 'bg-gray-50/60' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`text-sm font-semibold ${notApplicable ? 'text-gray-400' : 'text-gray-900'}`}>{module.name}</h3>
          {module.isCore && (
            <span
              title="Essential: turning this off or hiding it can break important features"
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
            >
              <AlertCircle size={10} /> Essential
            </span>
          )}
          {module.status === 'coming_soon' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              <Clock size={10} /> Coming soon
            </span>
          )}
          {isEditing && view !== 'platform' && !notApplicable && !module.isEnabled && module.status !== 'coming_soon' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
              <PowerOff size={10} /> Off for everyone
            </span>
          )}
          {changed && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">Changed</span>
          )}
        </div>
        {module.description && (
          <p className={`mt-1 text-xs leading-relaxed ${notApplicable ? 'text-gray-400' : 'text-gray-500'}`}>{module.description}</p>
        )}
        {view === 'platform' && (module.dependsOn?.length > 0 || module.requiredBy?.length > 0) && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
            <Link2 size={11} />
            {module.dependsOn?.length > 0 && (
              <span>Needs {module.dependsOn.map((k) => modulesByKey[k]?.name || k).join(', ')}</span>
            )}
            {module.requiredBy?.length > 0 && (
              <span>Required by {module.requiredBy.map((k) => modulesByKey[k]?.name || k).join(', ')}</span>
            )}
          </p>
        )}
      </div>

      <div className="flex w-44 flex-shrink-0 items-center justify-end gap-3 pt-0.5">
        {notApplicable ? (
          <span className="text-right text-xs font-medium text-gray-400" title={notApplicableReason(module, view)}>
            {notApplicableReason(module, view)}
          </span>
        ) : locked ? (
          <span
            title={lockReason(module, view)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500"
          >
            <Lock size={11} /> {module.status === 'coming_soon' && view === 'platform' ? 'Not built yet' : 'Required'}
          </span>
        ) : isEditing ? (
          <>
            <span className={`text-xs font-medium ${value ? 'text-indigo-700' : 'text-gray-400'}`}>
              {value ? onLabel : offLabel}
            </span>
            <Toggle
              checked={value}
              label={`${module.name}: ${value ? onLabel : offLabel}`}
              onChange={() => toggle(module)}
            />
          </>
        ) : (
          // Read mode: a clear status badge; switches appear after "Edit".
          <span
            aria-label={`${module.name}: ${value ? onLabel : offLabel}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              value ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${value ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {value ? onLabel : offLabel}
          </span>
        )}
      </div>
    </div>
  );
}

/** Mounted only while open, so the reason starts empty every time. */
function ReviewModal() {
  const { view, impacts, isImpactLoading, isSaving, saveError, closeReview, save, getChanges } = usePlatformModuleStore();
  const [reason, setReason] = useState('');
  const changes = getChanges();
  const [onLabel, offLabel] = valueLabels(view);
  const meta = viewMeta(view);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6 pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Review changes</h2>
            <p className="mt-1 text-sm text-gray-500">
              {view === 'platform' ? 'Master switch (everyone)' : `Visibility for ${meta.short}`} · {changes.length} change
              {changes.length === 1 ? '' : 's'}
            </p>
          </div>
          <button type="button" onClick={closeReview} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-6">
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {changes.map(({ module, from, to }) => (
              <li key={module.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="font-medium text-gray-900">{module.name}</span>
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <span className="text-gray-400">{from ? onLabel : offLabel}</span>
                  <ArrowRight size={12} className="text-gray-400" />
                  <span className={`font-semibold ${to ? 'text-emerald-700' : 'text-rose-700'}`}>{to ? onLabel : offLabel}</span>
                </span>
              </li>
            ))}
          </ul>

          {changes.some((c) => c.module.isCore && c.from && !c.to) && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>
                You are turning off or hiding essential modules (
                {changes.filter((c) => c.module.isCore && c.from && !c.to).map((c) => c.module.name).join(', ')}).
                Affected users may lose important features, such as access to purchased courses or payments.
              </span>
            </div>
          )}

          {isImpactLoading && (
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
              <Loader2 size={16} className="animate-spin" /> Checking impact…
            </div>
          )}

          {impacts.length > 0 && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">What this affects</p>
              {impacts.map((impact) => (
                <div key={impact.key}>
                  <p className="font-medium">{impact.name}</p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    <li className="flex items-center gap-1.5">
                      <Users size={12} /> {impact.affectedUsers} active account(s)
                      {view === 'platform' && impact.affectsPublicWebsite && (
                        <>
                          {' '}+ <Globe size={12} /> public visitors
                        </>
                      )}
                    </li>
                    {impact.workload.map((w) => (
                      <li key={w.label}>
                        {w.label}: <b>{w.count}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="space-y-1 border-t border-amber-200 pt-2 text-xs text-amber-800">
                {impacts[0].preserved.map((p) => (
                  <p key={p} className="flex items-start gap-1.5">
                    <ShieldCheck size={12} className="mt-0.5 flex-shrink-0" /> {p}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="module-change-reason" className="text-sm font-medium text-gray-700">
              Reason <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="module-change-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are these changes being made? (saved in the audit log)"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-xs text-gray-400">At least 5 characters.</p>
          </div>

          {saveError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> {saveError}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
          <button type="button" onClick={closeReview} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Back
          </button>
          <button
            type="button"
            disabled={reason.trim().length < 5 || isSaving || isImpactLoading}
            onClick={() => save(reason.trim())}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />} Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModuleManagementView() {
  const {
    modules, view, isEditing, isLoading, error, successMessage,
    isReviewOpen, fetchModules, setView, startEditing, cancelEditing, openReview, getChanges, valueOf, clearSuccess,
  } = usePlatformModuleStore();
  const [search, setSearch] = useState('');
  const [showNotApplicable, setShowNotApplicable] = useState(true);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const t = setTimeout(clearSuccess, 4000);
    return () => clearTimeout(t);
  }, [successMessage, clearSuccess]);

  const changes = getChanges();
  const meta = viewMeta(view);
  const modulesByKey = useMemo(() => Object.fromEntries(modules.map((m) => [m.key, m])), [modules]);

  // Every module is listed in every view and is switchable, except the safety locks.
  const MODE_ORDER = { toggle: 0, locked: 1, na: 2 };
  const inView = modules.filter((m) => rowMode(m, view) === 'toggle');
  const term = search.trim().toLowerCase();

  // Read mode: only what this audience actually has (module on + visible). Edit mode: every module.
  const isAvailable = (m) => {
    const mode = rowMode(m, view);
    if (mode === 'na') return false;
    if (view === 'platform') return m.isEnabled;
    return m.isEnabled && (mode === 'locked' || valueOf(m));
  };
  const availableCount = modules.filter(isAvailable).length;

  const visible = modules
    .filter((m) => (isEditing ? showNotApplicable || rowMode(m, view) !== 'na' : isAvailable(m)))
    .filter((m) => !term || m.name.toLowerCase().includes(term) || (m.description || '').toLowerCase().includes(term))
    .sort((a, b) => MODE_ORDER[rowMode(a, view)] - MODE_ORDER[rowMode(b, view)] || a.sortOrder - b.sortOrder);
  const activeCount = inView.filter((m) => valueOf(m)).length;
  const naCount = modules.filter((m) => rowMode(m, view) === 'na').length;

  const changeView = (next) => {
    if (next === view) return;
    if (changes.length > 0 && !window.confirm('Discard your unsaved changes?')) return;
    setSearch('');
    setView(next);
  };

  const help =
    VIEW_HELP[view] ||
    `Choose which modules ${meta.short} can see and use while the module is on. What they can do inside a module is set in Roles & Permissions.`;

  return (
    <div className="w-full space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
          <Boxes size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Module Management</h1>
          <p className="mt-0.5 text-sm text-gray-500">Control which parts of the platform are available, and to whom.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-end">
            <div className="sm:w-72">
              <label htmlFor="module-view" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Settings for
              </label>
              <select
                id="module-view"
                value={view}
                onChange={(e) => changeView(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {[...new Set(MODULE_VIEWS.map((v) => v.group))].map((group) => (
                  <optgroup key={group} label={group}>
                    {MODULE_VIEWS.filter((v) => v.group === group).map((v) => (
                      <option key={v.key} value={v.key}>{v.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="relative sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search modules"
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={fetchModules}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  aria-label="Refresh"
                >
                  <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  onClick={startEditing}
                  disabled={isLoading || inView.length === 0}
                  title={inView.length === 0 ? `Nothing to change for ${meta.short}` : undefined}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Pencil size={15} /> Edit
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={openReview}
                  disabled={changes.length === 0}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save changes{changes.length > 0 ? ` (${changes.length})` : ''}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-1 border-t border-gray-100 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-gray-500">{help}</p>
          {!isEditing ? (
            <p className="flex-shrink-0 text-sm font-medium text-gray-700">
              {availableCount} module{availableCount === 1 ? '' : 's'} {view === 'platform' ? 'on' : `available to ${meta.short}`}
            </p>
          ) : view === 'platform' ? (
            <p className="flex-shrink-0 font-medium text-gray-700">
              {activeCount} of {inView.length} on
            </p>
          ) : (
            <p className="flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-gray-600">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {activeCount} visible</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-300" /> {inView.length - activeCount} hidden</span>
              {naCount > 0 && <span className="text-gray-400">· {naCount} without public pages</span>}
            </p>
          )}
        </div>
      </div>

      {!isEditing && (
        <p className="text-sm text-gray-500">
          Showing only modules {view === 'platform' ? 'that are on' : `${meta.short} can use right now`}. Click{' '}
          <b className="font-semibold text-gray-700">Edit</b> to see every module and switch any of them on or off.
        </p>
      )}

      {isEditing && view === 'public' && naCount > 0 && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showNotApplicable}
            onChange={(e) => setShowNotApplicable(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Show modules without public pages ({naCount})
        </label>
      )}

      {isEditing && (
        <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <Pencil size={15} /> Editing {view === 'platform' ? 'the master switch' : `visibility for ${meta.short}`}. Toggle modules,
          then save.
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 size={18} className="flex-shrink-0 text-emerald-600" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle size={18} className="flex-shrink-0 text-red-600" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Module list */}
      {isLoading && modules.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center gap-3 text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span>Loading modules…</span>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          {term ? (
            <>No modules match “{search}”.</>
          ) : isEditing ? (
            'No modules to show.'
          ) : (
            <>No modules are available to {meta.short} right now. Click Edit to switch some on.</>
          )}
        </div>
      ) : (
        GROUPS.map((group) => {
          const items = visible.filter((m) => m.group === group.key);
          if (items.length === 0) return null;
          return (
            <section key={group.key} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{group.label}</h2>
                <span className="text-xs text-gray-400">{items.length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {items.map((m) => (
                  <ModuleRow key={m.key} module={m} view={view} modulesByKey={modulesByKey} />
                ))}
              </div>
            </section>
          );
        })
      )}


      {/* Sticky save bar for long lists */}
      {isEditing && changes.length > 0 && (
        <div className="sticky bottom-4 z-30 flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-white p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700">
            <b>{changes.length}</b> unsaved change{changes.length === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={cancelEditing} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" onClick={openReview} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Review &amp; save
            </button>
          </div>
        </div>
      )}

      {isReviewOpen && <ReviewModal />}
    </div>
  );
}
