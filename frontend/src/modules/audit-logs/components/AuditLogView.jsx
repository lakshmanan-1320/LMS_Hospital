'use client';

import React, { useEffect, useState } from 'react';
import { ScrollText, Search, RefreshCw, AlertCircle, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useAuditLogStore } from '../stores/useAuditLogStore';

const SOURCE_STYLES = {
  modules: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  roles: 'bg-violet-50 text-violet-700 border-violet-200',
  webinars: 'bg-teal-50 text-teal-700 border-teal-200',
  media: 'bg-amber-50 text-amber-800 border-amber-200',
};

const formatAction = (action) =>
  String(action || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());

const formatDate = (value) =>
  new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

/** Short human summary for module changes; other sources show their raw details on expand. */
function summarize(log) {
  if (log.source === 'roles') {
    const { added = [], removed = [], reason } = log.details || {};
    const parts = [];
    if (added.length) parts.push(`granted ${added.join(', ')}`);
    if (removed.length) parts.push(`revoked ${removed.join(', ')}`);
    return { changes: parts.join('; '), reason };
  }
  if (log.source !== 'modules') return null;
  const { before = {}, after = {}, reason } = log.details || {};
  const changes = [];
  if (before.isEnabled !== after.isEnabled) changes.push(after.isEnabled ? 'turned on' : 'turned off');
  if (before.publicVisible !== after.publicVisible) changes.push(after.publicVisible ? 'shown on public website' : 'hidden from public website');
  Object.keys(after.roleVisibility || {}).forEach((role) => {
    if (before.roleVisibility?.[role] !== after.roleVisibility[role]) {
      changes.push(`${after.roleVisibility[role] ? 'shown to' : 'hidden from'} ${role.toLowerCase().replace('_', ' ')}`);
    }
  });
  return { changes: changes.join(', '), reason };
}

function LogRow({ log }) {
  const [open, setOpen] = useState(false);
  const summary = summarize(log);

  return (
    <>
      <tr className="cursor-pointer hover:bg-gray-50" onClick={() => setOpen((v) => !v)}>
        <td className="px-4 py-3 align-top text-gray-400">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
        <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-gray-600">{formatDate(log.created_at)}</td>
        <td className="px-4 py-3 align-top">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${SOURCE_STYLES[log.source] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
            {log.source}
          </span>
        </td>
        <td className="px-4 py-3 align-top">
          <p className="text-sm font-medium text-gray-900">{formatAction(log.action)}</p>
          {log.subject && <p className="text-xs text-gray-500">{log.subject}</p>}
          {summary?.changes && <p className="mt-0.5 text-xs text-indigo-700">{summary.changes}</p>}
        </td>
        <td className="px-4 py-3 align-top text-xs text-gray-600">
          <p className="font-medium text-gray-800">{log.actor_name || '—'}</p>
          <p>{log.actor_email || 'System'}</p>
        </td>
      </tr>
      {open && (
        <tr className="bg-gray-50">
          <td />
          <td colSpan={4} className="px-4 pb-4 pt-1">
            {summary?.reason && (
              <p className="mb-2 text-sm text-gray-700">
                <b>Reason:</b> {summary.reason}
              </p>
            )}
            <pre className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-700">
              {JSON.stringify(log.details || {}, null, 2)}
            </pre>
            {log.ip_address && <p className="mt-2 text-xs text-gray-500">IP: {log.ip_address}</p>}
          </td>
        </tr>
      )}
    </>
  );
}

export default function AuditLogView() {
  const {
    logs, sources, total, totalPages, isLoading, error, filters, page,
    setFilter, resetFilters, setPage, fetchSources, fetchLogs,
  } = useAuditLogStore();
  const [searchInput, setSearchInput] = useState(filters.search);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  useEffect(() => {
    fetchLogs();
  }, [filters, page, fetchLogs]);

  // Debounce search typing
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== filters.search) setFilter('search', searchInput);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, filters.search, setFilter]);

  const hasFilters = filters.source || filters.search || filters.from || filters.to;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
            <ScrollText size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Audit Logs</h1>
            <p className="mt-0.5 text-sm text-gray-500">Who changed what across the platform. Read-only.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-[1fr_180px_160px_160px_auto]">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search action, subject or actor email"
            className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <select
          value={filters.source}
          onChange={(e) => setFilter('source', e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          aria-label="Source"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilter('from', e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          aria-label="From date"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilter('to', e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          aria-label="To date"
        />
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearchInput('');
              resetFilters();
            }}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <X size={14} /> Clear
          </button>
        ) : (
          <span />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle size={18} className="flex-shrink-0 text-red-600" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-left">
            <thead className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <LogRow key={`${log.source}-${log.id}`} log={log} />
              ))}
              {!isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">
                    No audit entries{hasFilters ? ' match these filters' : ' yet'}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
          <span>{total} entr{total === 1 ? 'y' : 'ies'}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(page - 1)}
              className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {totalPages === 0 ? 0 : page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
