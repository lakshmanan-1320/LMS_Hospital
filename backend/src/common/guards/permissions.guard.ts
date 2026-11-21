import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ANY_PERMISSIONS_KEY } from '../decorators/any-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const anyPermissions = this.reflector.getAllAndOverride<string[]>(
      ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If neither @Permissions nor @AnyPermissions are present on route or class, allow
    if (
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!anyPermissions || anyPermissions.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.permissions) {
      throw new ForbiddenException('User has no granted permissions');
    }

    // No blanket SUPER_ADMIN pass: Super Admin holds only governance permissions (migration 024).

    // 1. Check all-required permissions (@Permissions)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAll = requiredPermissions.every((perm) =>
        user.permissions.includes(perm),
      );

      if (!hasAll) {
        throw new ForbiddenException(
          `Access denied. Required permissions: [${requiredPermissions.join(', ')}]`,
        );
      }
    }

    // 2. Check any-required permissions (@AnyPermissions)
    if (anyPermissions && anyPermissions.length > 0) {
      const hasAny = anyPermissions.some((perm) =>
        user.permissions.includes(perm),
      );

      if (!hasAny) {
        throw new ForbiddenException(
          `Access denied. Requires at least one permission from: [${anyPermissions.join(', ')}]`,
        );
      }
    }

    return true;
  }
}

