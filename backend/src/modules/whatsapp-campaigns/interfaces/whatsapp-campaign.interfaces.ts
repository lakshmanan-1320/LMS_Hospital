export type WhatsappConfigStatus = 'draft' | 'validated' | 'active' | 'error';
export type WhatsappTemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
export type WhatsappTemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED';
export type WhatsappOutboxStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'REJECTED';

export interface WhatsappConfigRecord {
  config_id: string;
  app_id: string;
  app_secret_encrypted: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  business_name: string | null;
  access_token_encrypted: string;
  webhook_verify_token_encrypted: string | null;
  graph_version: string;
  redirect_to: string | null;
  status: WhatsappConfigStatus;
  last_validated_at: Date | null;
  last_error: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WhatsappTemplateRecord {
  template_id: string;
  meta_template_id: string;
  name: string;
  language: string;
  category: WhatsappTemplateCategory;
  status: WhatsappTemplateStatus;
  body_text: string;
  components: any[];
  variables: string[];
  rejected_reason: string | null;
  is_active: boolean;
  synced_at: Date;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WhatsappOutboxRecord {
  outbox_id: string;
  campaign_id: string | null;
  template_id: string | null;
  recipient_phone: string;
  recipient_name: string | null;
  rendered_body: string;
  parameters: any[];
  status: WhatsappOutboxStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: Date;
  meta_message_id: string | null;
  error_message: string | null;
  error_details: any;
  sent_at: Date | null;
  delivered_at: Date | null;
  read_at: Date | null;
  created_at: Date;
}

