import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { StorageModule } from '../providers/storage/storage.module';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { StudentLearningController } from './student-learning.controller';
import { StudentLearningService } from './student-learning.service';
import { StudentLearningRepository } from './student-learning.repository';

@Module({
  imports: [
    DatabaseModule,
    EnrollmentsModule,
    StorageModule,
    CurriculumModule,
    CertificatesModule,
  ],
  controllers: [StudentLearningController],
  providers: [
    StudentLearningService,
    StudentLearningRepository,
  ],
  exports: [StudentLearningService],
})
export class StudentLearningModule {}
