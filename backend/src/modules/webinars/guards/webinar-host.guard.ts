import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';

@Injectable()
export class WebinarHostGuard implements CanActivate {
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.roles) {
      throw new UnauthorizedException('Authentication required');
    }

    // Explicit Rule: SUPER_ADMIN cannot manage or host webinars
    if (user.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException(
        'SUPER_ADMIN does not have webinar hosting or management privileges',
      );
    }

    // ADMIN has supervisory host controls
    if (user.roles.includes('ADMIN')) {
      return true;
    }

    // For INSTRUCTOR or other roles: check if explicitly assigned in webinar_hosts
    const webinarId = request.params.webinarId || request.params.id;
    if (!webinarId) {
      throw new BadRequestException('Webinar ID parameter is required');
    }

    const hostCheck = await this.databaseService.query(
      `SELECT 1 FROM webinar_hosts wh 
       JOIN webinars w ON w.webinar_id = wh.webinar_id
       WHERE (w.webinar_id::text = $1 OR w.slug = $1) AND wh.user_id = $2`,
      [webinarId, user.userId],
    );

    if (hostCheck.rowCount === 0) {
      throw new ForbiddenException(
        'Access denied. You are not an assigned host for this webinar',
      );
    }

    return true;
  }
}
