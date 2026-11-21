import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PlatformModulesRepository } from './platform-modules.repository';
import { ModuleRegistryService } from './module-registry.service';
import { UpdatePlatformModuleDto } from './dto/update-platform-module.dto';
import { UpdatePlatformModulesBatchDto } from './dto/update-platform-modules-batch.dto';
import { QueryModuleAuditDto } from './dto/query-module-audit.dto';
import { PlatformModuleEntity } from './interfaces/platform-module.interface';
import { SAFETY_LOCKS } from './platform-modules.constants';

const snapshot = (m: PlatformModuleEntity) => ({
  isEnabled: m.is_enabled,
  publicVisible: m.public_visible,
  roleVisibility: m.role_visibility,
});

@Injectable()
export class PlatformModulesService {
  private readonly logger = new Logger(PlatformModulesService.name);

  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(PlatformModulesRepository) private readonly repository: PlatformModulesRepository,
    @Inject(ModuleRegistryService) private readonly registry: ModuleRegistryService,
  ) {}

  /** Super Admin: full registry with audiences and dependencies. */
  async listModules() {
    const modules = await this.repository.findAllModules();
    return modules.map((m) => this.toResponse(m, modules));
  }

  /**
   * Public website configuration: which public modules are on and visible.
   * Used by the public header/homepage (Phase 5); holds no private data.
   */
  getPublicConfig() {
    const modules = this.registry
      .getAllModules()
      .filter((m) => m.supports_public)
      .map((m) => ({
        key: m.module_key,
        name: m.name,
        enabled: m.is_enabled && m.public_visible,
      }));
    return { modules };
  }

  /**
   * Super Admin: what turning this module off would affect, shown before confirming.
   * Data is never deleted; this lists who loses access and what work pauses.
   */
  async getImpact(moduleKey: string) {
    const all = await this.repository.findAllModules();
    const mod = all.find((m) => m.module_key === moduleKey);
    if (!mod) throw new NotFoundException(`Module [${moduleKey}] not found`);

    const visibleRoles = Object.entries(mod.role_visibility || {})
      .filter(([, visible]) => visible)
      .map(([role]) => role);

    return {
      key: mod.module_key,
      name: mod.name,
      isCore: mod.is_core,
      isEnabled: mod.is_enabled,
      publicVisible: mod.public_visible,
      affectedRoles: visibleRoles,
      affectedUsers: await this.repository.countActiveUsersWithRoles(visibleRoles),
      affectsPublicWebsite: mod.supports_public && mod.public_visible,
      workload: await this.repository.getModuleWorkload(moduleKey),
      dependents: all
        .filter((m) => m.is_enabled && m.depends_on.includes(moduleKey))
        .map((m) => ({ key: m.module_key, name: m.name })),
      preserved: [
        'All data is kept and restored when the module is turned back on.',
        'Admins keep read-only access to existing records.',
        'Payment and refund webhooks, and access to purchased courses, are never blocked.',
      ],
    };
  }

  /**
   * The signed-in user's access to every module, for building menus and guarding pages.
   * Same decision as ModuleAccessGuard: 'full', 'read_only' (Admin on a disabled module) or 'none'.
   * The frontend only uses this to hide/show; the backend guard still enforces every request.
   */
  getMyAccess(roles: string[]) {
    const modules = this.registry.getAllModules().map((m) => {
      const read = this.registry.evaluate(m.module_key, roles, 'GET');
      const write = this.registry.evaluate(m.module_key, roles, 'POST');
      const access = write.allowed ? 'full' : read.allowed ? 'read_only' : 'none';
      return { key: m.module_key, name: m.name, access, isEnabled: m.is_enabled, status: m.lifecycle_status };
    });
    return { modules };
  }

  async getAuditLogs(query: QueryModuleAuditDto) {
    return this.repository.findAuditLogs({
      moduleKey: query.moduleKey,
      page: query.page || 1,
      limit: query.limit || 25,
    });
  }

  /**
   * Super Admin: change one module (on/off, public website, role visibility). A one-item batch.
   */
  async updateModule(moduleKey: string, dto: UpdatePlatformModuleDto, actor: { userId: string }, ipAddress?: string) {
    const { modules } = await this.updateModulesBatch(
      {
        changes: [
          { key: moduleKey, isEnabled: dto.isEnabled, publicVisible: dto.publicVisible, roleVisibility: dto.roleVisibility },
        ],
        reason: dto.reason,
      },
      actor,
      ipAddress,
    );
    return modules[0];
  }

  /**
   * Super Admin: save several module changes together (all or nothing), one reason for all.
   * Rules: core modules locked, coming-soon modules can't be enabled, only supported audiences,
   * and dependencies are checked against the FINAL state (so "turn off Coupons + Cart & Checkout"
   * in one save is valid, while "turn off Cart & Checkout" alone is not).
   */
  async updateModulesBatch(dto: UpdatePlatformModulesBatchDto, actor: { userId: string }, ipAddress?: string) {
    const keys = dto.changes.map((c) => c.key);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Each module can appear only once per save.');
    }

    const changedKeys = await this.databaseService.withTransaction(async (client) => {
      // Lock in a stable order to avoid deadlocks between concurrent saves.
      for (const key of [...keys].sort()) {
        const exists = await this.repository.lockModule(client, key);
        if (!exists) throw new NotFoundException(`Module [${key}] not found`);
      }

      const all = await this.repository.findAllModules(client);
      const byKey = new Map(all.map((m) => [m.module_key, m]));

      // Final enabled state of every module after this save
      const finalEnabled = new Map(all.map((m) => [m.module_key, m.is_enabled]));
      for (const c of dto.changes) {
        if (c.isEnabled !== undefined) finalEnabled.set(c.key, c.isEnabled);
      }

      const plans: Array<{ mod: PlatformModuleEntity; isEnabled: boolean; publicVisible: boolean; roles: Array<[string, boolean]> }> = [];

      for (const c of dto.changes) {
        const mod = byKey.get(c.key)!;
        const roleChanges = Object.entries(c.roleVisibility || {});

        if (c.isEnabled === undefined && c.publicVisible === undefined && roleChanges.length === 0) {
          throw new BadRequestException(`Nothing to change for ${mod.name}: provide isEnabled, publicVisible or roleVisibility.`);
        }
        const nextEnabled = finalEnabled.get(c.key)!;
        const nextPublic = c.publicVisible ?? mod.public_visible;

        // Safety locks: the only things that can't be switched off or hidden (no lock-out).
        const lock = SAFETY_LOCKS[c.key];
        if (lock) {
          const hidesLockedRole = roleChanges.some(
            ([role, visible]) => visible === false && (lock.lockedRoles === 'all' || lock.lockedRoles.includes(role)),
          );
          if (nextEnabled === false || (lock.lockPublic && nextPublic === false) || hidesLockedRole) {
            throw new BadRequestException(`${mod.name} can't be turned off or hidden here: ${lock.reason}`);
          }
        }
        if (nextEnabled && mod.lifecycle_status === 'coming_soon') {
          throw new BadRequestException(`${mod.name} is not built yet and cannot be enabled.`);
        }
        if (nextPublic && !mod.supports_public) {
          throw new BadRequestException(`${mod.name} has no public-website audience.`);
        }
        for (const [role, visible] of roleChanges) {
          if (!mod.supported_roles.includes(role)) {
            throw new BadRequestException(
              `${mod.name} cannot be shown to role ${role}. Supported roles: ${mod.supported_roles.join(', ') || 'none'}.`,
            );
          }
          if (typeof visible !== 'boolean') {
            throw new BadRequestException(`roleVisibility.${role} must be true or false.`);
          }
        }

        // Dependencies, against the final state
        if (nextEnabled && !mod.is_enabled) {
          const missing = mod.depends_on.filter((key) => !finalEnabled.get(key));
          if (missing.length > 0) {
            throw new BadRequestException(
              `${mod.name} needs these modules turned on first: ${missing.map((k) => byKey.get(k)?.name || k).join(', ')}.`,
            );
          }
        }
        if (!nextEnabled && mod.is_enabled) {
          const dependents = all.filter((m) => finalEnabled.get(m.module_key) && m.depends_on.includes(c.key));
          if (dependents.length > 0) {
            throw new BadRequestException(
              `Turn off these modules first, they depend on ${mod.name}: ${dependents.map((m) => m.name).join(', ')}.`,
            );
          }
        }

        plans.push({ mod, isEnabled: nextEnabled, publicVisible: nextPublic, roles: roleChanges });
      }

      for (const plan of plans) {
        const key = plan.mod.module_key;
        await this.repository.updateModuleState(client, key, { isEnabled: plan.isEnabled, publicVisible: plan.publicVisible }, actor.userId);
        for (const [role, visible] of plan.roles) {
          await this.repository.setRoleVisibility(client, key, role, visible);
        }
      }

      const updated = new Map((await this.repository.findAllModules(client)).map((m) => [m.module_key, m]));
      for (const plan of plans) {
        await this.repository.createAuditLog(client, {
          moduleKey: plan.mod.module_key,
          action: 'MODULE_UPDATED',
          previousState: snapshot(plan.mod),
          newState: snapshot(updated.get(plan.mod.module_key)!),
          reason: dto.reason.trim(),
          actorId: actor.userId,
          ipAddress,
        });
      }

      return plans.map((p) => p.mod.module_key);
    });

    // Apply immediately on this instance (others pick it up on their next refresh).
    await this.registry.reload();
    this.logger.log(`Modules [${changedKeys.join(', ')}] updated by [${actor.userId}]`);

    const modules = await this.repository.findAllModules();
    return {
      modules: changedKeys.map((key) => this.toResponse(modules.find((m) => m.module_key === key)!, modules)),
    };
  }

  private toResponse(m: PlatformModuleEntity, all: PlatformModuleEntity[]) {
    return {
      key: m.module_key,
      name: m.name,
      description: m.description,
      group: m.module_group,
      status: m.lifecycle_status,
      isCore: m.is_core,
      isEnabled: m.is_enabled,
      supportsPublic: m.supports_public,
      publicVisible: m.public_visible,
      supportedRoles: m.supported_roles,
      safetyLock: SAFETY_LOCKS[m.module_key]
        ? {
            reason: SAFETY_LOCKS[m.module_key].reason,
            lockedRoles: SAFETY_LOCKS[m.module_key].lockedRoles,
            lockPublic: SAFETY_LOCKS[m.module_key].lockPublic,
          }
        : null,
      audienceRoles: m.audience_roles,
      roleVisibility: m.role_visibility,
      dependsOn: m.depends_on,
      requiredBy: all.filter((o) => o.depends_on.includes(m.module_key)).map((o) => o.module_key),
      sortOrder: m.sort_order,
      updatedAt: m.updated_at,
    };
  }
}
