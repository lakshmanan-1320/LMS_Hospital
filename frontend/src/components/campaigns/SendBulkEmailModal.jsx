'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Send,
  Users,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  ArrowRight,
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Download,
  Trash2,
  Table,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';
import {
  parseExcelFile,
  downloadSampleEmailTemplate,
  isValidEmail,
  detectEmailHeaders,
} from '@/utils/excel.utils';

export default function SendBulkEmailModal({
  isOpen,
  onClose,
  onCampaignSent,
  initialTargetType = 'students',
}) {
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Form states
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [targetType, setTargetType] = useState('students');
  const [customVariables, setCustomVariables] = useState({});
  const [audienceCount, setAudienceCount] = useState(0);
  const [countingAudience, setCountingAudience] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Custom List States (Excel / Manual)
  const [customMode, setCustomMode] = useState('excel'); // 'excel' | 'manual'
  const [customCsvText, setCustomCsvText] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  const [rawExcelRows, setRawExcelRows] = useState([]);
  const [parsingExcel, setParsingExcel] = useState(false);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [selectedEmailCol, setSelectedEmailCol] = useState('');
  const [selectedNameCol, setSelectedNameCol] = useState('');
  const fileInputRef = useRef(null);

  // 1. Fetch available templates on open
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setCampaignName(`Bulk Broadcast - ${new Date().toLocaleDateString()}`);
    setErrorMsg('');
    setLoadingTemplates(true);
    setTargetType(initialTargetType || 'students');
    setExcelFile(null);
    setRawExcelRows([]);
    setAvailableColumns([]);
    setSelectedEmailCol('');
    setSelectedNameCol('');
    setCustomCsvText('');

    campaignsService
      .listEmailTemplates(true)
      .then((res) => {
        const list = res?.data?.data || res?.data || (Array.isArray(res) ? res : []);
        setTemplates(list);
        if (list.length > 0) {
          setSelectedTemplate(list[0]);
        }
      })
      .catch((err) => {
        console.error('Failed to load email templates:', err);
      })
      .finally(() => {
        setLoadingTemplates(false);
      });
  }, [isOpen]);

  // Handle Excel file upload and parse
  const handleFileUpload = async (file) => {
    if (!file) return;
    setErrorMsg('');
    setParsingExcel(true);
    try {
      const rows = await parseExcelFile(file);
      if (!rows || rows.length === 0) {
        setErrorMsg('The uploaded spreadsheet contains no data rows.');
        setRawExcelRows([]);
        setExcelFile(null);
        return;
      }
      setExcelFile(file);
      setRawExcelRows(rows);

      // Detect columns
      const firstRow = rows[0] || {};
      const cols = Object.keys(firstRow);
      setAvailableColumns(cols);

      const { emailKey, nameKey } = detectEmailHeaders(firstRow);
      setSelectedEmailCol(emailKey || cols[0] || '');
      setSelectedNameCol(nameKey || '');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to process Excel file.');
      setExcelFile(null);
      setRawExcelRows([]);
    } finally {
      setParsingExcel(false);
    }
  };

  // Process Excel rows based on selected columns
  const processedExcelRecipients = useMemo(() => {
    if (!rawExcelRows.length || !selectedEmailCol) {
      return { valid: [], invalid: [] };
    }

    const valid = [];
    const invalid = [];

    rawExcelRows.forEach((row, idx) => {
      const email = String(row[selectedEmailCol] || '').trim();
      const name = selectedNameCol ? String(row[selectedNameCol] || '').trim() : 'Learner';

      if (!isValidEmail(email)) {
        invalid.push({
          rowNumber: idx + 2, // header is row 1
          email: email || '(empty)',
          reason: !email ? 'Empty email cell' : 'Invalid email format',
        });
        return;
      }

      // Collect all other columns as custom variables
      const rowVariables = {};
      for (const [k, v] of Object.entries(row)) {
        if (k !== selectedEmailCol && k !== selectedNameCol) {
          rowVariables[k] = String(v ?? '');
        }
      }

      valid.push({
        email,
        name: name || 'Learner',
        variables: rowVariables,
      });
    });

    return { valid, invalid };
  }, [rawExcelRows, selectedEmailCol, selectedNameCol]);

  // Parse manual CSV text for custom recipients
  const parseCustomManualRecipients = () => {
    const lines = customCsvText.split('\n');
    const recipients = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(',');
      const email = parts[0]?.trim();
      const name = parts[1]?.trim() || 'Learner';
      if (isValidEmail(email)) {
        recipients.push({ email, name });
      }
    }
    return recipients;
  };

  // 2. Fetch audience count when targetType or custom list changes
  useEffect(() => {
    if (!isOpen) return;

    if (targetType === 'custom_list') {
      if (customMode === 'excel') {
        setAudienceCount(processedExcelRecipients.valid.length);
      } else {
        const list = parseCustomManualRecipients();
        setAudienceCount(list.length);
      }
      return;
    }

    setCountingAudience(true);
    campaignsService
      .getEmailAudienceCount(targetType)
      .then((res) => {
        const count = res?.data?.count ?? res?.data?.data?.count ?? 0;
        setAudienceCount(count);
      })
      .catch(() => {
        setAudienceCount(0);
      })
      .finally(() => {
        setCountingAudience(false);
      });
  }, [targetType, customMode, processedExcelRecipients, customCsvText, isOpen]);

  if (!isOpen) return null;

  const handleLaunchCampaign = async () => {
    if (!selectedTemplate) {
      setErrorMsg('Please select an email template.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        name: campaignName.trim(),
        template_id: selectedTemplate.template_id,
        target_type: targetType,
        custom_variables: customVariables,
      };

      if (targetType === 'custom_list') {
        const list =
          customMode === 'excel'
            ? processedExcelRecipients.valid
            : parseCustomManualRecipients();

        if (list.length === 0) {
          setErrorMsg('No valid recipient email addresses found in the imported list.');
          setSubmitting(false);
          return;
        }
        payload.custom_recipients = list;
      }

      await campaignsService.sendBulkEmailCampaign(payload);
      if (onCampaignSent) onCampaignSent();
      onClose();
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Failed to dispatch bulk email campaign.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Live rendered HTML preview with merged variables
  const sampleRecipient =
    targetType === 'custom_list' && customMode === 'excel' && processedExcelRecipients.valid.length > 0
      ? processedExcelRecipients.valid[0]
      : null;

  const previewHtml = selectedTemplate
    ? selectedTemplate.html_content
        .replace(/\{\{\s*name\s*\}\}/g, sampleRecipient?.name || 'Alex Johnson')
        .replace(/\{\{\s*first_name\s*\}\}/g, sampleRecipient?.name?.split(' ')[0] || 'Alex')
        .replace(/\{\{\s*email\s*\}\}/g, sampleRecipient?.email || 'alex.johnson@example.com')
        .replace(/\{\{\s*course_title\s*\}\}/g, 'Modern Fullstack TypeScript')
        .replace(/\{\{\s*current_year\s*\}\}/g, new Date().getFullYear().toString())
        .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
          if (sampleRecipient?.variables?.[k] !== undefined) return sampleRecipient.variables[k];
          return customVariables[k] || `[${k}]`;
        })
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-slate-50 via-white to-indigo-50/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                Bulk Email Campaign Wizard
              </h3>
              <p className="text-[11px] text-slate-500">
                Step {step} of 3: {step === 1 ? 'Choose Template' : step === 2 ? 'Select Audience & Import' : 'Review & Dispatch'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Wizard Step Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* STEP 1: CHOOSE TEMPLATE */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Informative Excel Banner */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-100 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Excel / CSV Contact Import Supported</h4>
                    <p className="text-[11px] text-slate-500">
                      Choose a template below, then broadcast to platform users or upload a custom Excel sheet in Step 2.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadSampleEmailTemplate(selectedTemplate?.variables || [])}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white rounded-lg border border-emerald-200 transition shadow-xs whitespace-nowrap flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Sample Template (.xlsx)
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Campaign Name *</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. November Masterclass Broadcast"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Select Template *</label>
                {loadingTemplates ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> Loading templates...
                  </div>
                ) : templates.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                    No active email templates found. Please create one in the Email Templates tab.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                    {templates.map((tpl) => (
                      <div
                        key={tpl.template_id}
                        onClick={() => setSelectedTemplate(tpl)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition text-left ${
                          selectedTemplate?.template_id === tpl.template_id
                            ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{tpl.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                            {tpl.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{tpl.subject}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: CHOOSE AUDIENCE & EXCEL IMPORT */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Target Recipient Segment *</label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'students', label: 'Enrolled Students', desc: 'All active student accounts' },
                    { key: 'instructors', label: 'Instructors', desc: 'Verified educators and tutors' },
                    { key: 'all_users', label: 'All Platform Users', desc: 'Every registered active user' },
                    { key: 'custom_list', label: 'Excel / CSV Import', desc: 'Upload spreadsheets or paste list' },
                  ].map((aud) => (
                    <div
                      key={aud.key}
                      onClick={() => setTargetType(aud.key)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition ${
                        targetType === aud.key
                          ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                        <span>{aud.label}</span>
                        {targetType === aud.key && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{aud.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CUSTOM LIST: EXCEL IMPORT OR MANUAL PASTE */}
              {targetType === 'custom_list' ? (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  {/* Mode switcher tabs */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setCustomMode('excel')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                          customMode === 'excel'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Upload Excel / CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomMode('manual')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                          customMode === 'manual'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" /> Paste Manually
                      </button>
                    </div>

                    {customMode === 'excel' && (
                      <button
                        type="button"
                        onClick={() => downloadSampleEmailTemplate(selectedTemplate?.variables || [])}
                        className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 rounded-xl flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" /> Sample Template (.xlsx)
                      </button>
                    )}
                  </div>

                  {customMode === 'excel' ? (
                    <div className="space-y-4">
                      {/* Upload Box */}
                      {!excelFile ? (
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files?.[0]) {
                              handleFileUpload(e.dataTransfer.files[0]);
                            }
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
                              Drop your Excel or CSV spreadsheet here, or <span className="text-indigo-600 underline">browse</span>
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Supports .xlsx, .xls, and .csv with auto-detected columns
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
                                  {(excelFile.size / 1024).toFixed(1)} KB • {rawExcelRows.length} total rows parsed
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

                          {/* Column Mapping Selectors */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Email Address Column *
                              </label>
                              <select
                                value={selectedEmailCol}
                                onChange={(e) => setSelectedEmailCol(e.target.value)}
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
                              {processedExcelRecipients.valid.length} Valid Recipients Ready
                            </span>
                            {processedExcelRecipients.invalid.length > 0 && (
                              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {processedExcelRecipients.invalid.length} Invalid Skipped
                              </span>
                            )}
                          </div>

                          {/* Data Preview (First 5 rows) */}
                          {processedExcelRecipients.valid.length > 0 && (
                            <div className="space-y-1.5 pt-2">
                              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                                <Table className="w-3.5 h-3.5 text-indigo-600" /> Imported Contacts Preview (First 5 Rows)
                              </span>
                              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-36 bg-white">
                                <table className="w-full text-left text-[11px] border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                                      <th className="p-2">#</th>
                                      <th className="p-2">Name</th>
                                      <th className="p-2">Email</th>
                                      <th className="p-2">Extra Variables</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {processedExcelRecipients.valid.slice(0, 5).map((r, i) => (
                                      <tr key={i} className="hover:bg-slate-50/50">
                                        <td className="p-2 text-slate-400 font-mono">{i + 1}</td>
                                        <td className="p-2 font-medium text-slate-800">{r.name}</td>
                                        <td className="p-2 font-mono text-indigo-600">{r.email}</td>
                                        <td className="p-2 text-slate-500 font-mono truncate max-w-xs">
                                          {Object.keys(r.variables || {}).length > 0
                                            ? Object.entries(r.variables)
                                                .map(([k, v]) => `${k}:${v}`)
                                                .join(', ')
                                            : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Paste Emails (one per line, format: <code>email, optional name</code>)
                      </label>
                      <textarea
                        rows={4}
                        value={customCsvText}
                        onChange={(e) => setCustomCsvText(e.target.value)}
                        placeholder="john@example.com, John Doe&#10;sarah@example.com, Sarah Smith"
                        className="w-full p-3 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700">Audience Scope:</span>
                  </div>
                  <span className="text-xs font-black text-indigo-600">
                    {countingAudience ? 'Counting...' : `${audienceCount} Recipients Ready`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: PERSONALIZATION & PREVIEW */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Dynamic Variables Mapping */}
              {selectedTemplate?.variables && selectedTemplate.variables.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700">
                    Customize Template Variables
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedTemplate.variables.map((v) => {
                      if (['name', 'first_name', 'last_name', 'email', 'current_year'].includes(v)) {
                        return null; // Auto-resolved per recipient
                      }
                      return (
                        <div key={v} className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600 font-mono">
                            {`{{${v}}}`}
                          </label>
                          <input
                            type="text"
                            value={customVariables[v] || ''}
                            onChange={(e) =>
                              setCustomVariables({ ...customVariables, [v]: e.target.value })
                            }
                            placeholder={`Fallback value for ${v}...`}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sample Email Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-600" /> Live Rendered Preview
                  </span>
                  <span className="text-[11px] text-slate-400">Targeting {audienceCount} recipients</span>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 bg-white">
                  <iframe
                    srcDoc={previewHtml}
                    title="Live Preview"
                    className="w-full h-56 border-none"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="p-5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              disabled={!selectedTemplate || (step === 2 && audienceCount === 0)}
              onClick={() => {
                if (!campaignName.trim()) {
                  setErrorMsg('Please enter a campaign name.');
                  return;
                }
                setErrorMsg('');
                setStep(step + 1);
              }}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              Next Step <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || audienceCount === 0}
              onClick={handleLaunchCampaign}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition disabled:opacity-50"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting ? 'Queuing Batch...' : `Send to ${audienceCount} Recipients`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
