import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';

import { CurriculumController } from './curriculum.controller';
import { MediaController } from './media.controller';
import { ResourcesController } from './resources.controller';
import { ReplacementRequestController } from './replacement-request.controller';

import { CurriculumService } from './curriculum.service';
import { MediaService } from './media.service';
import { ResourcesService } from './resources.service';
import { ReplacementRequestService } from './replacement-request.service';

import { CurriculumRepository } from './curriculum.repository';
import { MediaRepository } from './media.repository';
import { ResourcesRepository } from './resources.repository';
import { ReplacementRequestRepository } from './replacement-request.repository';

import { CurriculumGuard } from './curriculum.guard';
import { StorageModule } from '../providers/storage/storage.module';
import { VideoProcessorService } from './video-processor.service';

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [
    CurriculumController,
    MediaController,
    ResourcesController,
    ReplacementRequestController,
  ],
  providers: [
    CurriculumService,
    MediaService,
    ResourcesService,
    ReplacementRequestService,
    VideoProcessorService,
    CurriculumRepository,
    MediaRepository,
    ResourcesRepository,
    ReplacementRequestRepository,
    CurriculumGuard,
  ],
  exports: [
    CurriculumService,
    MediaService,
    ResourcesService,
    ReplacementRequestService,
    VideoProcessorService,
  ],
})
export class CurriculumModule {}
