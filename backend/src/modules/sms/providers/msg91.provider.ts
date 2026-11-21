import { Injectable, Logger } from '@nestjs/common';
import {
  SmsProvider,
  SmsFieldDefinition,
  SmsCredentials,
  SmsTemplateDetails,
  CreateTemplateInput,
  SendSmsPayload,
  SendBulkSmsPayload,
  SmsDeliveryReport,
} from '../interfaces/sms-provider.interface';
import { Msg91Client } from './msg91.client';
import { extractVariables } from '../utils/sms.utils';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeStatus(raw: any): 'delivered' | 'failed' | 'rejected' | null {
  const value = String(raw ?? '').toLowerCase();
  if (!value) return null;
  if (/deliver/.test(value) && !/undeliver|not deliver/.test(value)) return 'delivered';
  if (/reject|ndnc|dnd|block|invalid|black/.test(value)) return 'rejected';
  if (/fail|undeliver|expire|error/.test(value)) return 'failed';
  if (value === '1') return 'delivered';
  if (value === '2') return 'failed';
  if (value === '16' || value === '9') return 'rejected';
  return null;
}

function findRows(body: any): any[] {
  if (Array.isArray(body)) return body;
  for (const key of ['data', 'logs', 'report', 'result', 'records']) {
    const value = body?.[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = findRows(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

@Injectable()
export class Msg91Provider implements SmsProvider {
  readonly key = 'msg91';
  readonly name = 'MSG91 Flow v5';
  private readonly logger = new Logger(Msg91Provider.name);
  private readonly client = new Msg91Client();

  readonly fields: SmsFieldDefinition[] = [
    {
      name: 'authKey',
      label: 'Auth Key',
      type: 'secret',
      required: true,
      help: 'Found in your MSG91 User Profile → Authkey.',
    },
  ];

  async validateCredentials(credentials: SmsCredentials): Promise<{ ok: boolean; message?: string }> {
    const authKey = String(credentials.authKey || '').trim();
    if (!authKey) {
      return { ok: false, message: 'MSG91 Auth Key is required.' };
    }
    try {
      const today = isoDate(new Date());
      await this.client.getAnalytics(authKey, { startDate: today, endDate: today });
      return { ok: true };
    } catch (err: any) {
      this.logger.warn(`MSG91 credential check failed: ${err.message}`);
      return { ok: false, message: err.message || 'Invalid MSG91 credentials.' };
    }
  }

  async getTemplate(credentials: SmsCredentials, templateId: string): Promise<SmsTemplateDetails> {
    const authKey = String(credentials.authKey || '').trim();
    const body = await this.client.getTemplateVersions(authKey, templateId);
    const versions = findRows(body);
    if (!versions.length) {
      throw new Error(`Template '${templateId}' was not found in the connected MSG91 account.`);
    }

    const version = versions.find((v: any) => v.is_active || v.isActive || v.status === 1) || versions[0];
    const text = version.template || version.template_data || version.content || version.message || version.body || '';

    return {
      providerTemplateId: templateId,
      dltTemplateId: version.DLT_TE_ID || version.dlt_template_id || version.dltTemplateId || null,
      name: version.template_name || version.name || null,
      body: String(text),
      variables: extractVariables(String(text)),
      senderId: version.sender_id || version.senderId || null,
    };
  }

  async createTemplate(credentials: SmsCredentials, input: CreateTemplateInput): Promise<SmsTemplateDetails> {
    const authKey = String(credentials.authKey || '').trim();
    if (!input.body || !input.body.trim()) {
      throw new Error('Template body cannot be empty.');
    }

    const templateName = input.name || `lms_tpl_${Date.now()}`;
    const res = await this.client.addTemplate(authKey, {
      template: input.body,
      templateName,
      senderId: input.senderId,
      dltTemplateId: input.dltTemplateId,
      smsType: 'NORMAL',
    });

    const templateId = res?.data?.template_id || res?.template_id;
    if (!templateId) {
      throw new Error('MSG91 created the template but returned no template ID reference.');
    }

    return {
      providerTemplateId: String(templateId),
      dltTemplateId: input.dltTemplateId || null,
      name: templateName,
      body: input.body,
      variables: extractVariables(input.body),
      senderId: input.senderId || null,
    };
  }

  async send(credentials: SmsCredentials, payload: SendSmsPayload): Promise<{ requestId: string }> {
    const authKey = String(credentials.authKey || '').trim();
    const body = await this.client.sendFlow(authKey, {
      templateId: payload.templateId,
      recipients: [
        {
          mobiles: payload.mobile,
          ...(payload.variables || {}),
        },
      ],
    });

    const requestId = body?.message || body?.request_id || body?.requestId;
    if (!requestId) {
      throw new Error('MSG91 accepted the request but returned no reference ID.');
    }
    return { requestId: String(requestId) };
  }

  async sendBulk(credentials: SmsCredentials, payload: SendBulkSmsPayload): Promise<{ requestId: string }> {
    const authKey = String(credentials.authKey || '').trim();
    if (!payload.recipients || payload.recipients.length === 0) {
      throw new Error('Recipient list cannot be empty.');
    }

    const formattedRecipients = payload.recipients.map((r) => ({
      mobiles: r.mobile,
      ...(r.variables || {}),
    }));

    const body = await this.client.sendFlow(authKey, {
      templateId: payload.templateId,
      recipients: formattedRecipients,
      shortUrl: payload.shortUrl,
    });

    const requestId = body?.message || body?.request_id || body?.requestId;
    if (!requestId) {
      throw new Error('MSG91 accepted the bulk request but returned no reference ID.');
    }
    return { requestId: String(requestId) };
  }

  async fetchStatuses(credentials: SmsCredentials): Promise<SmsDeliveryReport[]> {
    const authKey = String(credentials.authKey || '').trim();
    const end = new Date();
    const start = new Date(end.getTime() - 2 * 24 * 60 * 60 * 1000); // 48-72h log window
    const body = await this.client.getLogs(authKey, {
      startDate: isoDate(start),
      endDate: isoDate(end),
    });

    return findRows(body)
      .map((row: any) => ({
        requestId: String(row.requestId || row.request_id || row.reqId || row.requestID || ''),
        mobile: String(row.number || row.mobile || row.telNum || row.mobiles || '').replace(/\D/g, ''),
        status: normalizeStatus(row.status ?? row.deliveryStatus ?? row.report_status ?? row.description),
        at: row.deliveryTime || row.delivery_time || row.date || row.updatedAt || null,
        detail: row.description || row.failureReason || null,
      }))
      .filter((row: SmsDeliveryReport) => Boolean(row.requestId && row.status));
  }
}

