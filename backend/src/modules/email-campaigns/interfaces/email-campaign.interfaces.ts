export type EmailEncryption = 'ssl' | 'tls' | 'none';
export type EmailConfigStatus = 'draft' | 'validated' | 'active' | 'error';
export type EmailTemplateCategory = 'announcement' | 'promotional' | 'newsletter' | 'transactional' | 'alert';
export type EmailOutboxStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
export type EmailTargetType = 'students' | 'instructors' | 'all_users' | 'custom_list';

export interface EmailConfigRecord {
  config_id: string;
  host: string;
  port: number;
  encryption: EmailEncryption;
  username: string;
  password_encrypted: string;
  from_name: string;
  from_email: string;
  redirect_to: string | null;
  status: EmailConfigStatus;
  last_validated_at: Date | null;
  last_error: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EmailTemplateRecord {
  template_id: string;
  name: string;
  subject: string;
  preview_text: string | null;
  category: EmailTemplateCategory;
  html_content: string;
  plain_text: string | null;
  variables: string[];
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EmailCampaignRecord {
  campaign_id: string;
  name: string;
  channel: 'email';
  email_template_id: string;
  target_type: EmailTargetType;
  target_id: string | null;
  status: 'draft' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  metadata: Record<string, any>;
  scheduled_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EmailOutboxRecord {
  outbox_id: string;
  campaign_id: string;
  template_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  rendered_html: string;
  variables: Record<string, any>;
  status: EmailOutboxStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: Date;
  smtp_message_id: string | null;
  error_message: string | null;
  sent_at: Date | null;
  created_at: Date;
}

export interface EmailRecipient {
  email: string;
  name?: string;
  variables?: Record<string, any>;
}

