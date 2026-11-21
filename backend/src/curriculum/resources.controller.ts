
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
    UseGuards,
} from '@nestjs/common';

import { Permissions } from '../common/decorators/permissions.decorator';
import { AnyPermissions } from '../common/decorators/any-permissions.decorator';
import { AttachResourceDto } from './dto/attach-resource.dto';
import { ResourcesService } from './resources.service';
import { CurriculumGuard } from './curriculum.guard';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.TEACHING)
@Controller('curriculum')
@UseGuards(CurriculumGuard)
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post('lessons/:lessonId/resources')
  @Permissions('media:upload')
  async attachResource(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' })) lessonId: string,
    @Body() dto: AttachResourceDto,
    @Req() req: any,
  ) {
    const resource = await this.resourcesService.attach(
      lessonId,
      dto.assetId,
      dto.title,
      req.user.userId,
      req.user.roles ?? [],
      dto.sortOrder ?? 0,
    );

    return {
      message: 'Resource attached successfully',
      resource,
    };
  }

  @AnyPermissions('courses:view_own', 'courses:manage')
  @Get('lessons/:lessonId/resources')
  async getResources(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' })) lessonId: string,
    @Req() req: any,
  ) {
    return this.resourcesService.list(
      lessonId,
      req.user.userId,
      req.user.roles ?? [],
    );
  }

  @Delete('lessons/:lessonId/resources/:resourceId')
  @Permissions('media:upload')
  @HttpCode(HttpStatus.OK)
  async removeResource(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' })) lessonId: string,
    @Param('resourceId', new ParseUUIDPipe({ version: '4' })) resourceId: string,
    @Req() req: any,
  ) {
    return this.resourcesService.remove(
      resourceId,
      lessonId,
      req.user.userId,
      req.user.roles ?? [],
    );
  }
}
