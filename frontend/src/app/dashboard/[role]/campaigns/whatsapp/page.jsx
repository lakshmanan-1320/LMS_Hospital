'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  MessageCircle,
  Send,
  FileSpreadsheet,
  FileText,
  Clock,
} from 'lucide-react';

import WhatsappSettingsTab from '@/components/campaigns/WhatsappSettingsTab';
import TestWhatsappModal from '@/components/campaigns/TestWhatsappModal';
import WhatsappTemplatesTab from '@/components/campaigns/WhatsappTemplatesTab';
import WhatsappCampaignsTab from '@/components/campaigns/WhatsappCampaignsTab';
import SendBulkWhatsappModal from '@/components/campaigns/SendBulkWhatsappModal';
import WhatsappOutboxLogsTab from '@/components/campaigns/WhatsappOutboxLogsTab';

export default function WhatsappCampaignsPage() {
  const params = useParams();
  const role = params?.role || 'admin';
  const isSuperAdmin = role === 'super-admin';

  const [activeTab, setActiveTab] = useState('campaigns');
  const [showBulkWhatsappModal, setShowBulkWhatsappModal] = useState(false);
  const [initialTargetSource, setInitialTargetSource] = useState('custom_list');
  const [showTestWhatsappModal, setShowTestWhatsappModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Page Title & Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <MessageCircle className="w-7 h-7 text-emerald-600" />
            {isSuperAdmin ? 'WhatsApp Gateway Administration' : 'WhatsApp Campaign Management'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isSuperAdmin
              ? 'Configure Meta WhatsApp Cloud API credentials, system tokens, webhook verification, and test message delivery.'
              : 'Strictly template-driven bulk WhatsApp broadcasts for webinar alerts, Excel contacts, and student communications.'}
          </p>
        </div>

        {/* Action Buttons */}
        {isSuperAdmin ? (
          <button
            onClick={() => setShowTestWhatsappModal(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition self-start md:self-auto"
          >
            <MessageCircle className="w-4 h-4" /> Test WhatsApp Gateway
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={() => {
                setInitialTargetSource('custom_list');
                setShowBulkWhatsappModal(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition"
            >
              <FileSpreadsheet className="w-4 h-4" /> Upload Excel &amp; Send WhatsApp
            </button>
            <button
              onClick={() => {
                setInitialTargetSource('webinar_registrants');
                setShowBulkWhatsappModal(true);
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition"
            >
              <Send className="w-4 h-4" /> Send Bulk WhatsApp
            </button>
          </div>
        )}
      </div>

      {/* Super Admin sees direct dedicated WhatsApp Gateway configuration screen */}
      {isSuperAdmin ? (
        <div>
          <WhatsappSettingsTab
            onOpenTestModal={() => setShowTestWhatsappModal(true)}
          />
        </div>
      ) : (
        /* Admin has 3 focused tabs: WhatsApp Campaigns, Message Templates, Delivery Logs */
        <>
          <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === 'campaigns'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp Campaigns
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === 'templates'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" /> Message Templates (Meta)
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === 'logs'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" /> Delivery Logs &amp; Outbox
            </button>
          </div>

          <div>
            {activeTab === 'campaigns' && (
              <WhatsappCampaignsTab
                key={`campaigns-${refreshTrigger}`}
                onLaunchSendBulk={(target) => {
                  setInitialTargetSource(target);
                  setShowBulkWhatsappModal(true);
                }}
              />
            )}

            {activeTab === 'templates' && (
              <WhatsappTemplatesTab key={`templates-${refreshTrigger}`} />
            )}

            {activeTab === 'logs' && (
              <WhatsappOutboxLogsTab key={`logs-${refreshTrigger}`} />
            )}
          </div>
        </>
      )}

      {/* Bulk Dispatch Modal */}
      {showBulkWhatsappModal && (
        <SendBulkWhatsappModal
          isOpen={showBulkWhatsappModal}
          initialTargetSource={initialTargetSource}
          onClose={() => setShowBulkWhatsappModal(false)}
          onCampaignSent={() => setRefreshTrigger((prev) => prev + 1)}
        />
      )}

      {/* Test WhatsApp Modal */}
      {showTestWhatsappModal && (
        <TestWhatsappModal
          isOpen={showTestWhatsappModal}
          onClose={() => setShowTestWhatsappModal(false)}
        />
      )}
    </div>
  );
}

