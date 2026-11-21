
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';

import { AnyPermissions } from '../common/decorators/any-permissions.decorator';
import { CurriculumService } from './curriculum.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CurriculumGuard } from './curriculum.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.TEACHING)
@Controller('curriculum')
@UseGuards(CurriculumGuard)
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

  private getUser(req: any) {
    return {
      userId: req.user.userId,
      roles: req.user.roles ?? [],
    };
  }
  @AnyPermissions('courses:view_own', 'courses:manage')
  @Get('courses')
  async listCourses(@Req() req: any) {
  const user = this.getUser(req);

  return this.curriculumService.listCourses(
    user.userId,
    user.roles,
  );
}
  @AnyPermissions('courses:view_own', 'courses:manage')
  @Get('courses/:courseId')
  async getCurriculum(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return this.curriculumService.getCurriculum(
      courseId,
      user.userId,
      user.roles,
    );
  }

  @AnyPermissions('courses:edit_own', 'courses:manage')
  @Post('courses/:courseId/sections')
  async createSection(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Body() dto: CreateSectionDto,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return this.curriculumService.createSection(
      courseId,
      user.userId,
      user.roles,
      dto,
    );
  }

  @AnyPermissions('courses:edit_own', 'courses:manage')
  @Put('sections/:sectionId')
  async updateSection(
    @Param('sectionId', new ParseUUIDPipe({ version: '4' })) sectionId: string,
    @Body() dto: UpdateSectionDto,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return this.curriculumService.updateSection(
      sectionId,
      user.userId,
      user.roles,
      dto,
    );
  }

  @AnyPermissions('courses:edit_own', 'courses:manage')
  @Delete('sections/:sectionId')
  @HttpCode(HttpStatus.OK)
  async deleteSection(
    @Param('sectionId', new ParseUUIDPipe({ version: '4' })) sectionId: string,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return this.curriculumService.deleteSection(
      sectionId,
      user.userId,
      user.roles,
    );
  }

  @AnyPermissions('courses:edit_own', 'courses:manage')
  @Post('sections/:sectionId/lessons')
  async createLesson(
    @Param('sectionId', new ParseUUIDPipe({ version: '4' })) sectionId: string,
    @Body() dto: CreateLessonDto,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return this.curriculumService.createLesson(
      sectionId,
      user.userId,
      user.roles,
      dto,
    );
  }

  @AnyPermissions('courses:edit_own', 'courses:manage')
  @Put('lessons/:lessonId')
  async updateLesson(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' })) lessonId: string,
    @Body() dto: UpdateLessonDto,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return this.curriculumService.updateLesson(
      lessonId,
      user.userId,
      user.roles,
      dto,
    );
  }

  @AnyPermissions('courses:edit_own', 'courses:manage')
  @Delete('lessons/:lessonId')
  @HttpCode(HttpStatus.OK)
  async deleteLesson(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' })) lessonId: string,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return this.curriculumService.deleteLesson(
      lessonId,
      user.userId,
      user.roles,
    );
  }

  @AnyPermissions('courses:edit_own', 'courses:manage')
  @Post('courses/:courseId/sections/reorder')
  async reorderSections(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Body('sectionIds') sectionIds: string[],
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return this.curriculumService.reorderSections(
      courseId,
      user.userId,
      user.roles,
      sectionIds || [],
    );
  }

  @AnyPermissions('courses:edit_own', 'courses:manage')
  @Post('sections/:sectionId/lessons/reorder')
  async reorderLessons(
    @Param('sectionId', new ParseUUIDPipe({ version: '4' })) sectionId: string,
    @Body('lessonIds') lessonIds: string[],
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return this.curriculumService.reorderLessons(
      sectionId,
      user.userId,
      user.roles,
      lessonIds || [],
    );
  }
}
