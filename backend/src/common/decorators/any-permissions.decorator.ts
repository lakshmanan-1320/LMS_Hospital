import { SetMetadata } from '@nestjs/common';

export const ANY_PERMISSIONS_KEY = 'any_permissions';

/**
 * Route decorator to declare that a user requires AT LEAST ONE of the listed permissions.
 * Useful for endpoints shared between different roles (e.g., instructors managing own courses
 * and admins managing any course with courses:manage).
 */
export const AnyPermissions = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);

