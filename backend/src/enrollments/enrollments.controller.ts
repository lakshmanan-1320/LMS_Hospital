
import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';

import { EnrollmentsService } from './enrollments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AnyPermissions } from '../common/decorators/any-permissions.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.ENROLLMENTS)
@Controller('enrollments')
export class EnrollmentsController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  // ==========================================
  // ADMIN ENROLLMENT MANAGEMENT ROUTES
  // (Declared before :courseId to avoid collision)
  // ==========================================

  @Get('admin/stats')
  @AnyPermissions('courses:manage', 'users:manage')
  async getAdminStats(@CurrentUser() user: AuthenticatedUser) {
    return this.enrollmentsService.getAdminStats(user);
  }

  @Get('admin')
  @AnyPermissions('courses:manage', 'users:manage')
  async getAdminEnrollments(
    @Query('search') search?: string,
    @Query('courseId') courseId?: string,
    @Query('instructorId') instructorId?: string,
    @Query('status') status?: string,
    @Query('completionStatus') completionStatus?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.enrollmentsService.getAdminEnrollments(
      { search, courseId, instructorId, status, completionStatus, page, limit },
      user!,
    );
  }

  @Get('admin/students')
  @AnyPermissions('courses:manage', 'users:manage')
  async listStudentsForDropdown(
    @Query('search') search?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.enrollmentsService.listStudentsForDropdown(search, user!);
  }

  @Get('admin/courses')
  @AnyPermissions('courses:manage', 'users:manage')
  async listCoursesForDropdown(@CurrentUser() user?: AuthenticatedUser) {
    return this.enrollmentsService.listCoursesForDropdown(user!);
  }

  @Post('admin/manual-enroll')
  @AnyPermissions('courses:manage', 'users:manage')
  async manualEnroll(
    @Body('studentId') studentId: string,
    @Body('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enrollmentsService.manualEnrollStudent(studentId, courseId, user);
  }

  @Patch('admin/:enrollmentId/status')
  @AnyPermissions('courses:manage', 'users:manage')
  async updateEnrollmentStatus(
    @Param('enrollmentId', new ParseUUIDPipe({ version: '4' })) enrollmentId: string,
    @Body('status') status: string,
    @Body('reason') reason: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enrollmentsService.updateEnrollmentStatus(enrollmentId, status, reason, user);
  }

  @Get('admin/:enrollmentId')
  @AnyPermissions('courses:manage', 'users:manage')
  async getAdminEnrollmentDetails(
    @Param('enrollmentId', new ParseUUIDPipe({ version: '4' })) enrollmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enrollmentsService.getAdminEnrollmentDetails(enrollmentId, user);
  }

  // ==========================================
  // STUDENT ENROLLMENT ROUTES
  // ==========================================

  /**
   * Enroll in a free course.
   * POST /enrollments/:courseId
   */
  @Post(':courseId')
  async enrollInFreeCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enrollmentsService.enrollInFreeCourse(
      courseId,
      user,
    );
  }

  /**
   * Get the authenticated student's enrolled courses.
   * GET /enrollments/my
   */
  @Get('my')
  async getMyEnrollments(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enrollmentsService.getMyEnrollments(user);
  }

  /**
   * Check enrollment status.
   * GET /enrollments/:courseId/status
   */
  @Get(':courseId/status')
  async getEnrollmentStatus(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enrollmentsService.getEnrollmentStatus(
      courseId,
      user,
    );
  }
}
