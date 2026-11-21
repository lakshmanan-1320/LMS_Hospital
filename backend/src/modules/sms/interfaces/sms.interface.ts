export type SmsConfigStatus = 'draft' | 'validated' | 'active' | 'suspended' | 'error';
export type CampaignStatus = 'draft' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type SmsOutboxStatus = 'PENDING' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'REJECTED';

export interface TemplateVariable {
  key: string;
  label: string;
  mapTo?: string; // e.g. 'recipient.name', 'webinar.title', 'webinar.meeting_link', 'webinar.start_time'
  defaultValue?: string;
}

export interface SmsConfigEntity {
  config_id: string;
  provider_key: string;
  credentials_encrypted: string;
  sender_id: string;
  dlt_entity_id?: string | null;
  default_country_code: string;
  status: SmsConfigStatus;
  last_validated_at?: Date | null;
  last_error?: string | null;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SmsTemplateEntity {
  template_id: string;
  provider_template_id: string;
  dlt_template_id?: string | null;
  name: string;
  category: string;
  body: string;
  variables: TemplateVariable[];
  is_active: boolean;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CampaignEntity {
  campaign_id: string;
  name: string;
  channel: 'sms' | 'email';
  template_id: string;
  target_type: 'webinar_registrants' | 'course_students' | 'all_users' | 'custom_list';
  target_id?: string | null;
  status: CampaignStatus;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  metadata?: Record<string, any>;
  scheduled_at?: Date | null;
  started_at?: Date | null;
  completed_at?: Date | null;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SmsOutboxEntity {
  outbox_id: string;
  campaign_id?: string | null;
  template_id?: string | null;
  recipient_phone: string;
  recipient_name?: string | null;
  rendered_body: string;
  variables: Record<string, any>;
  status: SmsOutboxStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: Date;
  provider_key: string;
  provider_request_id?: string | null;
  error_message?: string | null;
  sent_at?: Date | null;
  delivered_at?: Date | null;
  created_at: Date;
}

