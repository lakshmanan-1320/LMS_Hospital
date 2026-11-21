import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { Public } from '../common/decorators/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { QueryCourseReviewsDto } from './dto/query-course-reviews.dto';

@RequireModule(MODULE_KEYS.REVIEWS_RATINGS)
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * 1. GET /courses/:courseIdOrSlug/reviews/summary
   * Public: Average rating, total count, and 1-5 star breakdown.
   */
  @Get('courses/:courseIdOrSlug/reviews/summary')
  @Public()
  async getCourseReviewSummary(
    @Param('courseIdOrSlug') courseIdOrSlug: string,
  ) {
    const summary = await this.reviewsService.getCourseReviewSummary(courseIdOrSlug);
    return {
      success: true,
      data: summary,
    };
  }

  /**
   * 2. GET /courses/:courseIdOrSlug/reviews
   * Public: Paginated list of published reviews for course detail page.
   */
  @Get('courses/:courseIdOrSlug/reviews')
  @Public()
  async getCourseReviews(
    @Param('courseIdOrSlug') courseIdOrSlug: string,
    @Query() query: QueryCourseReviewsDto,
    @Req() req: any,
  ) {
    const currentUserId = req.user?.userId;
    const result = await this.reviewsService.getCourseReviews(
      courseIdOrSlug,
      query,
      currentUserId,
    );
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 3. GET /courses/:courseIdOrSlug/reviews/my-review
   * Student: Fetch current caller's own review for this course (null if none).
   */
  @Get('courses/:courseIdOrSlug/reviews/my-review')
  async getMyReview(
    @Param('courseIdOrSlug') courseIdOrSlug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const myReview = await this.reviewsService.getMyReviewForCourse(
      courseIdOrSlug,
      user,
    );
    return {
      success: true,
      data: myReview,
    };
  }

  /**
   * 4. POST /courses/:courseIdOrSlug/reviews
   * Student: Submit rating and review. Must be enrolled & accessed course.
   */
  @Post('courses/:courseIdOrSlug/reviews')
  @Permissions('reviews:create')
  @HttpCode(HttpStatus.CREATED)
  async submitReview(
    @Param('courseIdOrSlug') courseIdOrSlug: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const review = await this.reviewsService.submitReview(
      courseIdOrSlug,
      dto,
      user,
    );
    return {
      success: true,
      message: 'Review submitted successfully.',
      data: review,
    };
  }

  /**
   * 5. PATCH /reviews/:reviewId
   * Student: Edit own review.
   */
  @Patch('reviews/:reviewId')
  @Permissions('reviews:create')
  async updateOwnReview(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updated = await this.reviewsService.updateOwnReview(
      reviewId,
      dto,
      user,
    );
    return {
      success: true,
      message: 'Review updated successfully.',
      data: updated,
    };
  }

  /**
   * 6. DELETE /reviews/:reviewId
   * Student: Delete own review.
   */
  @Delete('reviews/:reviewId')
  async deleteOwnReview(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.reviewsService.deleteReview(reviewId, user);
    return result;
  }
}
