'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Mail,
  Send,
  Layers,
  Clock,
  Settings,
  FileSpreadsheet,
} from 'lucide-react';

import EmailSettingsTab from '@/components/campaigns/EmailSettingsTab';
import TestEmailModal from '@/components/campaigns/TestEmailModal';
import EmailTemplatesTab from '@/components/campaigns/EmailTemplatesTab';
import EmailCampaignsTab from '@/components/campaigns/EmailCampaignsTab';
import SendBulkEmailModal from '@/components/campaigns/SendBulkEmailModal';
import EmailOutboxLogsTab from '@/components/campaigns/EmailOutboxLogsTab';

export default function EmailCampaignsPage() {
  const params = useParams();
  const role = params?.role || 'admin';
  const isSuperAdmin = role === 'super-admin';

  const [activeTab, setActiveTab] = useState('campaigns');
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [initialTargetType, setInitialTargetType] = useState('students');
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Page Title & Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Mail className="w-7 h-7 text-indigo-600" />
            {isSuperAdmin ? 'Email Gateway Administration' : 'Email Campaign Management'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isSuperAdmin
              ? 'Configure platform SMTP credentials, TLS/SSL encryption, and test mail delivery.'
              : 'Responsive HTML email template broadcasts, audience targeting, and real-time delivery tracking.'}
          </p>
        </div>

        {/* Action Button: Super Admin tests gateway; Admin sends bulk email & upload excel */}
        {isSuperAdmin ? (
          <button
            onClick={() => setShowTestEmailModal(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition self-start md:self-auto"
          >
            <Mail className="w-4 h-4" /> Test Email Gateway
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={() => {
                setInitialTargetType('custom_list');
                setShowBulkEmailModal(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition"
            >
              <FileSpreadsheet className="w-4 h-4" /> Upload Excel &amp; Send Email
            </button>
            <button
              onClick={() => {
                setInitialTargetType('students');
                setShowBulkEmailModal(true);
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition"
            >
              <Send className="w-4 h-4" /> Send Bulk Email
            </button>
          </div>
        )}
      </div>

      {/* Super Admin sees direct dedicated SMTP configuration screen */}
      {isSuperAdmin ? (
        <div>
          <EmailSettingsTab
            onOpenTestModal={() => setShowTestEmailModal(true)}
          />
        </div>
      ) : (
        /* Admin has 3 focused tabs: Email Campaigns, Email Templates, Email Delivery Logs */
        <>
          <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === 'campaigns'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Mail className="w-4 h-4" /> Email Campaigns
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === 'templates'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" /> Email Templates
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
          </div>

          <div>
            {activeTab === 'campaigns' && (
              <EmailCampaignsTab
                key={refreshTrigger}
                role={role}
                onLaunchSendBulk={(target = 'students') => {
                  setInitialTargetType(target);
                  setShowBulkEmailModal(true);
                }}
              />
            )}

            {activeTab === 'templates' && <EmailTemplatesTab role={role} />}

            {activeTab === 'logs' && <EmailOutboxLogsTab role={role} />}
          </div>
        </>
      )}

      {/* Admin Send Bulk Email Wizard Modal */}
      {!isSuperAdmin && (
        <SendBulkEmailModal
          isOpen={showBulkEmailModal}
          role={role}
          initialTargetType={initialTargetType}
          onClose={() => setShowBulkEmailModal(false)}
          onCampaignSent={() => {
            setRefreshTrigger((prev) => prev + 1);
            setActiveTab('campaigns');
          }}
        />
      )}

      {/* Super Admin Test Email Dialog */}
      {isSuperAdmin && (
        <TestEmailModal
          isOpen={showTestEmailModal}
          onClose={() => setShowTestEmailModal(false)}
          onTestSuccess={() => {
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}

