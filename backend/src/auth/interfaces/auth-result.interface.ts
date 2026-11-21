export interface RoleMetadata {
  roleId: string;
  name: string;
  displayName: string;
  slug: string;
  dashboardRoute: string;
  description?: string;
}

export interface AuthUserResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleMetadata[];
  roleNames: string[];
  permissions: string[];
  primaryDashboardRoute: string;
  primaryRoleSlug: string;
}

export interface LoginResult {
  user: AuthUserResponse;
  accessToken: string;
}
