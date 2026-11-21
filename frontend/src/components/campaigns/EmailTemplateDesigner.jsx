'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Laptop,
  Smartphone,
  Sparkles,
  Code2,
  Eye,
  Tag,
  CheckCircle2,
  AlertCircle,
  FileText,
  RotateCcw,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';

const COMMON_VARIABLES = [
  { key: 'name', label: 'Full Name' },
  { key: 'first_name', label: 'First Name' },
  { key: 'email', label: 'Email Address' },
  { key: 'course_title', label: 'Course Title' },
  { key: 'action_url', label: 'Call-To-Action Link' },
  { key: 'custom_message', label: 'Custom Message' },
  { key: 'discount_code', label: 'Discount Code' },
  { key: 'current_year', label: 'Current Year' },
];

export default function EmailTemplateDesigner({
  isOpen,
  template = null,
  onClose,
  onSaved,
}) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [category, setCategory] = useState('announcement');
  const [htmlContent, setHtmlContent] = useState('');
  const [viewMode, setViewMode] = useState('desktop'); // 'desktop' | 'mobile'
  const [saving, setSaving] = useState(false);
  const [presets, setPresets] = useState([]);
  const [feedback, setFeedback] = useState(null);

  const textareaRef = useRef(null);

  useEffect(() => {
    // Load presets
    campaignsService.getEmailTemplatePresets().then((res) => {
      const data = res?.data?.data || res?.data || (Array.isArray(res) ? res : []);
      setPresets(data);
    }).catch(() => {});

    if (template) {
      setName(template.name || '');
      setSubject(template.subject || '');
      setPreviewText(template.preview_text || '');
      setCategory(template.category || 'announcement');
      setHtmlContent(template.html_content || '');
    } else {
      // Default initial layout
      setName('New Course Announcement');
      setSubject('Exciting News: New Skill Masterclass on Elevate LMS');
      setPreviewText('Discover hands-on lessons and accelerate your growth.');
      setCategory('announcement');
      setHtmlContent(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Elevate Announcement</title>
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #4f46e5; padding: 32px 24px; text-align: center; color: #ffffff; }
    .body { padding: 32px 24px; line-height: 1.6; }
    .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 16px; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0; font-size: 22px;">Elevate Learning</h1>
    </div>
    <div class="body">
      <h2 style="margin-top:0;">Hello {{name}},</h2>
      <p>We are excited to share new learning opportunities designed to elevate your career.</p>
      <p>{{custom_message}}</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{action_url}}" class="btn">Explore Now</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; {{current_year}} Elevate LMS. Sent to {{email}}.</p>
    </div>
  </div>
</body>
</html>`);
    }
  }, [template, isOpen]);

  if (!isOpen) return null;

  const insertVariable = (varKey) => {
    const placeholder = `{{${varKey}}}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setHtmlContent((prev) => prev + placeholder);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextHtml = htmlContent.substring(0, start) + placeholder + htmlContent.substring(end);
    setHtmlContent(nextHtml);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 50);
  };

  const loadPreset = (preset) => {
    if (!preset) return;
    if (confirm(`Load "${preset.name}" preset? This will overwrite your current draft.`)) {
      setName(preset.name);
      setSubject(preset.subject);
      setPreviewText(preset.preview_text);
      setCategory(preset.category);
      setHtmlContent(preset.html_content);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name || !subject || !htmlContent) {
      setFeedback({ type: 'error', message: 'Name, subject, and HTML content are required.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      if (template?.template_id) {
        await campaignsService.updateEmailTemplate(template.template_id, {
          name,
          subject,
          preview_text: previewText,
          category,
          html_content: htmlContent,
        });
      } else {
        await campaignsService.createEmailTemplate({
          name,
          subject,
          preview_text: previewText,
          category,
          html_content: htmlContent,
        });
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save template.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  // Live rendered HTML with simulated dummy values for preview
  const previewHtml = htmlContent
    .replace(/\{\{\s*name\s*\}\}/g, 'Alex Johnson')
    .replace(/\{\{\s*first_name\s*\}\}/g, 'Alex')
    .replace(/\{\{\s*last_name\s*\}\}/g, 'Johnson')
    .replace(/\{\{\s*email\s*\}\}/g, 'alex.johnson@example.com')
    .replace(/\{\{\s*course_title\s*\}\}/g, 'Modern Fullstack TypeScript & React')
    .replace(/\{\{\s*action_url\s*\}\}/g, '#')
    .replace(/\{\{\s*discount_code\s*\}\}/g, 'ELEVATE50')
    .replace(/\{\{\s*current_year\s*\}\}/g, new Date().getFullYear().toString())
    .replace(/\{\{\s*custom_message\s*\}\}/g, 'Gain in-demand production skills with industry-curated modules and hands-on projects.')
    .replace(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g, '[Variable]');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight">
              {template ? 'Edit Responsive HTML Template' : 'Create Responsive HTML Template'}
            </h2>
            <p className="text-[11px] text-slate-500">
              Live responsive email designer with dynamic placeholder injection
            </p>
          </div>
        </div>

        {/* Viewport switchers & Actions */}
        <div className="flex items-center gap-3">
          {/* Desktop / Mobile Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode('desktop')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'desktop'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" /> Desktop (600px)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('mobile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'mobile'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile (375px)
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200" />

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-6 py-2 text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-b border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Dual-Pane Designer */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden bg-slate-100">
        {/* Left Column: Metadata & HTML Editor */}
        <div className="bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto">
          {/* Metadata Fields */}
          <div className="p-5 border-b border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Template Settings
              </span>

              {/* Starter Presets Loader */}
              {presets.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-semibold">Load Preset:</span>
                  <select
                    onChange={(e) => {
                      const p = presets.find((x) => x.name === e.target.value);
                      if (p) loadPreset(p);
                    }}
                    value=""
                    className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 bg-white hover:border-slate-300 focus:outline-none"
                  >
                    <option value="" disabled>Choose layout preset...</option>
                    {presets.map((p, idx) => (
                      <option key={idx} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Template Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. November Course Launch"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="announcement">Announcement</option>
                  <option value="promotional">Promotional / Discount</option>
                  <option value="newsletter">Newsletter / Digest</option>
                  <option value="transactional">Transactional</option>
                  <option value="alert">System Alert</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600">Subject Line *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Master React 19: {{course_title}} is now live!"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600">Preview Text (Preheader)</label>
              <input
                type="text"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Short snippet visible before opening email in inbox..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Dynamic Variables Pill Bar */}
          <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100">
            <div className="flex items-center gap-1.5 mb-2">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                Click to Insert Dynamic Variable
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-[11px] font-semibold text-slate-600 transition shadow-2xs"
                  title={`Insert {{${v.key}}}`}
                >
                  +{`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* HTML Code Editor */}
          <div className="flex-1 p-5 flex flex-col min-h-[350px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-slate-400" /> HTML Source Code
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {htmlContent.length} chars
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="Paste or write responsive HTML email code here..."
              className="flex-1 w-full p-4 rounded-xl border border-slate-200 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Right Column: Live Responsive Preview Sandbox */}
        <div className="flex-1 flex flex-col items-center justify-start p-6 overflow-y-auto">
          <div className="w-full flex items-center justify-between mb-4 max-w-2xl">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">
                Live Sample Preview
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Simulated with student sample data
            </span>
          </div>

          {/* Simulated Email Envelope Header */}
          <div
            className={`w-full bg-white rounded-t-xl border border-b-0 border-slate-200 p-3.5 transition-all duration-300 shadow-sm ${
              viewMode === 'mobile' ? 'max-w-[375px]' : 'max-w-[620px]'
            }`}
          >
            <div className="text-xs font-bold text-slate-900 truncate">
              Subject: {subject || '(No subject)'}
            </div>
            {previewText && (
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                Preheader: {previewText}
              </div>
            )}
          </div>

          {/* Preview Viewport Frame */}
          <div
            className={`w-full bg-white rounded-b-xl border border-slate-200 shadow-lg overflow-hidden transition-all duration-300 ${
              viewMode === 'mobile'
                ? 'max-w-[375px] min-h-[580px] ring-8 ring-slate-800 rounded-3xl mb-8'
                : 'max-w-[620px] min-h-[500px]'
            }`}
          >
            <iframe
              srcDoc={previewHtml}
              title="Responsive Email Preview"
              className="w-full h-full min-h-[520px] border-none bg-white"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

