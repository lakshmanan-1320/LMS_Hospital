
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CurriculumRepository } from './curriculum.repository';
import { CurriculumService } from './curriculum.service';
import { ResourcesRepository } from './resources.repository';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly curriculumRepository: CurriculumRepository,
    private readonly curriculumService: CurriculumService,
    private readonly resourcesRepository: ResourcesRepository,
  ) {}

  async attach(
    lessonId: string,
    assetId: string,
    title: string,
    userId: string,
    roles: string[],
    sortOrder = 0,
  ) {
    const lesson = await this.curriculumRepository.findLesson(lessonId);

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    await this.curriculumService.verifyCourseAccess(
      lesson.course_id,
      userId,
      roles,
      true,
    );

    const resource = await this.resourcesRepository.attach(
  lessonId,
  lesson.course_id,
  assetId,
  title,
  sortOrder,
);

    if (!resource) {
      throw new BadRequestException(
        'Asset not found, inactive, or not eligible as a lesson resource',
      );
    }

    return resource;
  }

  async list(
    lessonId: string,
    userId: string,
    roles: string[],
  ) {
    const lesson = await this.curriculumRepository.findLesson(lessonId);

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    await this.curriculumService.verifyCourseAccess(
      lesson.course_id,
      userId,
      roles,
    );

    return this.resourcesRepository.list(lessonId);
  }

  async remove(
    resourceId: string,
    lessonId: string,
    userId: string,
    roles: string[],
  ) {
    const lesson = await this.curriculumRepository.findLesson(lessonId);

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    await this.curriculumService.verifyCourseAccess(
      lesson.course_id,
      userId,
      roles,
      true,
    );

    const removed = await this.resourcesRepository.remove(resourceId, lessonId);

    if (!removed) {
      throw new NotFoundException('Resource not found');
    }

    return { message: 'Lesson resource removed successfully' };
  }
}
