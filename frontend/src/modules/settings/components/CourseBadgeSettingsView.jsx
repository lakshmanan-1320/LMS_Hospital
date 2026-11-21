'use client';

import React, { useEffect, useState } from 'react';
import { Award, Star, Sparkles, Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { settingsService } from '../services/settings.service';

const RULES = [
  {
    key: 'bestseller',
    icon: Award,
    title: 'Bestseller',
    badgeClass: 'bg-teal-100 text-teal-900',
    describe: (r) => `Top ${r.topPercent}% of courses in their category by enrollments in the last ${r.windowDays} days, with at least ${r.minStudents} students.`,
    fields: [
      { name: 'topPercent', label: 'Top % of the category', min: 1, max: 100, step: 1, suffix: '%' },
      { name: 'windowDays', label: 'Enrollments counted over', min: 1, max: 365, step: 1, suffix: 'days' },
      { name: 'minStudents', label: 'Minimum students', min: 0, max: 10000000, step: 1 },
    ],
  },
  {
    key: 'highestRated',
    icon: Star,
    title: 'Highest rated',
    badgeClass: 'bg-amber-100 text-amber-900',
    describe: (r) => `Average rating of ${r.minRating} or more from at least ${r.minReviews} reviews.`,
    fields: [
      { name: 'minRating', label: 'Minimum average rating', min: 1, max: 5, step: 0.1, suffix: '★' },
      { name: 'minReviews', label: 'Minimum reviews', min: 1, max: 10000000, step: 1 },
    ],
  },
  {
    key: 'newCourse',
    icon: Sparkles,
    title: 'New',
    badgeClass: 'bg-violet-100 text-violet-900',
    describe: (r) => `Published within the last ${r.withinDays} days.`,
    fields: [{ name: 'withinDays', label: 'Published within', min: 1, max: 365, step: 1, suffix: 'days' }],
  },
];

/**
 * Admin / Super Admin: rules for the course badges shown on course cards and course pages.
 */
export default function CourseBadgeSettingsView() {
  const [rules, setRules] = useState(null);
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    settingsService
      .getCourseBadgeRules()
      .then((r) => {
        setRules(r);
        setSaved(r);
      })
      .catch((err) => setMessage({ type: 'error', text: err?.response?.data?.message || err?.message || 'Failed to load badge rules.' }))
      .finally(() => setLoading(false));
  }, []);

  const update = (key, field, value) => setRules((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  const dirty = JSON.stringify(rules) !== JSON.stringify(saved);

  const validate = () => {
    for (const rule of RULES) {
      for (const f of rule.fields) {
        const v = Number(rules[rule.key][f.name]);
        if (!Number.isFinite(v) || v < f.min || v > f.max) return `${rule.title}: ${f.label} must be between ${f.min} and ${f.max}.`;
      }
    }
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) return setMessage({ type: 'error', text: problem });
    setSaving(true);
    setMessage(null);
    try {
      const payload = Object.fromEntries(
        RULES.map((rule) => [
          rule.key,
          {
            enabled: Boolean(rules[rule.key].enabled),
            ...Object.fromEntries(rule.fields.map((f) => [f.name, Number(rules[rule.key][f.name])])),
          },
        ]),
      );
      const updated = await settingsService.updateCourseBadgeRules(payload);
      setRules(updated);
      setSaved(updated);
      setMessage({ type: 'success', text: 'Badge rules saved. Course cards and pages use them right away.' });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save badge rules.';
      setMessage({ type: 'error', text: Array.isArray(msg) ? msg.join(', ') : msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-3 text-gray-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <span>Loading badge rules…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Course badges</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose when courses earn a badge on course cards and course pages. Badges update automatically as enrollments and reviews change.
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-medium ${
            message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />} {message.text}
        </div>
      )}

      {rules &&
        RULES.map((rule) => {
          const r = rules[rule.key];
          return (
            <section key={rule.key} className={`rounded-2xl border bg-white p-5 transition ${r.enabled ? 'border-gray-200' : 'border-dashed border-gray-300'}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-700">
                    <rule.icon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{rule.title}</h3>
                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${rule.badgeClass}`}>{rule.title}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{r.enabled ? rule.describe(r) : 'Not shown on any course.'}</p>
                  </div>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(r.enabled)}
                    onChange={(e) => update(rule.key, 'enabled', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show this badge
                </label>
              </div>

              <div className={`mt-4 grid gap-4 sm:grid-cols-3 ${r.enabled ? '' : 'pointer-events-none opacity-50'}`}>
                {rule.fields.map((f) => (
                  <label key={f.name} className="block text-sm font-medium text-gray-700">
                    {f.label}
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={r[f.name]}
                        onChange={(e) => update(rule.key, f.name, e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                      {f.suffix && <span className="text-sm text-gray-500">{f.suffix}</span>}
                    </div>
                  </label>
                ))}
              </div>
            </section>
          );
        })}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save badge rules
        </button>
      </div>
    </div>
  );
}
