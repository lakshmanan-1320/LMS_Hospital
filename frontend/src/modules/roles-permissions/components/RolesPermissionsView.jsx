'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyRound,
  Lock,
  Users,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  X,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useRolesPermissionsStore } from '../stores/useRolesPermissionsStore';

const ROLE_LABELS = { SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', INSTRUCTOR: 'Instructor', STUDENT: 'Student' };

/** Mounted only while open, so the reason starts empty every time. */
function SaveModal({ onClose, role, diff }) {
  const { saveDraft, isSaving, saveError } = useRolesPermissionsStore();
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Save {ROLE_LABELS[role?.name] || role?.name} permissions</h2>
            <p className="mt-1 text-sm text-gray-600">
              Applies on the next request for {role?.activeUsers ?? 0} active {ROLE_LABELS[role?.name] || role?.name} account(s).
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
          {diff.added.length > 0 && (
            <p className="text-emerald-700">
              <b>Grant:</b> {diff.added.join(', ')}
            </p>
          )}
          {diff.removed.length > 0 && (
            <p className="text-rose-700">
              <b>Revoke:</b> {diff.removed.join(', ')}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="role-permission-reason" className="text-sm font-medium text-gray-700">
            Reason <span className="text-rose-600">*</span>
          </label>
          <textarea
            id="role-permission-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this change being made? (recorded in the audit log)"
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <p className="mt-1 text-xs text-gray-500">At least 5 characters.</p>
        </div>

        {saveError && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> {saveError}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={reason.trim().length < 5 || isSaving}
            onClick={async () => {
              const res = await saveDraft(reason.trim());
              if (res.success) onClose();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />} Save permissions
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RolesPermissionsView() {
  const {
    roles, permissions, selectedRole, draft, isLoading, error, successMessage,
    fetchMatrix, selectRole, togglePermission, resetDraft, getDiff, clearSuccess,
  } = useRolesPermissionsStore();
  const [saveOpen, setSaveOpen] = useState(false);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const t = setTimeout(clearSuccess, 4000);
    return () => clearTimeout(t);
  }, [successMessage, clearSuccess]);

  const role = roles.find((r) => r.name === selectedRole);
  const locked = !role || role.isLocked || !role.isEditable;
  const diff = getDiff();
  const dirty = diff.added.length + diff.removed.length > 0;

  const groups = useMemo(() => {
    const map = new Map();
    permissions.forEach((p) => {
      const key = p.moduleName || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return [...map.entries()];
  }, [permissions]);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
            <KeyRound size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Roles &amp; Permissions</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Choose what each role is allowed to do. Module on/off and visibility are managed in Module Management.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchMatrix}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

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

      {/* Role tabs */}
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <button
            key={r.name}
            type="button"
            onClick={() => {
              if (dirty && !window.confirm('Discard unsaved changes?')) return;
              selectRole(r.name);
            }}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              selectedRole === r.name ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'
            }`}
          >
            {r.isLocked && <Lock size={13} />}
            {ROLE_LABELS[r.name] || r.name}
            <span className={`rounded-full px-1.5 text-[11px] ${selectedRole === r.name ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>
              {r.permissions.length}
            </span>
          </button>
        ))}
      </div>

      {role && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <Users size={15} /> {role.activeUsers} active account(s)
          </span>
          {role.description && <span>{role.description}</span>}
          {role.isLocked && (
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <Lock size={14} /> Locked: Super Admin keeps the governance permissions only.
            </span>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>
          Permissions control course, curriculum, media, category, enrollment and instructor-profile actions. Some areas
          (orders, refunds, coupons, campaigns) are fixed to the Admin role. Governance permissions always stay with Super Admin.
        </span>
      </div>

      {isLoading && roles.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center gap-3 text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span>Loading roles…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {groups.map(([moduleName, perms]) => (
            <section key={moduleName} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{moduleName}</h2>
              </div>
              <ul className="divide-y divide-gray-100">
                {perms.map((p) => {
                  const checked = draft.includes(p.code);
                  const disabled = locked || p.isGovernance;
                  return (
                    <li key={p.code}>
                      <label className={`flex items-start gap-3 px-5 py-3 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => togglePermission(p.code)}
                          aria-label={p.code}
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 font-mono text-xs font-semibold text-gray-900">
                            {p.code}
                            {p.isGovernance && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-violet-700">
                                <ShieldCheck size={10} /> Super Admin only
                              </span>
                            )}
                          </span>
                          {p.description && <span className="mt-0.5 block text-xs text-gray-500">{p.description}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Sticky save bar */}
      {dirty && !locked && (
        <div className="sticky bottom-4 z-30 flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-white p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700">
            Unsaved changes for <b>{ROLE_LABELS[selectedRole] || selectedRole}</b>:{' '}
            <span className="text-emerald-700">+{diff.added.length}</span> /{' '}
            <span className="text-rose-700">-{diff.removed.length}</span>
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={resetDraft} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Discard
            </button>
            <button type="button" onClick={() => setSaveOpen(true)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Review &amp; save
            </button>
          </div>
        </div>
      )}

      {saveOpen && <SaveModal onClose={() => setSaveOpen(false)} role={role} diff={diff} />}
    </div>
  );
}
