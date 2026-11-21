'use client';

import React, { useEffect, useState } from 'react';
import { UserCog, Plus, Search, AlertCircle, CheckCircle2, X, Loader2, Info } from 'lucide-react';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { useAdminAccountStore } from '../stores/useAdminAccountStore';

const ROLE_STYLES = {
  SUPER_ADMIN: 'bg-violet-50 text-violet-700 border-violet-200',
  ADMIN: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

function CreateAdminModal({ open, onClose }) {
  const { createAdmin, isSaving } = useAdminAccountStore();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm({ firstName: '', lastName: '', email: '', password: '' });
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const valid =
    form.firstName.trim() && form.lastName.trim() && /\S+@\S+\.\S+/.test(form.email) && form.password.length >= 8;

  const submit = async (e) => {
    e.preventDefault();
    const res = await createAdmin({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
    });
    if (res.success) onClose();
    else setError(res.error);
  };

  const input =
    'mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Admin account</h2>
            <p className="mt-1 text-sm text-gray-600">Admins run day-to-day operations: users, courses, orders, campaigns.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-gray-700">
            First name
            <input className={input} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} maxLength={100} />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Last name
            <input className={input} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} maxLength={100} />
          </label>
        </div>
        <label className="block text-sm font-medium text-gray-700">
          Email
          <input type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Temporary password
          <input
            type="password"
            className={input}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
          />
          <span className="mt-1 block text-xs font-normal text-gray-500">At least 8 characters. Share it securely; they can change it via “Forgot password”.</span>
        </label>
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />} Create admin
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminAccountsView() {
  const currentUserId = useAuthStore((s) => s.user?.userId);
  const {
    accounts, pagination, search, status, page, isLoading, updatingId, error, successMessage,
    setSearch, setStatus, setPage, clearMessages, fetchAccounts, toggleActive,
  } = useAdminAccountStore();
  const [searchInput, setSearchInput] = useState(search);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, [search, status, page, fetchAccounts]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) setSearch(searchInput);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, search, setSearch]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const t = setTimeout(clearMessages, 4000);
    return () => clearTimeout(t);
  }, [successMessage, clearMessages]);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
            <UserCog size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Admin Accounts</h1>
            <p className="mt-0.5 text-sm text-gray-500">Create and deactivate the accounts that run the platform.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus size={16} /> New admin
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        Students and Instructors are managed by Admins in User Management.
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

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or email"
            className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none sm:w-44"
          aria-label="Status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-left">
            <thead className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((a) => {
                const isSelf = a.user_id === currentUserId;
                return (
                  <tr key={a.user_id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {[a.first_name, a.last_name].filter(Boolean).join(' ') || '—'} {isSelf && <span className="text-xs text-gray-400">(you)</span>}
                      </p>
                      <p className="text-xs text-gray-500">{a.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(a.roles || []).map((r) => (
                          <span key={r} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ROLE_STYLES[r] || 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                            {r.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {a.last_login_at ? new Date(a.last_login_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf && (
                        <button
                          type="button"
                          disabled={updatingId === a.user_id}
                          onClick={() => toggleActive(a)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                            a.is_active ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {updatingId === a.user_id && <Loader2 size={12} className="animate-spin" />}
                          {a.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">No accounts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
          <span>{pagination.total || 0} account(s)</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1 || isLoading} onClick={() => setPage(page - 1)} className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40">
              Previous
            </button>
            <span>Page {pagination.totalPages ? page : 0} of {pagination.totalPages || 0}</span>
            <button
              type="button"
              disabled={page >= (pagination.totalPages || 0) || isLoading}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <CreateAdminModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
