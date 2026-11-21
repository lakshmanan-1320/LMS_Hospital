
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class CurriculumGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !Array.isArray(user.roles)) {
      throw new ForbiddenException('User has no assigned roles');
    }

    if (user.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException(
        'Super Admin does not have Curriculum access',
      );
    }

    const allowed = user.roles.some((role: string) =>
      ['ADMIN', 'INSTRUCTOR'].includes(role),
    );

    if (!allowed) {
      throw new ForbiddenException('Curriculum access denied');
    }

    return true;
  }
}
