import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateCategoryStatusDto } from './dto/update-status.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.CATEGORIES)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * 1. CREATE CATEGORY
   * Admin-only operation protected by categories:manage permission
   */
  @Post()
  @Permissions('categories:manage')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body() createDto: CreateCategoryDto, @Req() req: any) {
    const userId = req.user?.userId;
    const category = await this.categoriesService.createCategory(createDto, userId);
    return {
      message: 'Category created successfully',
      category,
    };
  }

  /**
   * 2. GET CATEGORIES (FLAT LIST)
   * Public route with search, parent filter, and pagination
   */
  @Get()
  @Public()
  async getCategories(@Query() query: QueryCategoryDto) {
    return this.categoriesService.getCategories(query);
  }

  /**
   * 3. GET CATEGORY TREE
   * Public route returning full nested tree.
   * Passing activeOnly=true automatically prunes inactive parents and subtrees.
   */
  @Get('tree')
  @Public()
  async getCategoryTree(@Query('activeOnly') activeOnly?: string) {
    const isActiveOnly = activeOnly === 'true' || activeOnly === '1';
    const tree = await this.categoriesService.getCategoryTree(isActiveOnly);
    const nextDisplayOrder = await this.categoriesService.getNextDisplayOrder(null);
    return {
      totalRootNodes: tree.length,
      nextDisplayOrder,
      tree,
    };
  }

  /**
   * 4. GET CATEGORY BY SEO SLUG
   * Public SEO route
   */
  @Get('slug/:slug')
  @Public()
  async getCategoryBySlug(@Param('slug') slug: string) {
    return this.categoriesService.getCategoryBySlug(slug);
  }

  /**
   * 6. GET CATEGORY BY ID
   * Public route with breadcrumb hierarchy and direct children
   */
  @Get(':id')
  @Public()
  async getCategoryById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.categoriesService.getCategoryById(id);
  }

  /**
   * 6. UPDATE CATEGORY
   * Admin-only operation with circular hierarchy and duplicate checks
   */
  @Put(':id')
  @Permissions('categories:manage')
  async updateCategory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateDto: UpdateCategoryDto,
  ) {
    const updated = await this.categoriesService.updateCategory(id, updateDto);
    return {
      message: 'Category updated successfully',
      category: updated,
    };
  }

  /**
   * 7. ACTIVATE / DEACTIVATE CATEGORY
   * Admin-only operation with optional cascading to all descendants
   */
  @Patch(':id/status')
  @Permissions('categories:manage')
  async updateCategoryStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() statusDto: UpdateCategoryStatusDto,
  ) {
    const result = await this.categoriesService.updateStatus(id, statusDto);
    return {
      message: `Category status updated successfully to ${
        statusDto.isActive ? 'active' : 'inactive'
      } (${result.updatedCount} record(s) affected).`,
      result,
    };
  }

  /**
   * 8. DELETE CATEGORY
   * Admin-only operation with course reference safety and optional cascade
   */
  @Delete(':id')
  @Permissions('categories:manage')
  async deleteCategory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('cascade') cascade?: string,
  ) {
    const isCascade = cascade === 'true' || cascade === '1';
    return this.categoriesService.deleteCategory(id, isCascade);
  }
}

