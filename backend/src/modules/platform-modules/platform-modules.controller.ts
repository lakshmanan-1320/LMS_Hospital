import { Controller, Get, Patch, Body, Param, Query, Ip } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireModule, SkipModuleCheck } from '../../common/decorators/require-module.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PlatformModulesService } from './platform-modules.service';
import { UpdatePlatformModuleDto } from './dto/update-platform-module.dto';
import { UpdatePlatformModulesBatchDto } from './dto/update-platform-modules-batch.dto';
import { QueryModuleAuditDto } from './dto/query-module-audit.dto';
import { MODULE_KEYS } from './platform-modules.constants';

@Controller('platform-modules')
@RequireModule(MODULE_KEYS.MODULE_MANAGEMENT)
export class PlatformModulesController {
  constructor(private readonly platformModulesService: PlatformModulesService) {}

  /**
   * Public website configuration (which public modules are on).
   * GET /platform-modules/public-config
   */
  @Public()
  @SkipModuleCheck() // needed by every page to build menus, whatever the module settings
  @Get('public-config')
  getPublicConfig() {
    return this.platformModulesService.getPublicConfig();
  }

  /**
   * Any signed-in user: their access to each module (menus and page guards).
   * GET /platform-modules/my-access
   */
  @SkipModuleCheck() // needed by every page to build menus, whatever the module settings
  @Get('my-access')
  getMyAccess(@CurrentUser() user: AuthenticatedUser) {
    return this.platformModulesService.getMyAccess(user.roles || []);
  }

  /**
   * Super Admin: module registry with audiences and dependencies.
   * GET /platform-modules
   */
  @Get()
  @Roles('SUPER_ADMIN')
  listModules() {
    return this.platformModulesService.listModules();
  }

  /**
   * Super Admin: module change history.
   * GET /platform-modules/audit-logs
   */
  @Get('audit-logs')
  @Roles('SUPER_ADMIN')
  getAuditLogs(@Query() query: QueryModuleAuditDto) {
    return this.platformModulesService.getAuditLogs(query);
  }

  /**
   * Super Admin: save several module changes together (all or nothing, one reason).
   * PATCH /platform-modules
   */
  @Patch()
  @Roles('SUPER_ADMIN')
  updateModulesBatch(
    @Body() dto: UpdatePlatformModulesBatchDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.platformModulesService.updateModulesBatch(dto, user, ip);
  }

  /**
   * Super Admin: impact preview before turning a module off.
   * GET /platform-modules/:moduleKey/impact
   */
  @Get(':moduleKey/impact')
  @Roles('SUPER_ADMIN')
  getImpact(@Param('moduleKey') moduleKey: string) {
    return this.platformModulesService.getImpact(moduleKey);
  }

  /**
   * Super Admin: turn a module on/off or change its audiences (reason required).
   * PATCH /platform-modules/:moduleKey
   */
  @Patch(':moduleKey')
  @Roles('SUPER_ADMIN')
  updateModule(
    @Param('moduleKey') moduleKey: string,
    @Body() dto: UpdatePlatformModuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.platformModulesService.updateModule(moduleKey, dto, user, ip);
  }
}
