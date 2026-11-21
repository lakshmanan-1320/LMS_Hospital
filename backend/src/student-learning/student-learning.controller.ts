import {
  Controller,
  Get,
  Head,
  Put,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { StudentLearningService } from './student-learning.service';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.LEARNING)
@Controller('student-learning')
export class StudentLearningController {
  constructor(
    private readonly studentLearningService: StudentLearningService,
  ) {}

  @Public()
  @Get('public/courses/:idOrSlug')
  getPublicCourseDetails(
    @Param('idOrSlug') idOrSlug: string,
  ) {
    return this.studentLearningService.getPublicCourseDetails(idOrSlug);
  }

  @Get('courses/:idOrSlug')
  getCourseDetails(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentLearningService.getCourseDetails(idOrSlug, user);
  }

  @Get('courses/:idOrSlug/progress')
  getCourseProgress(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentLearningService.getCourseProgressSummary(idOrSlug, user);
  }

  @Get('lessons/:lessonId')
  getLessonForLearning(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' }))
    lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentLearningService.getLessonForLearning(
      lessonId,
      user,
    );
  }

  /**
   * Guest preview of a lesson marked as a free preview (course landing page "Preview").
   * HEAD/GET /student-learning/public/lessons/:lessonId/media
   */
  @Public()
  @Head('public/lessons/:lessonId/media')
  async getPreviewLessonMediaHeaders(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' }))
    lessonId: string,
    @Res() res: Response,
  ) {
    const meta = await this.studentLearningService.getPreviewLessonMediaMetadata(lessonId);
    res.setHeader('Content-Type', meta.mimeType);
    res.setHeader('Content-Length', meta.fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(HttpStatus.OK).end();
  }

  @Public()
  @Get('public/lessons/:lessonId/media')
  async streamPreviewLessonMedia(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' }))
    lessonId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { stream, mimeType, fileSize, range } = await this.studentLearningService.getPreviewLessonMediaStream(
      lessonId,
      req.headers.range,
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (range) {
      res.status(206);
      res.setHeader('Content-Length', range.end - range.start + 1);
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${fileSize}`);
    } else {
      res.status(200);
      res.setHeader('Content-Length', fileSize);
    }
    stream.on('error', (error) => {
      if (!res.headersSent) res.status(500).end();
      else res.destroy(error);
    });
    stream.pipe(res);
  }

  @Head('lessons/:lessonId/media')
  async getLessonMediaHeaders(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' }))
    lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const meta = await this.studentLearningService.getLessonMediaMetadata(
      lessonId,
      user,
    );

    res.setHeader('Content-Type', meta.mimeType);
    res.setHeader('Content-Length', meta.fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(HttpStatus.OK).end();
  }

  @Get('lessons/:lessonId/media')
  async streamLessonMedia(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' }))
    lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const media = await this.studentLearningService.getLessonMediaStream(
      lessonId,
      user,
      req.headers.range,
    );

    const { stream, mimeType, fileSize, range } = media;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (range) {
      const contentLength = range.end - range.start + 1;

      res.status(206);
      res.setHeader('Content-Length', contentLength);
      res.setHeader(
        'Content-Range',
        `bytes ${range.start}-${range.end}/${fileSize}`,
      );
    } else {
      res.status(200);
      res.setHeader('Content-Length', fileSize);
    }

    stream.on('error', (error) => {
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(error);
      }
    });

    stream.pipe(res);
  }

  @Get('lessons/:lessonId/hls/:file')
  async streamLessonHls(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' }))
    lessonId: string,
    @Param('file') fileName: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const hls = await this.studentLearningService.getLessonHlsFile(
      lessonId,
      fileName,
      user,
    );

    res.setHeader('Content-Type', hls.contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    hls.stream.pipe(res);
  }

  @Get('activity')
  async getStudentActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    return this.studentLearningService.getStudentActivity(user, days);
  }

  @Get('lessons/:lessonId/resources')
  async getLessonResources(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' }))
    lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentLearningService.getLessonResources(lessonId, user);
  }

  @Get('lessons/:lessonId/resources/:resourceId/download')
  async downloadLessonResource(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' }))
    lessonId: string,
    @Param('resourceId', new ParseUUIDPipe({ version: '4' }))
    resourceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const resource = await this.studentLearningService.downloadLessonResource(
      lessonId,
      resourceId,
      user,
    );

    res.setHeader('Content-Type', resource.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(resource.fileName)}"`,
    );
    if (resource.fileSizeBytes > 0) {
      res.setHeader('Content-Length', resource.fileSizeBytes);
    }
    res.setHeader('Cache-Control', 'private, no-store');

    resource.stream.on('error', (error) => {
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(error);
      }
    });

    resource.stream.pipe(res);
  }

  @Put('lessons/:lessonId/progress')
  async saveProgress(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' }))
    lessonId: string,
    @Body() dto: UpdateProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentLearningService.saveLessonProgress(
      lessonId,
      user,
      dto.positionSeconds,
      dto.durationSeconds,
      dto.sessionId,
    );
  }

  @Post('lessons/:lessonId/complete')
  async completeLesson(
    @Param('lessonId', new ParseUUIDPipe({ version: '4' }))
    lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentLearningService.completeLesson(
      lessonId,
      user,
    );
  }
}
