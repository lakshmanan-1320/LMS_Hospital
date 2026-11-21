'use client';

import { Award, Plus, Trash2 } from 'lucide-react';

export default function QualificationsRepeater({
  qualifications = [],
  onChange,
  maxItems = 20,
}) {
  const addQualification = () => {
    if (qualifications.length >= maxItems) return;
    onChange([
      ...qualifications,
      {
        title: '',
        issuer: '',
        year: new Date().getFullYear(),
        description: '',
      },
    ]);
  };

  const updateItem = (index, field, value) => {
    const updated = [...qualifications];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeItem = (index) => {
    onChange(qualifications.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Degrees, Certifications & Credentials
          </h3>
          <p className="text-xs text-slate-400">
            Showcase your academic credentials and verified industry certificates (max {maxItems}).
          </p>
        </div>
        <button
          type="button"
          onClick={addQualification}
          disabled={qualifications.length >= maxItems}
          className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition"
        >
          <Plus size={15} /> Add Qualification
        </button>
      </div>

      {qualifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <Award size={28} className="mx-auto text-slate-300" />
          <p className="mt-2 text-xs font-medium text-slate-500">
            No qualifications added yet.
          </p>
          <p className="text-xs text-slate-400">
            Click &quot;Add Qualification&quot; above to add your degrees or professional certifications.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {qualifications.map((item, idx) => (
            <div
              key={idx}
              className="relative rounded-xl border border-slate-200 bg-slate-50/40 p-4 transition focus-within:border-violet-400 focus-within:bg-white"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Degree / Certification Title *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g. AWS Certified Solutions Architect"
                    value={item.title || ''}
                    onChange={(e) => updateItem(idx, 'title', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Issuing Organization / University *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g. Amazon Web Services"
                    value={item.issuer || ''}
                    onChange={(e) => updateItem(idx, 'issuer', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Year
                  </label>
                  <input
                    type="number"
                    min={1950}
                    max={2100}
                    placeholder="e.g. 2022"
                    value={item.year || ''}
                    onChange={(e) =>
                      updateItem(
                        idx,
                        'year',
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-end sm:col-span-1 justify-end">
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                    title="Remove qualification"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

