import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ReviewsController } from './reviews.controller';
import { InstructorReviewsController } from './instructor-reviews.controller';
import { AdminReviewsController } from './admin-reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './reviews.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [
    ReviewsController,
    InstructorReviewsController,
    AdminReviewsController,
  ],
  providers: [ReviewsService, ReviewsRepository],
  exports: [ReviewsService, ReviewsRepository],
})
export class ReviewsModule {}
