export interface SmsFieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'secret' | 'number';
  required: boolean;
  help?: string;
}

export interface SmsCredentials {
  authKey?: string;
  apiUsername?: string;
  apiPassword?: string;
  [key: string]: any;
}

export interface SmsTemplateDetails {
  providerTemplateId: string;
  dltTemplateId?: string | null;
  name?: string | null;
  body: string;
  variables: string[];
  senderId?: string | null;
}

export interface CreateTemplateInput {
  name: string;
  body: string;
  senderId?: string;
  dltTemplateId?: string;
  smsType?: string;
}

export interface SendSmsPayload {
  templateId: string;
  mobile: string;
  variables?: Record<string, string>;
  body?: string;
  sender?: string;
}

export interface BulkRecipientItem {
  mobile: string;
  variables?: Record<string, string>;
  name?: string;
}

export interface SendBulkSmsPayload {
  templateId: string;
  recipients: BulkRecipientItem[];
  shortUrl?: boolean;
}

export interface SmsDeliveryReport {
  requestId: string;
  mobile: string;
  status: 'delivered' | 'failed' | 'rejected' | null;
  at?: string | null;
  detail?: string | null;
}

export interface SmsProvider {
  readonly key: string;
  readonly name: string;
  readonly fields: SmsFieldDefinition[];

  validateCredentials(credentials: SmsCredentials): Promise<{ ok: boolean; message?: string }>;
  getTemplate(credentials: SmsCredentials, templateId: string): Promise<SmsTemplateDetails>;
  createTemplate?(credentials: SmsCredentials, input: CreateTemplateInput): Promise<SmsTemplateDetails>;
  send(credentials: SmsCredentials, payload: SendSmsPayload): Promise<{ requestId: string }>;
  sendBulk(credentials: SmsCredentials, payload: SendBulkSmsPayload): Promise<{ requestId: string }>;
  fetchStatuses(credentials: SmsCredentials): Promise<SmsDeliveryReport[]>;
}

