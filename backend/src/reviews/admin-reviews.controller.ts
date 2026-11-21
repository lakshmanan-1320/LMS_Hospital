import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
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
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { QueryAdminReviewsDto } from './dto/query-admin-reviews.dto';

@RequireModule(MODULE_KEYS.REVIEWS_RATINGS)
@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, PermissionsGuard)
// Dynamic: whoever holds reviews:moderate (Roles & Permissions) and can see the module (Module Management).
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * 1. GET /admin/reviews
   * Admin: List all platform reviews with moderation filters.
   */
  @Get()
  @Permissions('reviews:moderate')
  async getAdminReviews(@Query() query: QueryAdminReviewsDto) {
    const result = await this.reviewsService.getAdminReviews(query);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 2. PATCH /admin/reviews/:reviewId/moderate
   * Admin: Hide, restore, or flag a review with a reason.
   */
  @Patch(':reviewId/moderate')
  @Permissions('reviews:moderate')
  async moderateReview(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const moderated = await this.reviewsService.moderateReview(
      reviewId,
      dto,
      user,
    );
    return {
      success: true,
      message: `Review marked as ${dto.status} successfully.`,
      data: moderated,
    };
  }

  /**
   * 3. DELETE /admin/reviews/:reviewId
   * Admin: Permanently remove an inappropriate review.
   */
  @Delete(':reviewId')
  @Permissions('reviews:moderate')
  async removeReview(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.reviewsService.adminRemoveReview(reviewId, user);
    return result;
  }
}
