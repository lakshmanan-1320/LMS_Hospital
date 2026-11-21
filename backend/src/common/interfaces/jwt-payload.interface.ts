export interface JwtPayload {
  sub: string; // User ID (UUID)
  userId: string; // Explicit meaningful User ID
  email: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}
