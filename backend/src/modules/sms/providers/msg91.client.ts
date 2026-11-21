import { Logger } from '@nestjs/common';

export class Msg91Client {
  private readonly logger = new Logger(Msg91Client.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl?: string, timeoutMs: number = 15000) {
    this.baseUrl = (baseUrl || process.env.MSG91_BASE_URL || 'https://control.msg91.com').replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  private extractBodyError(body: any): string | null {
    if (!body || typeof body !== 'object') return null;
    if (typeof body.error === 'string' && body.error) return body.error;
    if (body.hasError === true) return Array.isArray(body.errors) ? body.errors.join(', ') : String(body.errors || 'Request failed');
    if (body.type === 'error') return String(body.message || 'Request failed');
    if (body.status === 'fail' || body.status === 'error') return String(body.errors || body.message || 'Request failed');
    return null;
  }

  async request(method: string, path: string, options: { authKey?: string; query?: Record<string, any>; json?: any } = {}): Promise<any> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (options.query) {
      Object.entries(options.query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          authkey: options.authKey || '',
          accept: 'application/json',
          ...(options.json ? { 'content-type': 'application/json' } : {}),
        },
        body: options.json ? JSON.stringify(options.json) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let body: any = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { raw: text };
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error('MSG91 rejected the auth key. Please verify credentials in SMS Settings.');
      }

      if (response.status >= 500 || response.status === 429) {
        throw new Error(`MSG91 is temporarily unavailable (HTTP ${response.status}).`);
      }

      const error = !response.ok ? (this.extractBodyError(body) || `HTTP ${response.status}`) : this.extractBodyError(body);
      if (error) {
        const isUnauthorized = /unauthori[sz]ed|invalid auth|authkey/i.test(error);
        throw new Error(isUnauthorized ? 'MSG91 rejected the auth key.' : error);
      }

      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * POST /api/v5/flow — send a template-based SMS to one or more recipients.
   */
  async sendFlow(authKey: string, params: { templateId: string; recipients: Array<Record<string, any>>; shortUrl?: boolean }): Promise<any> {
    return this.request('POST', '/api/v5/flow', {
      authKey,
      json: {
        template_id: params.templateId,
        short_url: params.shortUrl ? '1' : '0',
        realTimeResponse: '1',
        recipients: params.recipients,
      },
    });
  }

  /**
   * POST /api/v5/sms/getTemplateVersions — retrieve template details and versions.
   */
  async getTemplateVersions(authKey: string, templateId: string): Promise<any> {
    return this.request('POST', '/api/v5/sms/getTemplateVersions', {
      authKey,
      json: { template_id: templateId },
    });
  }

  /**
   * POST /api/v5/sms/addTemplate — register a new flow template in MSG91.
   */
  async addTemplate(
    authKey: string,
    params: { template: string; templateName: string; senderId?: string; dltTemplateId?: string; smsType?: string },
  ): Promise<any> {
    return this.request('POST', '/api/v5/sms/addTemplate', {
      authKey,
      json: {
        template: params.template,
        template_name: params.templateName,
        sender_id: params.senderId || undefined,
        dlt_template_id: params.dltTemplateId || undefined,
        smsType: params.smsType || 'NORMAL',
      },
    });
  }

  /**
   * GET /api/v5/report/analytics/p/sms — credential validation / analytics.
   */
  async getAnalytics(authKey: string, params: { startDate: string; endDate: string }): Promise<any> {
    return this.request('GET', '/api/v5/report/analytics/p/sms', {
      authKey,
      query: params,
    });
  }

  /**
   * POST /api/v5/report/logs/p/sms — per-message delivery logs (range <= 3 days).
   */
  async getLogs(authKey: string, params: { startDate: string; endDate: string }): Promise<any> {
    return this.request('POST', '/api/v5/report/logs/p/sms', {
      authKey,
      query: params,
    });
  }
}

