'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Tag,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  Sparkles,
  Layers,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';
import EmailTemplateDesigner from './EmailTemplateDesigner';

export default function EmailTemplatesTab({ role }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [designerOpen, setDesignerOpen] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await campaignsService.listEmailTemplates();
      const list = res?.data?.data || res?.data || (Array.isArray(res) ? res : []);
      setTemplates(list);
    } catch (err) {
      console.error('Failed to load email templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to remove template "${name}"?`)) return;
    try {
      await campaignsService.deleteEmailTemplate(id);
      fetchTemplates();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete template');
    }
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" /> Responsive Email Templates
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pre-built and custom HTML templates with dynamic personalization tags for bulk broadcasts.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTemplate(null);
            setDesignerOpen(true);
          }}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Create Email Template
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by title or subject..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
          {['all', 'announcement', 'promotional', 'newsletter', 'transactional', 'alert'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
          <button
            onClick={fetchTemplates}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 transition"
            title="Refresh templates"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Template Cards Grid */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-100 flex items-center justify-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
          <span className="text-sm font-semibold">Loading templates...</span>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-100 space-y-3">
          <Layers className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No email templates found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search
              ? 'No templates matched your search keywords.'
              : 'Create your first responsive email template using our visual builder and starter presets.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((t) => {
            const vars = Array.isArray(t.variables) ? t.variables : [];

            return (
              <div
                key={t.template_id}
                className="bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        t.category === 'promotional'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : t.category === 'announcement'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : t.category === 'newsletter'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.category}
                    </span>

                    <span className="text-[10px] text-slate-400">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                      {t.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      Subject: {t.subject}
                    </p>
                  </div>

                  {/* Variables pills */}
                  {vars.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {vars.slice(0, 4).map((v, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-slate-50 text-slate-600 text-[10px] font-mono border border-slate-200"
                        >
                          {`{{${v}}}`}
                        </span>
                      ))}
                      {vars.length > 4 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] text-slate-400 font-medium">
                          +{vars.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {t.author_name ? `By ${t.author_name}` : 'Platform Template'}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingTemplate(t);
                        setDesignerOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white transition"
                      title="Edit template & preview"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.template_id, t.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition"
                      title="Delete template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Designer Drawer/Modal */}
      {designerOpen && (
        <EmailTemplateDesigner
          isOpen={designerOpen}
          template={editingTemplate}
          onClose={() => setDesignerOpen(false)}
          onSaved={() => {
            fetchTemplates();
          }}
        />
      )}
    </div>
  );
}

