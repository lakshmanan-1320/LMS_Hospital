import {
  Controller,
  Post,
  Get,
  Param,
  Req,
  Res,
  Query,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AnyPermissions } from '../common/decorators/any-permissions.decorator';
import { MediaService } from './media.service';
import { curriculumUploadOptions } from './upload.config';
import { CurriculumGuard } from './curriculum.guard';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.TEACHING)
@Controller('curriculum')
@UseGuards(CurriculumGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('courses/:courseId/media')
  @Permissions('media:upload')
  @UseInterceptors(FileInterceptor('file', curriculumUploadOptions))
  async uploadMedia(
    @Param('courseId', new ParseUUIDPipe({ version: '4' }))
    courseId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const asset = await this.mediaService.upload(
      file,
      courseId,
      req.user.userId,
      req.user.roles ?? [],
    );

    return {
      message: 'Media uploaded successfully',
      asset,
    };
  }

  @Get('courses/:courseId/media')
  @AnyPermissions('courses:view_own', 'courses:manage')
  async listCourseMedia(
    @Param('courseId', new ParseUUIDPipe({ version: '4' }))
    courseId: string,
    @Query('type') assetType: string | undefined,
    @Req() req: any,
  ) {
    const assets = await this.mediaService.listCourseAssets(
      courseId,
      req.user.userId,
      req.user.roles ?? [],
      assetType,
    );

    return {
      success: true,
      data: assets,
    };
  }

  @Get('media/:assetId')
  @AnyPermissions('courses:view_own', 'courses:manage')
  async getMedia(
    @Param('assetId', new ParseUUIDPipe({ version: '4' }))
    assetId: string,
    @Req() req: any,
  ) {
    const asset = await this.mediaService.getAsset(
      assetId,
      req.user.userId,
      req.user.roles ?? [],
    );

    return {
      success: true,
      data: asset,
    };
  }

  @Get('media/:assetId/thumbnail')
  @AnyPermissions('courses:view_own', 'courses:manage', 'courses:read')
  async getMediaThumbnail(
    @Param('assetId', new ParseUUIDPipe({ version: '4' }))
    assetId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const thumb = await this.mediaService.getThumbnailStream(
      assetId,
      req.user.userId,
      req.user.roles ?? [],
    );

    res.setHeader('Content-Type', thumb.contentType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    thumb.stream.pipe(res);
  }

  @Post('media/:assetId/retry')
  @AnyPermissions('courses:edit_own', 'courses:manage')
  async retryMediaProcessing(
    @Param('assetId', new ParseUUIDPipe({ version: '4' }))
    assetId: string,
    @Req() req: any,
  ) {
    return this.mediaService.retryProcessing(
      assetId,
      req.user.userId,
      req.user.roles ?? [],
    );
  }
}
