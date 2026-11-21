export type WebinarStatus = 'draft' | 'published' | 'scheduled' | 'live' | 'completed' | 'cancelled';
export type WebinarProviderType = 'google_meet' | 'zoom' | 'zoho';
export type WebinarHostRole = 'primary_host' | 'co_host' | 'moderator';
export type RegistrationStatus = 'confirmed' | 'cancelled';
export type DeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface WebinarEntity {
  webinar_id: string;
  title: string;
  slug: string;
  description?: string | null;
  short_description?: string | null;
  cover_image_url?: string | null;
  provider: WebinarProviderType;
  provider_session_id?: string | null;
  provider_metadata: Record<string, any>;
  meeting_link?: string | null;
  host_join_url?: string | null;
  passcode?: string | null;
  start_time: Date;
  end_time: Date;
  timezone: string;
  max_participants: number;
  status: WebinarStatus;
  is_public_registration: boolean;
  custom_registration_fields: Array<{
    id: string;
    label: string;
    type: 'text' | 'number' | 'dropdown' | 'checkbox';
    required: boolean;
    options?: string[];
  }>;
  cancellation_reason?: string | null;
  cancelled_at?: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface WebinarHostEntity {
  webinar_host_id: string;
  webinar_id: string;
  user_id: string;
  host_role: WebinarHostRole;
  display_order: number;
  created_at: Date;
  // Joined fields from users table
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar_url?: string;
  headline?: string;
}

export interface WebinarRegistrationEntity {
  webinar_registration_id: string;
  webinar_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  custom_field_responses: Record<string, any>;
  status: RegistrationStatus;
  join_token_hash: string;
  join_token_expires_at: Date;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  referrer?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  confirmation_sent_at?: Date | null;
  confirmation_delivery_status: DeliveryStatus;
  confirmation_error_message?: string | null;
  resend_count: number;
  provider_registrant_id?: string | null;
  /** Personal provider join link (credential): never expose in listing APIs. */
  provider_join_url?: string | null;
  provider_sync_status?: ProviderSyncStatus;
  provider_sync_error?: string | null;
  provider_sync_attempts?: number;
  provider_synced_at?: Date | null;
  cancellation_reason?: string | null;
  cancelled_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type ProviderSyncStatus = 'pending' | 'synced' | 'failed';

export interface WebinarAttendanceEntity {
  webinar_attendance_id: string;
  webinar_id: string;
  webinar_registration_id: string;
  email: string;
  display_name: string;
  joined_at: Date;
  left_at?: Date | null;
  duration_seconds: number;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: Date;
}

export interface WebinarAuditLogEntity {
  webinar_audit_log_id: string;
  webinar_id?: string | null;
  actor_id?: string | null;
  actor_role?: string | null;
  action: string;
  details: Record<string, any>;
  ip_address?: string | null;
  created_at: Date;
}

