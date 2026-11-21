import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { InstructorsService } from './instructors.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AnyPermissions } from '../common/decorators/any-permissions.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UpdateInstructorProfileDto } from './dto/update-instructor-profile.dto';
import { QueryInstructorsDto } from './dto/query-instructors.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { MAX_AVATAR_SIZE_BYTES } from './utils/avatar-security.util';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.INSTRUCTOR_PROFILES)
@Controller('instructors')
export class InstructorsController {
  constructor(private readonly service: InstructorsService) {}

  /**
   * 1. GET /instructors/me
   * Authenticated instructor retrieves their own profile.
   * Auto-provisions if first time access.
   */
  @RequireModule(MODULE_KEYS.TEACHING)
  @Get('me')
  @AnyPermissions('instructors:manage_own', 'courses:view_own')
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMyProfile(user.userId);
  }

  /**
   * 2. PATCH /instructors/me
   * Authenticated instructor partially updates their own profile.
   */
  @RequireModule(MODULE_KEYS.TEACHING)
  @Patch('me')
  @AnyPermissions('instructors:manage_own', 'courses:edit_own')
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateInstructorProfileDto,
  ) {
    return this.service.updateMyProfile(user.userId, dto);
  }

  /**
   * 3. POST /instructors/me/avatar
   * Upload profile photo with strict file size and magic-byte inspection.
   */
  @RequireModule(MODULE_KEYS.TEACHING)
  @Post('me/avatar')
  @AnyPermissions('instructors:manage_own', 'courses:edit_own')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Avatar image file is required');
    }
    return this.service.uploadAvatar(user.userId, file.buffer);
  }

  /**
   * 3b. GET /instructors/me/learners
   * Authenticated instructor retrieves all students enrolled in their courses.
   */
  @RequireModule(MODULE_KEYS.INSTRUCTOR_STUDENTS)
  @Get('me/learners')
  @AnyPermissions('instructors:manage_own', 'courses:view_own')
  async getMyLearners(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMyLearners(user.userId);
  }

  /**
   * 4. GET /instructors
   * Public directory listing of public instructors with search and filters.
   */
  @Public()
  @Get()
  async getDirectory(@Query() query: QueryInstructorsDto) {
    return this.service.getDirectory(query);
  }

  /**
   * 5. GET /instructors/:identifier
   * Public profile view of an instructor by human-readable slug OR userId.
   * Strictly public; never leaks email.
   * If caller is Admin with instructors:manage, allows viewing even when is_public = false.
   */
  @Public()
  @Get(':identifier')
  async getPublicProfile(
    @Param('identifier') identifier: string,
    @Req() req: any,
  ) {
    const callerPermissions = req.user?.permissions || [];
    return this.service.getPublicProfile(identifier, callerPermissions);
  }

  /**
   * 6. PATCH /instructors/:userId
   * Admin updates an instructor profile.
   */
  @Patch(':userId')
  @Permissions('instructors:manage')
  async adminUpdateProfile(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: UpdateInstructorProfileDto,
  ) {
    return this.service.adminUpdateProfile(userId, dto);
  }

  /**
   * 7. PATCH /instructors/:userId/visibility
   * Admin toggles public visibility moderation.
   */
  @Patch(':userId/visibility')
  @Permissions('instructors:manage')
  async adminSetVisibility(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() body: UpdateVisibilityDto,
  ) {
    return this.service.adminSetVisibility(userId, body.isPublic);
  }
}

