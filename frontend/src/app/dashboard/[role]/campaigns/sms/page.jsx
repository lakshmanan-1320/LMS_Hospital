'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Send,
  FileText,
  Settings,
  Clock,
  Smartphone,
  FileSpreadsheet,
} from 'lucide-react';
import SmsCampaignsTab from '@/components/campaigns/SmsCampaignsTab';
import SmsTemplatesTab from '@/components/campaigns/SmsTemplatesTab';
import SmsSettingsTab from '@/components/campaigns/SmsSettingsTab';
import SmsOutboxLogsTab from '@/components/campaigns/SmsOutboxLogsTab';
import SendBulkSmsModal from '@/components/campaigns/SendBulkSmsModal';
import TestSmsModal from '@/components/campaigns/TestSmsModal';

export default function SmsCampaignsPage() {
  const params = useParams();
  const role = params?.role || 'admin';
  const isSuperAdmin = role === 'super-admin';

  // Super Admin manages Gateway Settings & Templates; Admin dispatches Campaigns
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'settings' : 'campaigns');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [initialTargetSource, setInitialTargetSource] = useState('webinar_registrants');
  const [showTestModal, setShowTestModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Page Title & Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Smartphone className="w-7 h-7 text-indigo-600" />
            {isSuperAdmin ? 'SMS Gateway Administration' : 'SMS Campaign Management'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isSuperAdmin
              ? 'Configure platform SMS credentials (MSG91 Flow v5) and manage approved DLT templates.'
              : 'Strictly template-driven bulk SMS messaging for webinar attendees, student alerts, and course engagement.'}
          </p>
        </div>

        {/* Super Admin gets "Test SMS Gateway"; Admin gets "Send Bulk SMS" & "Upload Excel & Send SMS" */}
        {isSuperAdmin ? (
          <button
            onClick={() => setShowTestModal(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition self-start md:self-auto"
          >
            <Smartphone className="w-4 h-4" /> Test SMS Gateway
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={() => {
                setInitialTargetSource('custom_list');
                setShowBulkModal(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition"
            >
              <FileSpreadsheet className="w-4 h-4" /> Upload Excel &amp; Send SMS
            </button>
            <button
              onClick={() => {
                setInitialTargetSource('webinar_registrants');
                setShowBulkModal(true);
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition"
            >
              <Send className="w-4 h-4" /> Send Bulk SMS
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        {isSuperAdmin ? (
          // SUPER ADMIN TABS (Only Gateway Settings & Templates)
          <>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" /> SMS Gateway Settings
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === 'templates'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" /> SMS Templates (DLT)
            </button>
          </>
        ) : (
          // ADMIN TABS (Only Real-time Campaigns, Templates, & Delivery Outbox)
          <>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === 'campaigns'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Send className="w-4 h-4" /> SMS Campaigns
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === 'templates'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" /> SMS Templates (DLT)
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === 'logs'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" /> Delivery Logs & Outbox
            </button>
          </>
        )}
      </div>

      {/* Active Tab View */}
      <div>
        {activeTab === 'settings' && isSuperAdmin && (
          <SmsSettingsTab
            role={role}
            onOpenTestModal={() => setShowTestModal(true)}
          />
        )}

        {activeTab === 'templates' && <SmsTemplatesTab role={role} />}

        {activeTab === 'campaigns' && !isSuperAdmin && (
          <SmsCampaignsTab
            key={refreshTrigger}
            role={role}
            onLaunchCreateCampaign={(source = 'webinar_registrants') => {
              setInitialTargetSource(source);
              setShowBulkModal(true);
            }}
          />
        )}

        {activeTab === 'logs' && !isSuperAdmin && <SmsOutboxLogsTab role={role} />}
      </div>

      {/* Admin Bulk SMS Campaign Wizard Dialog */}
      {!isSuperAdmin && (
        <SendBulkSmsModal
          isOpen={showBulkModal}
          role={role}
          initialTargetSource={initialTargetSource}
          onClose={() => setShowBulkModal(false)}
          onCampaignSent={() => {
            setRefreshTrigger((prev) => prev + 1);
            setActiveTab('campaigns');
          }}
        />
      )}

      {/* Super Admin Test SMS Dialog */}
      {isSuperAdmin && (
        <TestSmsModal
          isOpen={showTestModal}
          onClose={() => setShowTestModal(false)}
          onTestSuccess={() => {
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}

