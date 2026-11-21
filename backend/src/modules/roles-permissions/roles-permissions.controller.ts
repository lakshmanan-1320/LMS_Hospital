import { Controller, Get, Patch, Body, Param, Ip } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { MODULE_KEYS } from '../platform-modules/platform-modules.constants';
import { RolesPermissionsService } from './roles-permissions.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@Controller('roles-permissions')
@RequireModule(MODULE_KEYS.ROLES_PERMISSIONS)
export class RolesPermissionsController {
  constructor(private readonly rolesPermissionsService: RolesPermissionsService) {}

  /**
   * Super Admin: roles with their permissions + permission catalog grouped by module.
   * GET /roles-permissions
   */
  @Get()
  @Roles('SUPER_ADMIN')
  getMatrix() {
    return this.rolesPermissionsService.getMatrix();
  }

  /**
   * Super Admin: replace a role's permission set (reason required).
   * PATCH /roles-permissions/roles/:roleName
   */
  @Patch('roles/:roleName')
  @Roles('SUPER_ADMIN')
  updateRolePermissions(
    @Param('roleName') roleName: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.rolesPermissionsService.updateRolePermissions(roleName, dto, user, ip);
  }
}
