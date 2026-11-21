import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Req,
  Query,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AnyPermissions } from '../common/decorators/any-permissions.decorator';
import { CurriculumGuard } from './curriculum.guard';
import { curriculumUploadOptions } from './upload.config';
import { ReplacementRequestService } from './replacement-request.service';
import { CreateReplacementRequestDto } from './dto/create-replacement-request.dto';
import { ReviewReplacementRequestDto } from './dto/review-replacement-request.dto';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.TEACHING)
@Controller('curriculum')
@UseGuards(CurriculumGuard)
export class ReplacementRequestController {
  constructor(
    private readonly replacementService: ReplacementRequestService,
  ) {}

  @Post('courses/:courseId/lessons/:lessonId/replacement-request')
  @AnyPermissions('courses:edit_own', 'courses:manage')
  async createRequest(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Param('lessonId', new ParseUUIDPipe({ version: '4' })) lessonId: string,
    @Body() dto: CreateReplacementRequestDto,
    @Req() req: any,
  ) {
    return this.replacementService.createRequest(
      courseId,
      lessonId,
      req.user.userId,
      req.user.roles ?? [],
      dto,
    );
  }

  @Get('replacement-requests/my')
  @AnyPermissions('courses:edit_own', 'courses:view_own')
  async listMyRequests(@Req() req: any) {
    return this.replacementService.listInstructorRequests(req.user.userId);
  }

  @Get('replacement-requests/admin')
  @Permissions('courses:manage')
  async listAdminRequests(@Query('status') statusFilter?: string) {
    return this.replacementService.listAdminRequests(statusFilter);
  }

  @Get('replacement-requests/:requestId')
  @AnyPermissions('courses:edit_own', 'courses:manage')
  async getRequest(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @Req() req: any,
  ) {
    return this.replacementService.getRequest(
      requestId,
      req.user.userId,
      req.user.roles ?? [],
    );
  }

  @Patch('replacement-requests/:requestId/review')
  @Permissions('courses:manage')
  async reviewRequest(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @Body() dto: ReviewReplacementRequestDto,
    @Req() req: any,
  ) {
    return this.replacementService.reviewRequest(
      requestId,
      req.user.userId,
      dto,
    );
  }

  @Post('replacement-requests/:requestId/upload')
  @AnyPermissions('courses:edit_own', 'courses:manage')
  @UseInterceptors(FileInterceptor('file', curriculumUploadOptions))
  async uploadReplacement(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.replacementService.uploadReplacement(
      requestId,
      file,
      req.user.userId,
      req.user.roles ?? [],
    );
  }

  @Post('replacement-requests/:requestId/apply')
  @AnyPermissions('courses:edit_own', 'courses:manage')
  async applyReplacement(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @Req() req: any,
  ) {
    return this.replacementService.applyReplacement(
      requestId,
      req.user.userId,
      req.user.roles ?? [],
    );
  }
}
