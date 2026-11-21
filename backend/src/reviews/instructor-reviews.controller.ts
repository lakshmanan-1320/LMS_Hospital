import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';
import { ReviewsService } from './reviews.service';
import { InstructorReplyDto } from './dto/instructor-reply.dto';
import { QueryInstructorReviewsDto } from './dto/query-instructor-reviews.dto';

@RequireModule(MODULE_KEYS.REVIEWS_RATINGS)
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
// Dynamic: whoever holds reviews:reply (Roles & Permissions) and can see the module (Module Management).
export class InstructorReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * 1. GET /instructor/reviews
   * Instructor: List reviews for own courses with filtering by course and reply status.
   */
  @Get('instructor/reviews')
  @Permissions('reviews:reply')
  async getInstructorReviews(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryInstructorReviewsDto,
  ) {
    const result = await this.reviewsService.getInstructorReviews(user, query);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 2. POST /reviews/:reviewId/reply
   * Instructor: Post an official reply to a review on their course.
   */
  @Post('reviews/:reviewId/reply')
  @Permissions('reviews:reply')
  @HttpCode(HttpStatus.CREATED)
  async replyToReview(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: InstructorReplyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const reply = await this.reviewsService.replyToReview(reviewId, dto, user);
    return {
      success: true,
      message: 'Instructor reply posted successfully.',
      data: reply,
    };
  }

  /**
   * 3. PATCH /reviews/:reviewId/reply
   * Instructor: Edit existing reply.
   */
  @Patch('reviews/:reviewId/reply')
  @Permissions('reviews:reply')
  async updateInstructorReply(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: InstructorReplyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const reply = await this.reviewsService.replyToReview(reviewId, dto, user);
    return {
      success: true,
      message: 'Instructor reply updated successfully.',
      data: reply,
    };
  }

  /**
   * 4. DELETE /reviews/:reviewId/reply
   * Instructor: Delete reply.
   */
  @Delete('reviews/:reviewId/reply')
  @Permissions('reviews:reply')
  async deleteInstructorReply(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.reviewsService.deleteInstructorReply(reviewId, user);
    return result;
  }
}
