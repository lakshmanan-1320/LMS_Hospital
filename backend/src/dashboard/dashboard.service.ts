import { Injectable, ForbiddenException } from '@nestjs/common';
import { DashboardRepository } from './dashboard.repository';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getOverview(user: AuthenticatedUser) {
    if (!user || !user.userId) {
      throw new ForbiddenException('Authentication required');
    }

    const roles = Array.isArray(user.roles) ? user.roles : [];
    const normalizedRoles = roles.map((r: string) => String(r).toLowerCase().replace(/-/g, '_'));

    // 1. Super Admin
    if (normalizedRoles.includes('super_admin')) {
      const data = await this.dashboardRepository.getSuperAdminOverview();
      return {
        role: 'super-admin',
        ...data,
      };
    }

    // 2. Admin
    if (normalizedRoles.includes('admin')) {
      const data = await this.dashboardRepository.getAdminOverview();
      return {
        role: 'admin',
        ...data,
      };
    }

    // 3. Instructor
    if (normalizedRoles.includes('instructor')) {
      const data = await this.dashboardRepository.getInstructorOverview(user.userId);
      return {
        role: 'instructor',
        ...data,
      };
    }

    // 4. Student (Default authenticated role)
    const data = await this.dashboardRepository.getStudentOverview(user.userId);
    return {
      role: 'student',
      ...data,
    };
  }
}
