'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

export default function SkillsTagInput({
  label,
  placeholder = 'Add an item and press Enter...',
  tags = [],
  onChange,
  maxTags = 30,
  maxCharLength = 50,
  helperText,
}) {
  const [inputVal, setInputVal] = useState('');

  const addTag = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    if (tags.length >= maxTags) return;

    // Case-insensitive duplicate check
    const isDuplicate = tags.some(
      (t) => t.toLowerCase() === trimmed.toLowerCase(),
    );

    if (!isDuplicate) {
      onChange([...tags, trimmed.slice(0, maxCharLength)]);
    }

    setInputVal('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const removeTag = (indexToRemove) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-800">{label}</label>
        <span className="text-xs text-slate-400">
          {tags.length} / {maxTags} max
        </span>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={maxCharLength}
          placeholder={tags.length >= maxTags ? 'Limit reached' : placeholder}
          disabled={tags.length >= maxTags}
          className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none disabled:bg-slate-50"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={!inputVal.trim() || tags.length >= maxTags}
          className="flex items-center gap-1 rounded-xl bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {helperText && <p className="text-xs text-slate-400">{helperText}</p>}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {tags.map((tag, idx) => (
            <span
              key={`${tag}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-1 text-xs font-semibold text-violet-800"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(idx)}
                className="text-violet-500 hover:text-violet-900 transition"
                title={`Remove ${tag}`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

