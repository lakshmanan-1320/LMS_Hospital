
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { DatabaseService } from '../../database/database.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    const token =
      request.cookies?.['accessToken'] ||
      (authHeader?.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null);

    if (!token) {
      throw new UnauthorizedException(
        'Missing or invalid authentication token',
      );
    }

    let payload: JwtPayload;

    try {
      const secret = this.configService.get<string>(
        'auth.jwtAccessSecret',
      );

      payload = await this.jwtService.verifyAsync<JwtPayload>(
        token,
        { secret },
      );
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired access token',
      );
    }

    const targetUserId = payload.userId || payload.sub;

    if (!targetUserId) {
      throw new UnauthorizedException('Invalid authentication payload');
    }

    // Verify that the account exists, is active, and fetch live dynamic roles & permissions.
    const userResult = await this.databaseService.query(
      `
        SELECT
          u.user_id,
          u.is_active,
          u.deleted_at,
          ARRAY_AGG(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) AS db_roles,
          ARRAY_AGG(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL) AS db_permissions
        FROM users u
        LEFT JOIN user_roles ur ON u.user_id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.role_id
        LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.permission_id
        WHERE u.user_id = $1
        GROUP BY u.user_id, u.is_active, u.deleted_at;
      `,
      [targetUserId],
    );

    if (userResult.rows.length === 0) {
      throw new UnauthorizedException('User account no longer exists');
    }

    const user = userResult.rows[0];

    if (user.deleted_at !== null) {
      throw new UnauthorizedException('User account no longer exists');
    }

    if (!user.is_active) {
      throw new ForbiddenException(
        'User account has been deactivated or suspended',
      );
    }

    // Always the database's current roles/permissions, even when empty: a role whose
    // permissions were all removed must not fall back to the (stale) token claims.
    const liveRoles: string[] = Array.isArray(user.db_roles) ? user.db_roles : [];
    const livePermissions: string[] = Array.isArray(user.db_permissions) ? user.db_permissions : [];

    request.user = {
      userId: user.user_id,
      email: payload.email,
      roles: liveRoles,
      permissions: livePermissions,
    };

    return true;
  }
}
