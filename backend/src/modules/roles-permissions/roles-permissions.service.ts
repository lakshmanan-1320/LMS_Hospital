import { Injectable, Inject, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RolesPermissionsRepository } from './roles-permissions.repository';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { EDITABLE_ROLES, LOCKED_ROLES, GOVERNANCE_PERMISSIONS } from './roles-permissions.constants';
import { RoleWithPermissions } from './interfaces/role-permission.interface';

@Injectable()
export class RolesPermissionsService {
  private readonly logger = new Logger(RolesPermissionsService.name);

  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(RolesPermissionsRepository) private readonly repository: RolesPermissionsRepository,
  ) {}

  /**
   * Super Admin: every role with its permissions, plus the permission catalog grouped by module.
   * Changes apply on the next request (JwtAuthGuard reads permissions live from the database).
   */
  async getMatrix() {
    const [roles, permissions] = await Promise.all([this.repository.findRoles(), this.repository.findPermissions()]);
    return {
      roles: roles.map((r) => this.toRoleResponse(r)),
      permissions: permissions.map((p) => ({
        code: p.code,
        description: p.description,
        moduleKey: p.module_key,
        moduleName: p.module_name || 'Other',
        isGovernance: GOVERNANCE_PERMISSIONS.includes(p.code),
      })),
    };
  }

  /**
   * Super Admin: replace a role's permission set. Rules: Super Admin's role is locked,
   * governance permissions can't be granted to other roles, codes must exist, reason required.
   */
  async updateRolePermissions(
    roleName: string,
    dto: UpdateRolePermissionsDto,
    actor: { userId: string },
    ipAddress?: string,
  ) {
    const role = roleName.toUpperCase();

    if (LOCKED_ROLES.includes(role)) {
      throw new BadRequestException('The Super Admin role is locked: its governance permissions cannot be changed.');
    }
    if (!EDITABLE_ROLES.includes(role)) {
      throw new NotFoundException(`Role [${roleName}] not found`);
    }

    const requested = [...new Set(dto.permissions.map((c) => c.trim()))];
    const governance = requested.filter((c) => GOVERNANCE_PERMISSIONS.includes(c));
    if (governance.length > 0) {
      throw new BadRequestException(
        `Governance permissions stay with Super Admin and cannot be granted to ${role}: ${governance.join(', ')}.`,
      );
    }

    const result = await this.databaseService.withTransaction(async (client) => {
      const roleId = await this.repository.lockRole(client, role);
      if (!roleId) throw new NotFoundException(`Role [${roleName}] not found`);

      const catalog = new Set((await this.repository.findPermissions(client)).map((p) => p.code));
      const unknown = requested.filter((c) => !catalog.has(c));
      if (unknown.length > 0) {
        throw new BadRequestException(`Unknown permissions: ${unknown.join(', ')}.`);
      }

      const current = (await this.repository.findRoles(client)).find((r) => r.name === role)!;
      const added = requested.filter((c) => !current.permissions.includes(c)).sort();
      const removed = current.permissions.filter((c) => !requested.includes(c)).sort();
      if (added.length === 0 && removed.length === 0) {
        throw new BadRequestException('Nothing to change: the role already has exactly these permissions.');
      }

      await this.repository.addPermissions(client, roleId, added);
      await this.repository.removePermissions(client, roleId, removed);
      await this.repository.createAuditLog(client, {
        roleId,
        added,
        removed,
        reason: dto.reason.trim(),
        actorId: actor.userId,
        ipAddress,
      });

      const updated = (await this.repository.findRoles(client)).find((r) => r.name === role)!;
      return { updated, added, removed };
    });

    this.logger.log(
      `Role [${role}] permissions updated by [${actor.userId}]: +[${result.added.join(', ')}] -[${result.removed.join(', ')}]`,
    );
    return { role: this.toRoleResponse(result.updated), added: result.added, removed: result.removed };
  }

  private toRoleResponse(r: RoleWithPermissions) {
    return {
      name: r.name,
      description: r.description,
      permissions: [...r.permissions].sort(),
      activeUsers: r.active_users,
      isLocked: LOCKED_ROLES.includes(r.name),
      isEditable: EDITABLE_ROLES.includes(r.name),
    };
  }
}
