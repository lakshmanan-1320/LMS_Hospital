import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

export const certificateService = {
  // Public Verification
  async verifyPublicCertificate(token) {
    return apiClient.get(API_ENDPOINTS.CERTIFICATES.PUBLIC_VERIFY(token));
  },

  // Student / My Certificates
  async getMyCertificates(params = {}) {
    return apiClient.get(API_ENDPOINTS.CERTIFICATES.MY, { params });
  },

  async claimCourseCertificate(courseId) {
    return apiClient.post(API_ENDPOINTS.CERTIFICATES.CLAIM(courseId));
  },

  async downloadCertificate(certificateId, filename = 'certificate.pdf') {
    const response = await apiClient.get(
      API_ENDPOINTS.CERTIFICATES.DOWNLOAD(certificateId),
      {
        responseType: 'blob',
      }
    );
    const blobData =
      response instanceof Blob
        ? response
        : response?.data instanceof Blob
        ? response.data
        : response?.data
        ? new Blob([response.data], { type: 'application/pdf' })
        : new Blob([response], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blobData);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  getViewUrl(certificateId) {
    const baseURL = apiClient.defaults.baseURL || '';
    return `${baseURL}${API_ENDPOINTS.CERTIFICATES.VIEW(certificateId)}`;
  },

  // Webinar Settings
  async getWebinarSettings(webinarId) {
    return apiClient.get(API_ENDPOINTS.CERTIFICATES.WEBINAR_SETTINGS(webinarId));
  },

  async updateWebinarSettings(webinarId, data) {
    return apiClient.put(
      API_ENDPOINTS.CERTIFICATES.WEBINAR_SETTINGS(webinarId),
      data
    );
  },

  // Admin Operations
  async getAdminOverview() {
    return apiClient.get(API_ENDPOINTS.CERTIFICATES.ADMIN.OVERVIEW);
  },

  async getAdminCertificates(params = {}) {
    return apiClient.get(API_ENDPOINTS.CERTIFICATES.ADMIN.LIST, { params });
  },

  async getCertificateDetails(id) {
    return apiClient.get(API_ENDPOINTS.CERTIFICATES.ADMIN.DETAILS(id));
  },

  async getWebinarAttendanceReport(webinarId) {
    return apiClient.get(
      API_ENDPOINTS.CERTIFICATES.ADMIN.ATTENDANCE_REPORT(webinarId)
    );
  },

  async correctWebinarAttendance(data) {
    return apiClient.post(
      API_ENDPOINTS.CERTIFICATES.ADMIN.CORRECT_ATTENDANCE,
      data
    );
  },

  async manualIssueWebinarCertificate(data) {
    return apiClient.post(
      API_ENDPOINTS.CERTIFICATES.ADMIN.MANUAL_ISSUE,
      data
    );
  },

  async revokeCertificate(certificateId, reason) {
    return apiClient.post(
      API_ENDPOINTS.CERTIFICATES.ADMIN.REVOKE(certificateId),
      { reason }
    );
  },

  async reissueCertificate(certificateId, data) {
    return apiClient.post(
      API_ENDPOINTS.CERTIFICATES.ADMIN.REISSUE(certificateId),
      data
    );
  },

  // Template Management
  async getTemplates(type = 'all') {
    return apiClient.get(API_ENDPOINTS.CERTIFICATES.ADMIN.TEMPLATES, {
      params: { type },
    });
  },

  async createTemplate(data) {
    return apiClient.post(
      API_ENDPOINTS.CERTIFICATES.ADMIN.CREATE_TEMPLATE,
      data
    );
  },

  async updateTemplate(templateId, data) {
    return apiClient.put(
      API_ENDPOINTS.CERTIFICATES.ADMIN.UPDATE_TEMPLATE(templateId),
      data
    );
  },
};
