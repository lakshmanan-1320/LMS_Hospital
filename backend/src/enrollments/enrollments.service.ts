
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';

import { EnrollmentsRepository } from './enrollments.repository';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { assertCanPurchase } from '../common/policies/purchase.policy';
import { isOperationsAdmin } from '../common/policies/operations.policy';

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly database: DatabaseService,
  ) {}

  private validateAdmin(user: AuthenticatedUser): void {
    const isAdmin = isOperationsAdmin(user) || user?.permissions?.includes('courses:manage');

    if (!isAdmin) {
      throw new ForbiddenException('Admin privileges required for this action.');
    }
  }

  private async logAudit(
    action: string,
    actorId: string,
    courseId: string | null,
    details: any,
  ) {
    try {
      await this.database.query(
        `INSERT INTO media_audit_logs (action, actor_id, course_id, details)
         VALUES ($1, $2, $3, $4)`,
        [action, actorId, courseId, JSON.stringify(details)],
      );
    } catch (err: any) {
      this.logger.warn(`Failed to write enrollment audit log: ${err.message}`);
    }
  }


  /**
   * Enroll a student in a published free course.
   */
  async enrollInFreeCourse(
    courseId: string,
    user: AuthenticatedUser,
  ) {
    assertCanPurchase(user);

    const course =
      await this.enrollmentsRepository.findEligibleFreeCourse(courseId);

    if (!course) {
      throw new NotFoundException(
        'Free course not found or not available for enrollment.',
      );
    }

    if (course.instructor_id === user.userId) {
      throw new BadRequestException('You cannot enroll in your own course.');
    }

    // Check for an existing enrollment before attempting insertion.
    const existingEnrollment =
      await this.enrollmentsRepository.findEnrollment(
        user.userId,
        courseId,
      );

    if (existingEnrollment) {
      if (
        existingEnrollment.enrollment_status === 'cancelled'
      ) {
        throw new ConflictException(
          'Your previous enrollment was cancelled. Please contact support.',
        );
      }

      return {
        success: true,
        message: 'You are already enrolled in this course.',
        alreadyEnrolled: true,
        enrollment: existingEnrollment,
      };
    }

    const enrollment =
      await this.enrollmentsRepository.createEnrollment(
        user.userId,
        courseId,
      );

    // Handle concurrent enrollment requests safely.
    if (!enrollment) {
      const concurrentEnrollment =
        await this.enrollmentsRepository.findEnrollment(
          user.userId,
          courseId,
        );

      if (concurrentEnrollment) {
        return {
          success: true,
          message: 'You are already enrolled in this course.',
          alreadyEnrolled: true,
          enrollment: concurrentEnrollment,
        };
      }

      throw new ConflictException(
        'Unable to complete enrollment. Please try again.',
      );
    }

    return {
      success: true,
      message: 'Successfully enrolled in the free course.',
      alreadyEnrolled: false,
      enrollment,
    };
  }

  /**
   * Retrieve courses enrolled by the authenticated student.
   */
  async getMyEnrollments(user: AuthenticatedUser) {
    assertCanPurchase(user);

    const enrollments =
      await this.enrollmentsRepository.findStudentEnrollments(
        user.userId,
      );

    return {
      success: true,
      total: enrollments.length,
      items: enrollments,
    };
  }

  /**
   * Check the authenticated student's enrollment status.
   */
  async getEnrollmentStatus(
    courseId: string,
    user: AuthenticatedUser,
  ) {
    assertCanPurchase(user);

    const [enrollment, isOwner] = await Promise.all([
      this.enrollmentsRepository.findEnrollment(user.userId, courseId),
      this.enrollmentsRepository.isCourseInstructor(courseId, user.userId),
    ]);

    return {
      success: true,
      isEnrolled:
        enrollment?.enrollment_status === 'active' ||
        enrollment?.enrollment_status === 'completed',
      // Udemy-style: the course's own instructor can't enroll or buy, but can open it (instructor preview).
      isOwner,
      enrollment,
    };
  }

  // --- ADMIN ENROLLMENT MANAGEMENT ---

  async getAdminStats(user: AuthenticatedUser) {
    this.validateAdmin(user);
    const stats = await this.enrollmentsRepository.getAdminStats();
    return { success: true, stats };
  }

  async getAdminEnrollments(
    filters: {
      search?: string;
      courseId?: string;
      instructorId?: string;
      status?: string;
      completionStatus?: string;
      page?: number;
      limit?: number;
    },
    user: AuthenticatedUser,
  ) {
    this.validateAdmin(user);
    const data = await this.enrollmentsRepository.findAdminEnrollments(filters);
    return { success: true, ...data };
  }

  async manualEnrollStudent(
    studentId: string,
    courseId: string,
    user: AuthenticatedUser,
  ) {
    this.validateAdmin(user);

    if (!studentId || !courseId) {
      throw new BadRequestException('Student ID and Course ID are required');
    }

    const student = await this.enrollmentsRepository.findStudentUser(studentId);
    if (!student) {
      throw new NotFoundException('Student user not found');
    }
    if (!student.is_active) {
      throw new BadRequestException('Cannot enroll an inactive student');
    }

    const course = await this.enrollmentsRepository.findCourseForManual(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (course.status !== 'published') {
      throw new BadRequestException(`Cannot enroll student in an unpublished course (status: "${course.status}")`);
    }

    const result = await this.enrollmentsRepository.manualEnroll(studentId, courseId, user.userId);
    if (result.isDuplicate) {
      throw new ConflictException('Student is already actively enrolled in this course.');
    }

    await this.logAudit(
      result.reactivated ? 'MANUAL_ENROLLMENT_REACTIVATED' : 'MANUAL_ENROLLMENT_CREATED',
      user.userId,
      courseId,
      {
        studentId,
        studentEmail: student.email,
        courseTitle: course.title,
        enrollmentId: result.enrollment.enrollment_id,
      },
    );

    return {
      success: true,
      message: result.reactivated
        ? 'Previous enrollment was successfully reactivated'
        : 'Student was successfully enrolled in the course',
      enrollment: result.enrollment,
    };
  }

  async updateEnrollmentStatus(
    enrollmentId: string,
    status: string,
    reason: string | undefined,
    user: AuthenticatedUser,
  ) {
    this.validateAdmin(user);

    const validStatuses = ['active', 'suspended', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status "${status}". Allowed: ${validStatuses.join(', ')}`);
    }

    if (status === 'cancelled' && (!reason || reason.trim().length < 5)) {
      throw new BadRequestException('A reason of at least 5 characters is required when cancelling an enrollment');
    }

    const updated = await this.enrollmentsRepository.updateEnrollmentStatus(
      enrollmentId,
      status,
      reason?.trim(),
      user.userId,
    );

    if (!updated) {
      throw new NotFoundException('Enrollment not found');
    }

    await this.logAudit(
      'ENROLLMENT_STATUS_CHANGED',
      user.userId,
      updated.course_id,
      {
        enrollmentId,
        studentId: updated.student_id,
        newStatus: status,
        reason: reason?.trim() || null,
      },
    );

    return {
      success: true,
      message: `Enrollment status updated to ${status}`,
      enrollment: updated,
    };
  }

  async getAdminEnrollmentDetails(enrollmentId: string, user: AuthenticatedUser) {
    this.validateAdmin(user);
    const details = await this.enrollmentsRepository.getAdminEnrollmentDetails(enrollmentId);
    if (!details) {
      throw new NotFoundException('Enrollment not found');
    }
    return { success: true, ...details };
  }

  async listStudentsForDropdown(search: string | undefined, user: AuthenticatedUser) {
    this.validateAdmin(user);
    const students = await this.enrollmentsRepository.listStudentsForDropdown(search);
    return { success: true, items: students };
  }

  async listCoursesForDropdown(user: AuthenticatedUser) {
    this.validateAdmin(user);
    const courses = await this.enrollmentsRepository.listCoursesForDropdown();
    return { success: true, items: courses };
  }
}
