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
import { extractVariables } from '../utils/sms.utils';

@Injectable()
export class MockSmsProvider implements SmsProvider {
  readonly key = 'mock';
  readonly name = 'Mock SMS Simulator (Local Dev)';
  private readonly logger = new Logger(MockSmsProvider.name);

  readonly fields: SmsFieldDefinition[] = [
    {
      name: 'authKey',
      label: 'Simulator Token',
      type: 'text',
      required: false,
      help: 'Optional simulation token for testing.',
    },
  ];

  async validateCredentials(credentials: SmsCredentials): Promise<{ ok: boolean; message?: string }> {
    this.logger.log(`Mock SMS credentials validated successfully.`);
    return { ok: true };
  }

  async getTemplate(credentials: SmsCredentials, templateId: string): Promise<SmsTemplateDetails> {
    return {
      providerTemplateId: templateId,
      dltTemplateId: '14070000000000',
      name: `Mock Template ${templateId}`,
      body: 'Hello ##name##, your live session for ##webinar_title## starts at ##start_time##. Join here: ##meeting_link## - Elevate LMS',
      variables: ['name', 'webinar_title', 'start_time', 'meeting_link'],
      senderId: 'ELVMOK',
    };
  }

  async createTemplate(credentials: SmsCredentials, input: CreateTemplateInput): Promise<SmsTemplateDetails> {
    const providerTemplateId = `mock_tpl_${Date.now()}`;
    return {
      providerTemplateId,
      dltTemplateId: input.dltTemplateId || '14070000000000',
      name: input.name,
      body: input.body,
      variables: extractVariables(input.body),
      senderId: input.senderId || 'ELVMOK',
    };
  }

  async send(credentials: SmsCredentials, payload: SendSmsPayload): Promise<{ requestId: string }> {
    const requestId = `mock_req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.logger.log(`[MockSms] Sent single SMS to ${payload.mobile} via template ${payload.templateId}. Req ID: ${requestId}`);
    return { requestId };
  }

  async sendBulk(credentials: SmsCredentials, payload: SendBulkSmsPayload): Promise<{ requestId: string }> {
    const requestId = `mock_bulk_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.logger.log(
      `[MockSms] Sent bulk SMS to ${payload.recipients.length} recipients via template ${payload.templateId}. Req ID: ${requestId}`,
    );
    return { requestId };
  }

  async fetchStatuses(credentials: SmsCredentials): Promise<SmsDeliveryReport[]> {
    return [];
  }
}

