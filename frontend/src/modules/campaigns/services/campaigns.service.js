import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

export const campaignsService = {
  // ── SMS CONFIGURATION ──────────────────────────────────────────────────
  async getSmsConfig() {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.SMS_CONFIG);
  },

  async saveSmsConfig(data) {
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.SMS_CONFIG, data);
  },

  async testSmsConnection(phoneNumber) {
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.SMS_CONFIG_TEST, { phoneNumber });
  },

  // ── TEMPLATES (DLT) ────────────────────────────────────────────────────
  async listTemplates(activeOnly = false) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.SMS_TEMPLATES, {
      params: { activeOnly },
    });
  },

  async getTemplate(templateId) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.SMS_TEMPLATE_BY_ID(templateId));
  },

  async getVariableSources() {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.SMS_TEMPLATE_SOURCES);
  },

  async createTemplate(data) {
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.SMS_TEMPLATES, data);
  },

  async updateTemplate(templateId, data) {
    return apiClient.put(API_ENDPOINTS.CAMPAIGNS.SMS_TEMPLATE_BY_ID(templateId), data);
  },

  async deleteTemplate(templateId) {
    return apiClient.delete(API_ENDPOINTS.CAMPAIGNS.SMS_TEMPLATE_BY_ID(templateId));
  },

  // ── AUDIENCE DISCOVERY ─────────────────────────────────────────────────
  async listWebinarAudiences() {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.AUDIENCE_WEBINARS);
  },

  async previewWebinarAudience(webinarId, countryCode = '') {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.AUDIENCE_WEBINAR_PREVIEW(webinarId, countryCode));
  },

  // ── CAMPAIGN DISPATCH (STRICTLY TEMPLATE-BASED) ────────────────────────
  async sendBulkSmsCampaign(data) {
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.SMS_SEND_BULK, data);
  },

  async listCampaigns(limit = 50, offset = 0) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.BASE, {
      params: { limit, offset },
    });
  },

  async getCampaignDetails(campaignId) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.BY_ID(campaignId));
  },

  async listOutboxLogs(limit = 100) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.SMS_OUTBOX_LOGS, {
      params: { limit },
    });
  },

  async syncStatuses() {
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.SMS_SYNC_STATUSES);
  },

  // ── EMAIL CONFIGURATION (SUPER ADMIN) ───────────────────────────────
  async getEmailConfig() {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.EMAIL_CONFIG);
  },

  async saveEmailConfig(data) {
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.EMAIL_CONFIG, data);
  },

  async testEmailGateway(data) {
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.EMAIL_CONFIG_TEST, data);
  },

  // ── EMAIL TEMPLATES (ADMIN DESIGNER) ────────────────────────────────
  async listEmailTemplates(activeOnly = false) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.EMAIL_TEMPLATES, {
      params: { activeOnly },
    });
  },

  async getEmailTemplatePresets() {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.EMAIL_TEMPLATE_PRESETS);
  },

  async getEmailTemplate(templateId) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.EMAIL_TEMPLATE_BY_ID(templateId));
  },

  async createEmailTemplate(data) {
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.EMAIL_TEMPLATES, data);
  },

  async updateEmailTemplate(templateId, data) {
    return apiClient.put(API_ENDPOINTS.CAMPAIGNS.EMAIL_TEMPLATE_BY_ID(templateId), data);
  },

  async deleteEmailTemplate(templateId) {
    return apiClient.delete(API_ENDPOINTS.CAMPAIGNS.EMAIL_TEMPLATE_BY_ID(templateId));
  },

  // ── EMAIL AUDIENCE & BULK DISPATCH (ADMIN) ──────────────────────────
  async getEmailAudienceCount(targetType) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.EMAIL_AUDIENCE_COUNT(targetType));
  },

  async sendBulkEmailCampaign(data) {
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.EMAIL_SEND_BULK, data);
  },

  async listEmailCampaigns(limit = 20, offset = 0) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.EMAIL_LIST, {
      params: { limit, offset },
    });
  },

  async listEmailOutboxLogs(params = {}) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.EMAIL_OUTBOX_LOGS, {
      params,
    });
  },

  // ── WHATSAPP META CAMPAIGNS ──────────────────────────────────────────
  async getWhatsappConfig() {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.WHATSAPP_CONFIG);
  },

  async saveWhatsappConfig(data) {
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.WHATSAPP_CONFIG, data);
  },

  async testWhatsappGateway(data) {
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.WHATSAPP_CONFIG_TEST, data);
  },

  async listWhatsappTemplates(activeOnly = false) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.WHATSAPP_TEMPLATES, {
      params: { activeOnly },
    });
  },

  async syncWhatsappTemplates() {
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.WHATSAPP_TEMPLATES_SYNC);
  },

  async listWhatsappWebinars() {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.WHATSAPP_AUDIENCES_WEBINARS);
  },

  async sendBulkWhatsappCampaign(data) {
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.WHATSAPP_SEND_BULK, data);
  },

  async listWhatsappCampaigns(limit = 50, offset = 0) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.WHATSAPP_LIST, {
      params: { limit, offset },
    });
  },

  async listWhatsappOutboxLogs(params = {}) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.WHATSAPP_OUTBOX_LOGS, {
      params,
    });
  },

  async getWhatsappOutboxStats() {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.WHATSAPP_OUTBOX_STATS);
  },
};

export default campaignsService;

