export type ModuleGroup = 'governance' | 'public' | 'learning' | 'teaching' | 'operations';
export type ModuleLifecycleStatus = 'active' | 'coming_soon';

export interface PlatformModuleEntity {
  module_key: string;
  name: string;
  description?: string | null;
  module_group: ModuleGroup;
  lifecycle_status: ModuleLifecycleStatus;
  is_core: boolean;
  is_enabled: boolean;
  supports_public: boolean;
  public_visible: boolean;
  supported_roles: string[];
  /** Every role that uses the module (incl. core modules); informational. */
  audience_roles: string[];
  depends_on: string[];
  sort_order: number;
  /** Role name -> visible. Only roles in supported_roles appear. */
  role_visibility: Record<string, boolean>;
  updated_by?: string | null;
  updated_at: Date;
}

export interface ModuleAuditLogEntity {
  module_audit_log_id: string;
  module_key: string;
  action: string;
  previous_state: Record<string, any>;
  new_state: Record<string, any>;
  reason: string;
  actor_id?: string | null;
  actor_email?: string | null;
  ip_address?: string | null;
  created_at: Date;
}

/** Result of the module access check for one request. */
export type ModuleAccessDecision =
  | { allowed: true; mode: 'full' | 'historical_read' }
  | { allowed: false; status: 403 | 404; code: string; message: string };
