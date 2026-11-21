import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CourseApprovalController } from './course-approval.controller';
import { CoursesService } from './courses.service';
import { CourseApprovalService } from './course-approval.service';
import { CoursesRepository } from './courses.repository';
import { CourseLandingRepository } from './course-landing.repository';
import { CourseBadgesService } from './course-badges.service';
import { CourseLandingService } from './course-landing.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CoursesController, CourseApprovalController],
  providers: [CoursesService, CourseApprovalService, CoursesRepository, CourseLandingRepository, CourseBadgesService, CourseLandingService],
  exports: [CoursesService, CourseApprovalService, CoursesRepository, CourseBadgesService],
})
export class CoursesModule {}

