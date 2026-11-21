import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class WebinarAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.roles) {
      throw new UnauthorizedException('Authentication required');
    }

    // Explicit Rule: SUPER_ADMIN cannot manage webinars (403 block)
    if (user.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException(
        'SUPER_ADMIN does not have webinar creation or management privileges',
      );
    }

    // Explicit Rule: ADMIN alone can manage webinars
    if (!user.roles.includes('ADMIN')) {
      throw new ForbiddenException(
        'Access denied. Only ADMIN accounts can manage webinars',
      );
    }

    return true;
  }
}

