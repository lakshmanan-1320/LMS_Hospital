export interface RoleWithPermissions {
  role_id: string;
  name: string;
  description: string | null;
  permissions: string[];
  active_users: number;
}

export interface PermissionEntity {
  permission_id: string;
  code: string;
  description: string | null;
  module_key: string | null;
  module_name: string | null;
}
