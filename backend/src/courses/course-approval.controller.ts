import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CourseApprovalService } from './course-approval.service';
import { QueryApprovalDto } from './dto/query-approval.dto';
import { RejectCourseDto } from './dto/reject-course.dto';
import { StatusNoteDto } from './dto/status-note.dto';
import { FeaturedDto } from './dto/featured.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AnyPermissions } from '../common/decorators/any-permissions.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.TEACHING)
@Controller('course-approval')
export class CourseApprovalController {
  constructor(private readonly approvalService: CourseApprovalService) {}

  /**
   * 1. GET APPROVAL QUEUE
   * Requires: courses:approve
   * Note: Fixed route declared before dynamic :courseId routes.
   */
  @Get('queue')
  @Permissions('courses:approve')
  async getQueue(@Query() query: QueryApprovalDto) {
    return this.approvalService.getQueue(query);
  }

  /**
   * 2. GET APPROVAL STATS
   * Requires: courses:approve
   * Note: Fixed route declared before dynamic :courseId routes.
   */
  @Get('stats')
  @Permissions('courses:approve')
  async getStats() {
    return this.approvalService.getStats();
  }

  /**
   * 3. GET COURSE REVIEW DETAIL
   * Requires: courses:approve
   */
  @Get(':courseId/review')
  @Permissions('courses:approve')
  async getReviewDetail(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Req() req: any,
  ) {
    return this.approvalService.getReviewDetail(courseId, req.user);
  }

  /**
   * 4. GET COURSE STATUS HISTORY (Audit Trail)
   * Accessible by course owner or reviewers
   */
  @Get(':courseId/history')
  @AnyPermissions('courses:view_own', 'courses:approve', 'courses:manage')
  async getHistory(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Req() req: any,
  ) {
    return this.approvalService.getHistory(courseId, req.user);
  }

  /**
   * 5. SUBMIT COURSE FOR REVIEW
   * Requires: courses:edit_own
   * Allowed from: draft, rejected -> pending_review
   * Owner-only check enforced in service.
   */
  @Post(':courseId/submit')
  @Permissions('courses:edit_own')
  @HttpCode(HttpStatus.OK)
  async submitCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: StatusNoteDto,
    @Req() req: any,
  ) {
    return this.approvalService.transition(courseId, 'submit', req.user, {
      note: dto?.note,
    });
  }

  /**
   * 6. WITHDRAW SUBMITTED COURSE
   * Requires: courses:edit_own
   * Allowed from: pending_review -> draft
   * Owner-only check enforced in service.
   */
  @Post(':courseId/withdraw')
  @Permissions('courses:edit_own')
  @HttpCode(HttpStatus.OK)
  async withdrawCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: StatusNoteDto,
    @Req() req: any,
  ) {
    return this.approvalService.transition(courseId, 'withdraw', req.user, {
      note: dto?.note,
    });
  }

  /**
   * 7. APPROVE COURSE
   * Requires: courses:approve
   * Allowed from: pending_review -> approved
   * Anti-self-review constraint enforced in service.
   */
  @Post(':courseId/approve')
  @Permissions('courses:approve')
  @HttpCode(HttpStatus.OK)
  async approveCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: StatusNoteDto,
    @Req() req: any,
  ) {
    return this.approvalService.transition(courseId, 'approve', req.user, {
      note: dto?.note,
    });
  }

  /**
   * 8. REJECT COURSE
   * Requires: courses:approve
   * Allowed from: pending_review -> rejected
   * Reason required; Anti-self-review constraint enforced in service.
   */
  @Post(':courseId/reject')
  @Permissions('courses:approve')
  @HttpCode(HttpStatus.OK)
  async rejectCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: RejectCourseDto,
    @Req() req: any,
  ) {
    return this.approvalService.transition(courseId, 'reject', req.user, {
      reason: dto.reason,
    });
  }

  /**
   * 9. PUBLISH APPROVED COURSE
   * Requires: courses:publish
   * Allowed from: approved -> published
   */
  @Post(':courseId/publish')
  @Permissions('courses:publish')
  @HttpCode(HttpStatus.OK)
  async publishCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: StatusNoteDto,
    @Req() req: any,
  ) {
    return this.approvalService.transition(courseId, 'publish', req.user, {
      note: dto?.note,
    });
  }

  /**
   * 10. ARCHIVE PUBLISHED / APPROVED COURSE
   * Requires: courses:publish
   * Allowed from: published, approved -> archived
   * Resets featured status.
   */
  @Post(':courseId/archive')
  @Permissions('courses:publish')
  @HttpCode(HttpStatus.OK)
  async archiveCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: StatusNoteDto,
    @Req() req: any,
  ) {
    return this.approvalService.transition(courseId, 'archive', req.user, {
      note: dto?.note,
    });
  }

  /**
   * 11. RESTORE ARCHIVED COURSE
   * Requires: courses:publish
   * Allowed from: archived -> draft
   */
  @Post(':courseId/restore')
  @Permissions('courses:publish')
  @HttpCode(HttpStatus.OK)
  async restoreCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: StatusNoteDto,
    @Req() req: any,
  ) {
    return this.approvalService.transition(courseId, 'restore', req.user, {
      note: dto?.note,
    });
  }

  /**
   * 12. TOGGLE FEATURED STATUS
   * Requires: courses:publish
   * Only published courses can be featured.
   */
  @Patch(':courseId/featured')
  @Permissions('courses:publish')
  async setFeatured(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: FeaturedDto,
  ) {
    return this.approvalService.setFeatured(courseId, dto.isFeatured);
  }
}

