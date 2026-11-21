'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  MessageCircle,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Users,
  Video,
  Check,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';
import {
  parseExcelFile,
  normalizePhone,
  detectCountry,
  detectPhoneHeaders,
  downloadSampleWhatsappTemplate,
} from '@/utils/excel.utils';

export default function SendBulkWhatsappModal({
  isOpen,
  onClose,
  initialTargetSource = 'custom_list',
  onCampaignSent,
}) {
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Audience
  const [targetType, setTargetType] = useState(initialTargetSource);
  const [webinars, setWebinars] = useState([]);
  const [selectedWebinarId, setSelectedWebinarId] = useState('');

  // Excel Upload
  const fileInputRef = useRef(null);
  const [rawRows, setRawRows] = useState([]);
  const [phoneCol, setPhoneCol] = useState('');
  const [nameCol, setNameCol] = useState('');
  const [detectedColumns, setDetectedColumns] = useState([]);
  const [processedRecipients, setProcessedRecipients] = useState({ valid: [], skipped: 0 });

  // Variables mapping: { "1": "col_or_value", "2": "col_or_value" }
  const [variableMappings, setVariableMappings] = useState({});
  const [optInConfirmed, setOptInConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Load templates & webinars on open
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setCampaignName(`WhatsApp Broadcast - ${new Date().toLocaleDateString()}`);
    setTargetType(initialTargetSource);
    setOptInConfirmed(false);
    setErrorMsg(null);

    const loadData = async () => {
      setLoadingTemplates(true);
      try {
        const [tplRes, webRes] = await Promise.all([
          campaignsService.listWhatsappTemplates(true),
          campaignsService.listWhatsappWebinars(),
        ]);
        const tpls = tplRes.data || [];
        setTemplates(tpls);
        if (tpls.length > 0) setSelectedTemplateName(tpls[0].name);

        const webs = webRes.data || [];
        setWebinars(webs);
        if (webs.length > 0) setSelectedWebinarId(webs[0].id);
      } catch (err) {
        console.error('Failed to load templates/webinars:', err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadData();
  }, [isOpen, initialTargetSource]);

  const selectedTemplate = templates.find((t) => t.name === selectedTemplateName);
  const templateVars = Array.isArray(selectedTemplate?.variables) ? selectedTemplate.variables : [];

  // Parse Excel file
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseExcelFile(file);
      if (!rows.length) {
        setErrorMsg('Uploaded spreadsheet appears to be empty.');
        return;
      }
      setRawRows(rows);
      const cols = Object.keys(rows[0]);
      setDetectedColumns(cols);

      // Auto-detect phone and name columns
      const { phoneKey, nameKey } = detectPhoneHeaders(rows[0]);
      setPhoneCol(phoneKey || cols[0]);
      setNameCol(nameKey || (cols.length > 1 ? cols[1] : ''));

      // Auto-map template variables
      const initialVars = {};
      templateVars.forEach((v, idx) => {
        const matchingCol = cols.find(
          (c) =>
            c.toLowerCase() === `var_${v}`.toLowerCase() ||
            c.toLowerCase() === `var${v}`.toLowerCase() ||
            c.toLowerCase().includes(`var_${v}`.toLowerCase()),
        );
        initialVars[v] = matchingCol || cols[idx + 2] || '';
      });
      setVariableMappings(initialVars);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to parse Excel file.');
    }
  };

  // Re-process recipients whenever rows, phoneCol, or variableMappings change
  useEffect(() => {
    if (!rawRows.length || !phoneCol) {
      setProcessedRecipients({ valid: [], skipped: 0 });
      return;
    }

    const validList = [];
    let skipped = 0;
    const seen = new Set();

    for (const r of rawRows) {
      const rawP = r[phoneCol];
      const norm = normalizePhone(rawP, '91');
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        // Map template variables
        const mappedVars = {};
        for (const v of templateVars) {
          const colKey = variableMappings[v];
          mappedVars[v] = colKey && r[colKey] ? String(r[colKey]).trim() : '';
        }

        validList.push({
          mobile: norm,
          name: nameCol && r[nameCol] ? String(r[nameCol]).trim() : 'Recipient',
          variables: mappedVars,
          country: detectCountry(norm),
        });
      } else {
        skipped++;
      }
    }

    setProcessedRecipients({ valid: validList, skipped });
  }, [rawRows, phoneCol, nameCol, variableMappings, templateVars]);

  // Handle Dispatch
  const handleDispatch = async () => {
    if (!selectedTemplate) return;
    if (!optInConfirmed) {
      setErrorMsg('Please confirm that recipients have agreed to receive WhatsApp messages.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        name: campaignName.trim(),
        template_name: selectedTemplate.name,
        language: selectedTemplate.language || 'en_US',
        target_type: targetType,
      };

      if (targetType === 'custom_list') {
        if (!processedRecipients.valid.length) {
          setErrorMsg('No valid recipient phone numbers found in the uploaded list.');
          setSubmitting(false);
          return;
        }
        payload.custom_recipients = processedRecipients.valid.map((r) => ({
          mobile: r.mobile,
          name: r.name,
          variables: r.variables,
        }));
      } else if (targetType === 'webinar_registrants') {
        if (!selectedWebinarId) {
          setErrorMsg('Please select a webinar audience.');
          setSubmitting(false);
          return;
        }
        payload.target_id = selectedWebinarId;
      }

      await campaignsService.sendBulkWhatsappCampaign(payload);
      if (onCampaignSent) onCampaignSent();
      onClose();
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || err.message || 'Failed to dispatch WhatsApp broadcast.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Simulator rendered text using first valid recipient or sample
  const sampleRecipient = processedRecipients.valid[0];
  const renderedSimulatorText = selectedTemplate
    ? selectedTemplate.body_text.replace(/\{\{(\d+)\}\}/g, (_, num) => {
        return sampleRecipient?.variables?.[num] || `[Variable ${num}]`;
      })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-100">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Send Bulk WhatsApp Campaign</h2>
              <p className="text-xs text-slate-500">
                Meta Cloud API Template Broadcast with Excel Contact Import
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center gap-6 text-xs font-bold text-slate-500">
          <div className={`flex items-center gap-2 ${step === 1 ? 'text-emerald-700' : ''}`}>
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              1
            </span>
            Template &amp; Audience
          </div>
          <div className={`flex items-center gap-2 ${step === 2 ? 'text-emerald-700' : ''}`}>
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 2 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              2
            </span>
            Variables &amp; Preview
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-6">
              {/* Campaign Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Campaign Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Webinar Confirmation Alert"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
              </div>

              {/* Template Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Approved Meta Template <span className="text-rose-500">*</span>
                </label>
                {loadingTemplates ? (
                  <div className="py-3 text-xs text-slate-400 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading templates...
                  </div>
                ) : templates.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    No approved WhatsApp templates found in LMS. Please click &quot;Sync with Meta&quot; in the Message Templates tab.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selectedTemplateName}
                      onChange={(e) => setSelectedTemplateName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                    >
                      {templates.map((t) => (
                        <option key={t.template_id} value={t.name}>
                          {t.name} ({t.category} · {t.language})
                        </option>
                      ))}
                    </select>

                    {selectedTemplate && (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed">
                        <span className="font-bold text-slate-800 block mb-1">Body Text:</span>
                        <p className="whitespace-pre-wrap">{selectedTemplate.body_text}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Target Audience Source */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Target Audience
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setTargetType('custom_list')}
                    className={`p-4 rounded-xl border text-left transition flex items-center gap-3.5 ${
                      targetType === 'custom_list'
                        ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Upload Excel / CSV</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Import contacts and map variables directly
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('webinar_registrants')}
                    className={`p-4 rounded-xl border text-left transition flex items-center gap-3.5 ${
                      targetType === 'webinar_registrants'
                        ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Webinar Registrants</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Broadcast to attendees of a specific live session
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Excel Dropzone (When custom_list) */}
              {targetType === 'custom_list' && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Excel / CSV File
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadSampleWhatsappTemplate(templateVars)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Sample Template (.xlsx)
                    </button>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/20 rounded-2xl p-6 text-center cursor-pointer transition"
                  >
                    <Upload className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-800">
                      Click to choose or drag &amp; drop your contact spreadsheet
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Supports .xlsx, .xls, and .csv with international phone numbers
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Column Mapping & Counts */}
                  {rawRows.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">
                          Total Rows in File: <strong>{rawRows.length}</strong>
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {processedRecipients.valid.length} Valid Phone Numbers
                          </span>
                          {processedRecipients.skipped > 0 && (
                            <span className="text-amber-700 font-bold">
                              ({processedRecipients.skipped} duplicates/skipped)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Phone Number Column <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={phoneCol}
                            onChange={(e) => setPhoneCol(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white"
                          >
                            {detectedColumns.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Recipient Name Column
                          </label>
                          <select
                            value={nameCol}
                            onChange={(e) => setNameCol(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white"
                          >
                            <option value="">-- None (Use Generic) --</option>
                            {detectedColumns.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Webinar Picker (When webinar_registrants) */}
              {targetType === 'webinar_registrants' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Select Webinar Session <span className="text-rose-500">*</span>
                  </label>
                  {webinars.length === 0 ? (
                    <p className="text-xs text-slate-400">No active webinars found.</p>
                  ) : (
                    <select
                      value={selectedWebinarId}
                      onChange={(e) => setSelectedWebinarId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                    >
                      {webinars.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.title} ({w.registrant_count || 0} registered)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Variable Mapping & Simulator Preview */
            <div className="space-y-6">
              {/* Template Variable Mappings */}
              {templateVars.length > 0 && targetType === 'custom_list' && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Map Template Variables ({templateVars.length} parameters)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {templateVars.map((v) => (
                      <div key={v}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Placeholder <code className="text-emerald-700 font-mono font-bold">&lbrace;&lbrace;{v}&rbrace;&rbrace;</code>
                        </label>
                        <select
                          value={variableMappings[v] || ''}
                          onChange={(e) =>
                            setVariableMappings({ ...variableMappings, [v]: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white text-slate-800"
                        >
                          <option value="">-- Choose Excel Column --</option>
                          {detectedColumns.map((c) => (
                            <option key={c} value={c}>
                              Column: {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WhatsApp Live Simulator Preview */}
              <div>
                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Live WhatsApp Message Preview
                </span>
                <div className="bg-slate-100 rounded-2xl p-6 flex justify-center">
                  <div className="w-full max-w-sm bg-[#EFEAE2] rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
                    {/* Fake WhatsApp Header */}
                    <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#075E54] font-bold text-xs flex items-center justify-center">
                        EL
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-none">Elevate Learning</div>
                        <div className="text-[10px] text-emerald-200 mt-0.5">Official WhatsApp Account</div>
                      </div>
                    </div>

                    {/* Chat Area */}
                    <div className="p-4 flex flex-col justify-end min-h-[160px]">
                      <div className="bg-white rounded-2xl rounded-tl-sm p-3.5 shadow-sm border border-slate-200/50 max-w-[90%] text-xs text-slate-800 space-y-1">
                        <p className="whitespace-pre-wrap leading-relaxed">{renderedSimulatorText}</p>
                        <div className="text-[9px] text-slate-400 text-right flex items-center justify-end gap-1">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <Check className="w-3 h-3 text-emerald-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compliance Opt-in Confirmation */}
              <label className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={optInConfirmed}
                  onChange={(e) => setOptInConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <strong className="text-slate-900 block font-bold mb-0.5">
                    Meta Policy &amp; Consent Confirmation
                  </strong>
                  <span className="text-slate-600">
                    I confirm that all {targetType === 'custom_list' ? processedRecipients.valid.length : 'selected'} recipients have opted in and provided consent to receive WhatsApp notifications from this business, in compliance with Meta WhatsApp Business Policies.
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition"
            >
              &larr; Back to Setup
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition"
            >
              Cancel
            </button>

            {step === 1 ? (
              <button
                type="button"
                disabled={
                  !campaignName.trim() ||
                  !selectedTemplate ||
                  (targetType === 'custom_list' && processedRecipients.valid.length === 0)
                }
                onClick={() => setStep(2)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 transition disabled:opacity-50"
              >
                Continue to Review &rarr;
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting || !optInConfirmed}
                onClick={handleDispatch}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Dispatching WhatsApp Campaign...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Dispatch Broadcast Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

