'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plug,
  CreditCard,
  Mail,
  Smartphone,
  MessageCircle,
  Video,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Server,
} from 'lucide-react';
import { settingsService } from '../services/settings.service';

const CATEGORIES = [
  { key: 'payments', label: 'Payments' },
  { key: 'messaging', label: 'Messaging' },
  { key: 'meetings', label: 'Meetings' },
];

const ICONS = {
  razorpay: CreditCard,
  email: Mail,
  sms: Smartphone,
  whatsapp: MessageCircle,
  google_meet: Video,
  zoom: Video,
  zoho: Video,
};

const STATUS = {
  connected: { label: 'Connected', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  configured: { label: 'Configured', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  test_mode: { label: 'Test mode', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  error: { label: 'Error', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  not_configured: { label: 'Not configured', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

/** Where each integration is configured (existing Super Admin screens). */
const MANAGE_ROUTES = {
  email_gateway: '/dashboard/super-admin/campaigns/email',
  sms_gateway: '/dashboard/super-admin/campaigns/sms',
  whatsapp_gateway: '/dashboard/super-admin/campaigns/whatsapp',
  settings: '/dashboard/super-admin/settings',
};

export default function IntegrationsHubView() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await settingsService.getIntegrationsOverview();
      setIntegrations(res?.integrations || []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load integrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
            <Plug size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Integrations</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Status of every external service the platform connects to. Open one to configure it.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle size={18} className="flex-shrink-0 text-red-600" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {loading && integrations.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center gap-3 text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span>Loading integrations…</span>
        </div>
      ) : (
        CATEGORIES.map((cat) => {
          const items = integrations.filter((i) => i.category === cat.key);
          if (items.length === 0) return null;
          return (
            <section key={cat.key} className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{cat.label}</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                  const Icon = ICONS[item.key] || Plug;
                  const status = STATUS[item.status] || STATUS.not_configured;
                  const href = MANAGE_ROUTES[item.managedIn];
                  return (
                    <div key={item.key} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-700">
                            <Icon size={20} />
                          </div>
                          <h3 className="text-sm font-semibold text-gray-900">{item.name}</h3>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="mt-3 flex-1 space-y-1 text-xs text-gray-600">
                        {item.identity && <p className="truncate">{item.identity}</p>}
                        {item.lastValidatedAt && (
                          <p>Last verified {new Date(item.lastValidatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        )}
                        {item.lastError && <p className="text-rose-600">Last error: {item.lastError}</p>}
                        {item.key === 'razorpay' && item.details && (
                          <p>
                            Mode: <b className="capitalize">{item.details.mode}</b> · Webhook secret{' '}
                            {item.details.webhookSecret ? 'set' : 'missing'}
                          </p>
                        )}
                      </div>
                      <div className="mt-4 border-t border-gray-100 pt-3">
                        {href ? (
                          <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                            Configure <ArrowRight size={14} />
                          </Link>
                        ) : (
                          <p className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                            <Server size={13} /> Set in the server environment (.env)
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
