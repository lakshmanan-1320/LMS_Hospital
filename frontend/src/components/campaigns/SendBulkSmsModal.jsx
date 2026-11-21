'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Send,
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Check,
  Globe,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  FileSpreadsheet,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  Table,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';
import {
  parseExcelFile,
  downloadSampleSmsTemplate,
  normalizePhone,
  detectCountry,
  detectPhoneHeaders,
} from '@/utils/excel.utils';

function calculateSmsParts(text) {
  const str = String(text || '');
  const chars = str.length;
  const isUnicode = /[^\u0000-\u007F]/.test(str);
  let parts = 1;
  if (isUnicode) {
    parts = chars <= 70 ? 1 : Math.ceil(chars / 67);
  } else {
    parts = chars <= 160 ? 1 : Math.ceil(chars / 153);
  }
  return { chars, parts, isUnicode };
}

function renderTemplateText(body, values = {}) {
  let str = String(body || '');
  str = str.replace(/##\s*([A-Za-z0-9_]+)\s*##/g, (_, key) => {
    return values[key] !== undefined && values[key] !== null ? String(values[key]) : `##${key}##`;
  });
  str = str.replace(/\{#?\s*([A-Za-z0-9_]+)\s*#?\}/g, (_, key) => {
    return values[key] !== undefined && values[key] !== null ? String(values[key]) : `{${key}}`;
  });
  return str;
}

export default function SendBulkSmsModal({
  isOpen,
  onClose,
  onCampaignSent,
  initialTargetSource = 'webinar_registrants',
}) {
  const [step, setStep] = useState(1); // 1: Choose Template, 2: Choose Audience, 3: Preview & Dispatch
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Campaign State
  const [campaignName, setCampaignName] = useState('');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Audience Target Source: 'webinar_registrants' | 'custom_list'
  const [targetAudienceSource, setTargetAudienceSource] = useState('webinar_registrants');
  const [webinars, setWebinars] = useState([]);
  const [selectedWebinarId, setSelectedWebinarId] = useState('');
  const [webinarAudienceData, setWebinarAudienceData] = useState(null);
  const [loadingAudience, setLoadingAudience] = useState(false);

  // Excel Import Audience State
  const [excelFile, setExcelFile] = useState(null);
  const [rawExcelRows, setRawExcelRows] = useState([]);
  const [parsingExcel, setParsingExcel] = useState(false);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [selectedPhoneCol, setSelectedPhoneCol] = useState('');
  const [selectedNameCol, setSelectedNameCol] = useState('');
  const fileInputRef = useRef(null);

  // Filtering & Selection State
  const [selectedCountryCode, setSelectedCountryCode] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhones, setSelectedPhones] = useState(new Set());
  const [previewRecipientIdx, setPreviewRecipientIdx] = useState(0);

  // Load initial templates & webinars
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setCampaignName('');
      setSelectedTemplateId('');
      setSelectedWebinarId('');
      setWebinarAudienceData(null);
      setExcelFile(null);
      setRawExcelRows([]);
      setAvailableColumns([]);
      setSelectedPhoneCol('');
      setSelectedNameCol('');
      setError(null);
      return;
    }

    setTargetAudienceSource(initialTargetSource || 'webinar_registrants');

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [tplRes, webRes] = await Promise.all([
          campaignsService.listTemplates(true),
          campaignsService.listWebinarAudiences(),
        ]);
        const activeTemplates = tplRes.data || [];
        setTemplates(activeTemplates);
        if (activeTemplates.length > 0) {
          setSelectedTemplateId(activeTemplates[0].template_id);
        }
        const webs = webRes.data || [];
        setWebinars(webs);
        if (webs.length > 0) {
          setSelectedWebinarId(webs[0].webinarId);
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load templates.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isOpen]);

  // Load webinar audience when webinar changes
  useEffect(() => {
    if (targetAudienceSource !== 'webinar_registrants' || !selectedWebinarId || step < 2) return;
    async function fetchAudience() {
      setLoadingAudience(true);
      try {
        const res = await campaignsService.previewWebinarAudience(selectedWebinarId);
        const data = res.data;
        setWebinarAudienceData(data);
        // Default select all valid phones
        const validPhones = new Set(
          (data.recipients || []).filter((r) => r.isValidPhone).map((r) => r.normalizedPhone),
        );
        setSelectedPhones(validPhones);
        setPreviewRecipientIdx(0);
      } catch (err) {
        setError('Failed to fetch webinar registrants.');
      } finally {
        setLoadingAudience(false);
      }
    }
    fetchAudience();
  }, [selectedWebinarId, step, targetAudienceSource]);

  // Handle Excel file upload
  const handleFileUpload = async (file) => {
    if (!file) return;
    setError(null);
    setParsingExcel(true);
    try {
      const rows = await parseExcelFile(file);
      if (!rows || rows.length === 0) {
        setError('The uploaded spreadsheet contains no data rows.');
        setRawExcelRows([]);
        setExcelFile(null);
        return;
      }
      setExcelFile(file);
      setRawExcelRows(rows);

      const firstRow = rows[0] || {};
      const cols = Object.keys(firstRow);
      setAvailableColumns(cols);

      const { phoneKey, nameKey } = detectPhoneHeaders(firstRow);
      setSelectedPhoneCol(phoneKey || cols[0] || '');
      setSelectedNameCol(nameKey || '');
    } catch (err) {
      setError(err.message || 'Failed to process Excel file.');
      setExcelFile(null);
      setRawExcelRows([]);
    } finally {
      setParsingExcel(false);
    }
  };

  // Convert raw Excel rows into Audience format
  const excelAudienceData = useMemo(() => {
    if (!rawExcelRows.length || !selectedPhoneCol) {
      return {
        targetType: 'custom_list',
        totalAudience: 0,
        validPhoneCount: 0,
        missingPhoneCount: 0,
        countryDistribution: [],
        recipients: [],
      };
    }

    const recipients = [];
    let validCount = 0;
    let missingCount = 0;
    const countryMap = new Map();

    rawExcelRows.forEach((row, idx) => {
      const rawPhone = String(row[selectedPhoneCol] || '').trim();
      const normalized = normalizePhone(rawPhone, '91');
      const isValid = Boolean(normalized);
      const name = selectedNameCol ? String(row[selectedNameCol] || '').trim() : 'Learner';
      const parts = name.split(' ');
      const firstName = parts[0] || 'Learner';
      const lastName = parts.slice(1).join(' ') || '';
      const country = detectCountry(normalized || rawPhone);

      if (isValid) {
        validCount++;
        const curr = countryMap.get(country.code) || {
          code: country.code,
          name: country.name,
          flag: country.flag,
          count: 0,
        };
        curr.count++;
        countryMap.set(country.code, curr);
      } else {
        missingCount++;
      }

      // Context variables: merge standard recipient fields with any other columns in the Excel row
      const contextValues = {
        'recipient.name': name,
        'recipient.firstName': firstName,
        'recipient.lastName': lastName,
        'recipient.phone': normalized || rawPhone,
      };

      for (const [k, v] of Object.entries(row)) {
        if (k !== selectedPhoneCol && k !== selectedNameCol) {
          contextValues[k] = String(v ?? '');
        }
      }

      recipients.push({
        registrationId: `excel_${idx}`,
        fullName: name || 'Learner',
        firstName,
        lastName,
        email: '',
        rawPhone: rawPhone || null,
        normalizedPhone: normalized,
        countryCode: country.code,
        countryName: country.name,
        countryFlag: country.flag,
        isValidPhone: isValid,
        contextValues,
      });
    });

    return {
      targetType: 'custom_list',
      totalAudience: rawExcelRows.length,
      validPhoneCount: validCount,
      missingPhoneCount: missingCount,
      countryDistribution: Array.from(countryMap.values()),
      recipients,
    };
  }, [rawExcelRows, selectedPhoneCol, selectedNameCol]);

  // Update selected phones when excel audience changes
  useEffect(() => {
    if (targetAudienceSource === 'custom_list') {
      const validPhones = new Set(
        excelAudienceData.recipients.filter((r) => r.isValidPhone).map((r) => r.normalizedPhone),
      );
      setSelectedPhones(validPhones);
      setPreviewRecipientIdx(0);
    }
  }, [excelAudienceData, targetAudienceSource]);

  // Unified audience data
  const audienceData = useMemo(() => {
    return targetAudienceSource === 'custom_list' ? excelAudienceData : webinarAudienceData;
  }, [targetAudienceSource, excelAudienceData, webinarAudienceData]);

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.template_id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  // Extract variable keys from selected template for sample download
  const templateVariableKeys = useMemo(() => {
    if (!selectedTemplate?.body) return [];
    const keys = new Set();
    for (const match of selectedTemplate.body.matchAll(/##\s*([A-Za-z0-9_]+)\s*##/g)) keys.add(match[1]);
    for (const match of selectedTemplate.body.matchAll(/\{#?\s*([A-Za-z0-9_]+)\s*#?\}/g)) keys.add(match[1]);
    return Array.from(keys);
  }, [selectedTemplate]);

  // Filtered recipients for roster display
  const filteredRecipients = useMemo(() => {
    if (!audienceData?.recipients) return [];
    return audienceData.recipients.filter((r) => {
      if (selectedCountryCode !== 'all' && r.countryCode !== selectedCountryCode) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.fullName.toLowerCase().includes(q);
        const matchesPhone = String(r.rawPhone || '').includes(q);
        const matchesEmail = r.email.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesEmail) return false;
      }
      return true;
    });
  }, [audienceData, selectedCountryCode, searchQuery]);

  const togglePhone = (phone) => {
    const next = new Set(selectedPhones);
    if (next.has(phone)) next.delete(phone);
    else next.add(phone);
    setSelectedPhones(next);
  };

  const toggleSelectAll = () => {
    const currentValidPhones = filteredRecipients.filter((r) => r.isValidPhone).map((r) => r.normalizedPhone);
    const allSelected = currentValidPhones.every((p) => selectedPhones.has(p));
    const next = new Set(selectedPhones);
    if (allSelected) {
      currentValidPhones.forEach((p) => next.delete(p));
    } else {
      currentValidPhones.forEach((p) => next.add(p));
    }
    setSelectedPhones(next);
  };

  // Live preview message
  const previewRecipient = useMemo(() => {
    const valid = (audienceData?.recipients || []).filter((r) => r.isValidPhone);
    if (!valid.length) return null;
    return valid[previewRecipientIdx] || valid[0];
  }, [audienceData, previewRecipientIdx]);

  const renderedPreviewText = useMemo(() => {
    if (!selectedTemplate || !previewRecipient) return '';
    return renderTemplateText(selectedTemplate.body, previewRecipient.contextValues);
  }, [selectedTemplate, previewRecipient]);

  const smsMetrics = useMemo(() => {
    return calculateSmsParts(renderedPreviewText);
  }, [renderedPreviewText]);

  // Submission handler
  const handleDispatchCampaign = async () => {
    if (!campaignName.trim()) {
      setError('Please provide a campaign name.');
      return;
    }
    if (!selectedTemplateId) {
      setError('Please select an approved message template.');
      return;
    }
    if (selectedPhones.size === 0) {
      setError('Please select at least one recipient with a valid phone number.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        campaignName: campaignName.trim(),
        templateId: selectedTemplateId,
        targetType: targetAudienceSource,
        includedPhoneNumbers: Array.from(selectedPhones),
        countryCodeFilter: selectedCountryCode,
      };

      if (targetAudienceSource === 'webinar_registrants') {
        payload.targetId = selectedWebinarId;
      } else if (targetAudienceSource === 'custom_list') {
        // Map custom recipients from selected phone numbers
        const validRecipients = (excelAudienceData.recipients || []).filter(
          (r) => r.isValidPhone && selectedPhones.has(r.normalizedPhone),
        );
        payload.customRecipients = validRecipients.map((r) => ({
          mobile: r.normalizedPhone,
          name: r.fullName,
          variables: r.contextValues,
        }));
      }

      const res = await campaignsService.sendBulkSmsCampaign(payload);
      if (onCampaignSent) onCampaignSent(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to dispatch bulk SMS campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Send Bulk SMS Campaign</h2>
              <p className="text-xs text-slate-500 font-medium">
                Strictly Template-Driven • DLT &amp; MSG91 Flow v5 Integrated
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps Tabs */}
        <div className="grid grid-cols-3 border-b border-slate-100 bg-slate-50/60 text-xs font-bold text-center">
          <button
            onClick={() => setStep(1)}
            className={`py-3 flex items-center justify-center gap-2 transition ${
              step === 1 ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-slate-200 text-slate-700 font-black">
              1
            </span>
            <span>Choose Template</span>
          </button>
          <button
            onClick={() => step > 1 && setStep(2)}
            disabled={step < 2}
            className={`py-3 flex items-center justify-center gap-2 transition ${
              step === 2
                ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                : step > 2
                ? 'text-slate-700'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-slate-200 text-slate-700 font-black">
              2
            </span>
            <span>Select Audience &amp; Excel</span>
          </button>
          <button
            onClick={() => step > 2 && setStep(3)}
            disabled={step < 3}
            className={`py-3 flex items-center justify-center gap-2 transition ${
              step === 3
                ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-slate-200 text-slate-700 font-black">
              3
            </span>
            <span>Preview &amp; Dispatch</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: CHOOSE TEMPLATE */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Informative Excel Banner */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-100 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Excel / CSV Contact Import Supported</h4>
                    <p className="text-[11px] text-slate-500">
                      Choose an approved message template below, then target webinar registrants or upload a spreadsheet in Step 2.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadSampleSmsTemplate(templateVariableKeys)}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white rounded-lg border border-emerald-200 transition shadow-xs whitespace-nowrap flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Sample Template (.xlsx)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Campaign Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. System Design Webinar - Final Reminder"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Select Approved Message Template *
                  </label>
                  <span className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Strictly Template-Based
                  </span>
                </div>

                {loading ? (
                  <div className="py-8 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading approved templates...
                  </div>
                ) : templates.length === 0 ? (
                  <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm text-center">
                    No approved SMS templates found. Please create a template in the Templates tab before sending a
                    campaign.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map((tpl) => {
                      const isSelected = tpl.template_id === selectedTemplateId;
                      return (
                        <div
                          key={tpl.template_id}
                          onClick={() => setSelectedTemplateId(tpl.template_id)}
                          className={`cursor-pointer p-4 rounded-xl border transition-all text-left relative ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-2 ring-indigo-500/20'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-bold text-sm text-slate-900">{tpl.name}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                              {tpl.category || 'DLT'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-3 font-mono bg-white/80 p-2 rounded-lg border border-slate-100">
                            {tpl.body}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>Flow ID: {tpl.provider_template_id}</span>
                            {tpl.dlt_template_id && <span>• DLT: {tpl.dlt_template_id}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: AUDIENCE SELECTION & EXCEL IMPORT */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Audience Source Selector Cards */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Target Audience Source *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setTargetAudienceSource('webinar_registrants')}
                    className={`p-4 rounded-xl border cursor-pointer transition text-left ${
                      targetAudienceSource === 'webinar_registrants'
                        ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-900">Webinar Registrants</span>
                      </div>
                      {targetAudienceSource === 'webinar_registrants' && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Broadcast to registered participants of an upcoming or past webinar.
                    </p>
                  </div>

                  <div
                    onClick={() => setTargetAudienceSource('custom_list')}
                    className={`p-4 rounded-xl border cursor-pointer transition text-left ${
                      targetAudienceSource === 'custom_list'
                        ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-500 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-900">Upload Excel / CSV Contacts</span>
                      </div>
                      {targetAudienceSource === 'custom_list' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Import phone numbers and custom variables directly from an Excel spreadsheet.
                    </p>
                  </div>
                </div>
              </div>

              {targetAudienceSource === 'webinar_registrants' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Select Webinar *
                  </label>
                  <select
                    value={selectedWebinarId}
                    onChange={(e) => setSelectedWebinarId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium bg-white"
                  >
                    {webinars.map((w) => (
                      <option key={w.webinarId} value={w.webinarId}>
                        {w.title} ({w.totalWithPhone} phone numbers)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-950">
                      Excel / CSV Contact Import Active
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadSampleSmsTemplate(templateVariableKeys)}
                    className="py-1.5 px-3 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white hover:bg-emerald-100/50 rounded-lg flex items-center gap-1.5 border border-emerald-200 transition shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Sample Template (.xlsx)
                  </button>
                </div>
              )}

              {/* If Excel import source selected */}
              {targetAudienceSource === 'custom_list' && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  {!excelFile ? (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                        }}
                        className="hidden"
                      />
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Drop your contact spreadsheet here, or <span className="text-indigo-600 underline">browse</span>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Supports .xlsx, .xls, and .csv with auto-normalized mobile numbers
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">{excelFile.name}</h4>
                            <p className="text-[10px] text-slate-500">
                              {(excelFile.size / 1024).toFixed(1)} KB • {rawExcelRows.length} rows parsed
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setExcelFile(null);
                            setRawExcelRows([]);
                            setAvailableColumns([]);
                          }}
                          className="text-slate-400 hover:text-rose-600 transition p-1.5 rounded-lg hover:bg-white"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Column Mapping */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Mobile / Phone Column *
                          </label>
                          <select
                            value={selectedPhoneCol}
                            onChange={(e) => setSelectedPhoneCol(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {availableColumns.map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Recipient Name Column (Optional)
                          </label>
                          <select
                            value={selectedNameCol}
                            onChange={(e) => setSelectedNameCol(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">-- None (Default to &quot;Learner&quot;) --</option>
                            {availableColumns.map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Validation Stats */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 text-xs">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {excelAudienceData.validPhoneCount} Valid Phone Numbers Ready
                        </span>
                        {excelAudienceData.missingPhoneCount > 0 && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {excelAudienceData.missingPhoneCount} Invalid / Missing Skipped
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Country Segmentation Chips */}
              {audienceData?.countryDistribution && audienceData.countryDistribution.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-600" /> Country Prefix Segmentation
                    </label>
                    <span className="text-xs text-slate-500">
                      Total Audience: <strong>{audienceData.validPhoneCount}</strong> valid phone(s)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCountryCode('all')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 border ${
                        selectedCountryCode === 'all'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      All Countries ({audienceData.validPhoneCount})
                    </button>
                    {audienceData.countryDistribution.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setSelectedCountryCode(c.code)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 border ${
                          selectedCountryCode === c.code
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{c.flag}</span>
                        <span>{c.name}</span>
                        <span className="opacity-70">(+{c.code})</span>
                        <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-800 text-[10px]">
                          {c.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recipient Roster */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search recipient name, phone, or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
                  >
                    Select / Deselect Visible
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {loadingAudience ? (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                      Resolving audience mobile numbers...
                    </div>
                  ) : filteredRecipients.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      {targetAudienceSource === 'custom_list' && !excelFile
                        ? 'Please upload an Excel or CSV spreadsheet above to load contacts.'
                        : 'No recipients match the selected filter.'}
                    </div>
                  ) : (
                    filteredRecipients.map((r) => {
                      const isSelected = selectedPhones.has(r.normalizedPhone);
                      return (
                        <div
                          key={r.registrationId}
                          onClick={() => r.isValidPhone && togglePhone(r.normalizedPhone)}
                          className={`px-4 py-2.5 flex items-center justify-between text-xs transition cursor-pointer ${
                            !r.isValidPhone
                              ? 'opacity-40 bg-slate-50 cursor-not-allowed'
                              : isSelected
                              ? 'bg-indigo-50/30'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!r.isValidPhone}
                              onChange={() => {}}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <span>{r.fullName}</span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {r.countryFlag} (+{r.countryCode})
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500">{r.email || 'Custom List'}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-slate-700">{r.normalizedPhone || r.rawPhone || 'No Phone'}</div>
                            {!r.isValidPhone && (
                              <span className="text-[10px] text-amber-600 font-medium">Missing / Invalid</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: LIVE PERSONALIZED PREVIEW & DISPATCH */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Audience Summary Banner */}
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-indigo-950">Campaign Dispatch Ready</h4>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    Sending template <strong>&quot;{selectedTemplate?.name}&quot;</strong> to{' '}
                    <strong>{selectedPhones.size}</strong> selected recipient(s).
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold px-3 py-1 bg-indigo-600 text-white rounded-full shadow-sm">
                    {selectedPhones.size} Recipient(s)
                  </span>
                </div>
              </div>

              {/* Recipient Picker for Live Preview */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Live Sample Preview (Personalized per Student)
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={previewRecipientIdx}
                    onChange={(e) => setPreviewRecipientIdx(Number(e.target.value))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {(audienceData?.recipients || [])
                      .filter((r) => r.isValidPhone)
                      .slice(0, 20)
                      .map((r, i) => (
                        <option key={r.registrationId} value={i}>
                          Preview for: {r.fullName} ({r.normalizedPhone}) - {r.countryName}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Message Simulator Box */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-indigo-300 pb-3 border-b border-indigo-800/60 mb-3">
                  <span className="font-mono flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    SMS Preview • SENDER: ELVLMS
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-900/80 text-indigo-300 border border-indigo-700/50">
                    DLT / MSG91 Validated
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-sm leading-relaxed font-mono min-h-24 select-text">
                  {renderedPreviewText || 'Select a recipient to view live rendered message.'}
                </div>

                <div className="flex items-center justify-between mt-3 text-xs text-indigo-300 font-mono">
                  <span>
                    Length: <strong>{smsMetrics.chars}</strong> chars
                  </span>
                  <span>
                    Parts: <strong>{smsMetrics.parts}</strong> SMS
                  </span>
                  <span>
                    Encoding: <strong>{smsMetrics.isUnicode ? 'Unicode' : 'GSM-7'}</strong>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              disabled={!selectedTemplateId || (step === 2 && selectedPhones.size === 0)}
              onClick={() => {
                if (!campaignName.trim()) {
                  setError('Please provide a campaign title.');
                  return;
                }
                setError(null);
                setStep(step + 1);
              }}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-md shadow-indigo-100 disabled:opacity-50"
            >
              <span>Next Step</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || selectedPhones.size === 0}
              onClick={handleDispatchCampaign}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition flex items-center gap-2 shadow-md shadow-emerald-100 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{submitting ? 'Dispatching Batch...' : `Send to ${selectedPhones.size} Recipient(s)`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
