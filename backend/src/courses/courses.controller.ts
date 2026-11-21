import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import {
  CreateCourseLanguageDto,
  UpdateCourseLanguageDto,
} from './dto/course-language.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AnyPermissions } from '../common/decorators/any-permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';
import { CourseLandingService } from './course-landing.service';

@RequireModule(MODULE_KEYS.TEACHING)
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly courseLandingService: CourseLandingService,
  ) {}

  /**
   * 1. CREATE DRAFT COURSE
   * Requires: courses:create
   */
  @Post()
  @Permissions('courses:create')
  @HttpCode(HttpStatus.CREATED)
  async createCourse(@Body() createDto: CreateCourseDto, @Req() req: any) {
    const userId = req.user?.userId;
    const course = await this.coursesService.createCourse(createDto, userId);
    return {
      message: 'Course created successfully',
      course,
    };
  }

  /**
   * 2. GET OWN COURSES (INSTRUCTOR)
   * Requires: courses:view_own
   * Fixed route declared before :id
   */
  @Get('my')
  @Permissions('courses:view_own')
  async getMyCourses(@Query() query: QueryCourseDto, @Req() req: any) {
    const userId = req.user?.userId;
    return this.coursesService.getMyCourses(userId, query);
  }

  /**
   * 3. GET OWN COURSE STATS (INSTRUCTOR)
   * Requires: courses:view_own
   * Fixed route declared before :id
   */
  @RequireModule(MODULE_KEYS.INSTRUCTOR_PERFORMANCE)
  @Get('my/stats')
  @Permissions('courses:view_own')
  async getMyStats(@Req() req: any) {
    const userId = req.user?.userId;
    return this.coursesService.getMyStats(userId);
  }

  /**
   * 4. GET ALL COURSES (ADMIN / SUPER_ADMIN)
   * Requires: courses:manage
   * Fixed route declared before :id
   */
  @Get('admin')
  @Permissions('courses:manage')
  async getAdminCourses(@Query() query: QueryCourseDto) {
    return this.coursesService.getAdminCourses(query);
  }
/**
 * Public course catalogue.
 * Only published and active courses are returned.
 */
@RequireModule(MODULE_KEYS.COURSE_CATALOG)
@Get('catalog')
@Public()
async getPublicCatalogue(@Query() query: QueryCourseDto) {
  return this.coursesService.getPublicCatalogue(query);
}

  /**
   * Public course landing page: course, curriculum, stats, instructor, badges, guarantee.
   * GET /courses/:idOrSlug/landing
   */
  @RequireModule(MODULE_KEYS.COURSE_CATALOG)
  @Public()
  @Get(':idOrSlug/landing')
  async getCourseLanding(@Param('idOrSlug') idOrSlug: string) {
    return this.courseLandingService.getLanding(idOrSlug);
  }

  /**
   * Public related courses (same category first), for "Because you viewed" / "More in" rows.
   * GET /courses/:idOrSlug/related?limit=8
   */
  @RequireModule(MODULE_KEYS.COURSE_CATALOG)
  @Public()
  @Get(':idOrSlug/related')
  async getRelatedCourses(@Param('idOrSlug') idOrSlug: string, @Query('limit') limit?: string) {
    return this.courseLandingService.getRelated(idOrSlug, Number(limit) || 8);
  }
  /**
   * 4b. GET COURSE LANGUAGES
   * Public/active by default, or all if ?all=true
   * Fixed route declared before :id
   */
  @RequireModule(MODULE_KEYS.COURSE_CATALOG)
  @Get('languages')
  @Public()
  async getCourseLanguages(@Query('all') all?: string) {
    const activeOnly = all !== 'true';
    return this.coursesService.getCourseLanguages(activeOnly);
  }

  /**
   * 4c. CREATE COURSE LANGUAGE (ADMIN SETTINGS)
   * Requires: courses:manage
   * Fixed route declared before :id
   */
  @Post('languages')
  @Permissions('courses:manage')
  @HttpCode(HttpStatus.CREATED)
  async createCourseLanguage(@Body() dto: CreateCourseLanguageDto) {
    const language = await this.coursesService.createCourseLanguage(dto);
    return {
      message: 'Course language created successfully',
      language,
    };
  }

  /**
   * 4e. UPDATE COURSE LANGUAGE (ADMIN SETTINGS)
   * Requires: courses:manage
   * Fixed route declared before :id
   */
  @Patch('languages/:id')
  @Permissions('courses:manage')
  async updateCourseLanguage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCourseLanguageDto,
  ) {
    const updated = await this.coursesService.updateCourseLanguage(id, dto);
    return {
      message: 'Course language updated successfully',
      language: updated,
    };
  }

  /**
   * 4f. DELETE COURSE LANGUAGE (ADMIN SETTINGS)
   * Requires: courses:manage
   * Fixed route declared before :id
   */
  @Delete('languages/:id')
  @Permissions('courses:manage')
  async deleteCourseLanguage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.coursesService.deleteCourseLanguage(id);
  }

  /**
   * 4g. UPLOAD COURSE THUMBNAIL IMAGE
   * Requires: courses:create OR courses:edit_own OR courses:manage
   * Fixed route declared before :id
   */
  @Post('upload-thumbnail')
  @AnyPermissions('courses:create', 'courses:edit_own', 'courses:manage')
  @UseInterceptors(
    FileInterceptor('thumbnail', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dest = path.join(process.cwd(), 'uploads', 'thumbnails');
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
          }
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
          const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `thumb-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max limit
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(
            new BadRequestException('Only JPG, JPEG, PNG, and WebP images are allowed.'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadThumbnail(
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 5001}`;
    const fileUrl = `${protocol}://${host}/uploads/thumbnails/${file.filename}`;

    return {
      message: 'Thumbnail image uploaded successfully',
      url: fileUrl,
      filename: file.filename,
      size: file.size,
    };
  }

  /**
   * 4h. UPLOAD COURSE PROMOTIONAL VIDEO
   * Requires: courses:create OR courses:edit_own OR courses:manage
   */
  @Post(':id/upload-promo-video')
  @AnyPermissions('courses:create', 'courses:edit_own', 'courses:manage')
  @UseInterceptors(
    FileInterceptor('video', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dest = path.join(process.cwd(), 'uploads', 'videos');
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
          }
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
          const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
          cb(null, `promo-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max limit
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(mp4|webm|quicktime|x-matroska|ogg)$/)) {
          return cb(
            new BadRequestException('Only MP4, WebM, MOV, and MKV video formats are allowed.'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadPromoVideo(
    @Param('id', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Video file is required');
    }
    return this.coursesService.attachPromoVideo(courseId, file, req.user, req);
  }

  /**
   * 5. GET COURSE DETAIL BY ID
   * Requires: courses:view_own OR courses:manage
   */
  @RequireModule(MODULE_KEYS.COURSE_CATALOG)
  @Get(':idOrSlug')
  @AnyPermissions('courses:view_own', 'courses:manage')
  async getCourseById(
    @Param('idOrSlug') idOrSlug: string, // UUID or slug, so the UI can use readable URLs
    @Req() req: any,
  ) {
    return this.coursesService.getCourseByIdOrSlug(idOrSlug, req.user);
  }

  /**
   * 6. UPDATE COURSE (PATCH)
   * Requires: courses:edit_own OR courses:manage
   */
  @Patch(':id')
  @AnyPermissions('courses:edit_own', 'courses:manage')
  async updateCourse(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateDto: UpdateCourseDto,
    @Req() req: any,
  ) {
    const updated = await this.coursesService.updateCourse(id, updateDto, req.user);
    return {
      message: 'Course updated successfully',
      course: updated,
    };
  }

  /**
   * 7. SOFT DELETE COURSE
   * Requires: courses:edit_own OR courses:manage
   * Only draft courses can be deleted (enforced in service layer)
   */
  @Delete(':id')
  @AnyPermissions('courses:edit_own', 'courses:manage')
  async deleteCourse(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: any,
  ) {
    return this.coursesService.deleteCourse(id, req.user);
  }

  /**
   * 8. GET COURSE CHECKLIST (Read-only)
   * Requires: courses:view_own OR courses:manage
   */
  @Get(':id/checklist')
  @AnyPermissions('courses:view_own', 'courses:manage')
  async getCourseChecklist(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: any,
  ) {
    return this.coursesService.getCourseChecklist(id, req.user);
  }
}

