import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PlatformModulesRepository } from './platform-modules.repository';
import { PlatformModuleEntity, ModuleAccessDecision } from './interfaces/platform-module.interface';
import {
  MODULE_ERROR_CODES,
  HISTORICAL_READ_ROLES,
  READ_ONLY_METHODS,
  MODULE_REGISTRY_REFRESH_MS,
} from './platform-modules.constants';

/**
 * In-memory copy of the module registry, used by ModuleAccessGuard on every request.
 * Reloaded right after a change on this instance, and every 30s to pick up changes made
 * on other instances. A failed refresh keeps the last good copy.
 */
@Injectable()
export class ModuleRegistryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModuleRegistryService.name);
  private modules = new Map<string, PlatformModuleEntity>();
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(@Inject(PlatformModulesRepository) private readonly repository: PlatformModulesRepository) {}

  async onModuleInit(): Promise<void> {
    // Startup requires the registry (migration 023): without it access can't be decided safely.
    await this.reload();
    this.refreshTimer = setInterval(() => {
      this.reload().catch((err) => this.logger.warn(`Module registry refresh failed, keeping last copy: ${err.message}`));
    }, MODULE_REGISTRY_REFRESH_MS);
    this.refreshTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  async reload(): Promise<void> {
    const rows = await this.repository.findAllModules();
    this.modules = new Map(rows.map((m) => [m.module_key, m]));
  }

  getModule(moduleKey: string): PlatformModuleEntity | undefined {
    return this.modules.get(moduleKey);
  }

  getAllModules(): PlatformModuleEntity[] {
    return [...this.modules.values()];
  }

  /**
   * The module part of the four access checks (enabled -> audience). Permission and
   * ownership checks run afterwards in RolesGuard/PermissionsGuard and the services.
   *
   * @param moduleKey   module the route belongs to
   * @param roles       caller's roles, or null for an anonymous/public route
   * @param method      HTTP method (GET/HEAD count as read-only)
   */
  evaluate(moduleKey: string, roles: string[] | null, method: string): ModuleAccessDecision {
    const mod = this.modules.get(moduleKey);
    const isAnonymous = !roles;

    if (!mod) {
      // Unknown key = programming error; fail closed.
      this.logger.error(`Route requires unknown module [${moduleKey}]`);
      return {
        allowed: false,
        status: 404,
        code: MODULE_ERROR_CODES.MODULE_NOT_AVAILABLE,
        message: 'This feature is not available.',
      };
    }

    if (!mod.is_enabled) {
      // Path 2 of 2: Admin keeps read-only access to a disabled module's historical data.
      const isHistoricalReader = !isAnonymous && roles.some((r) => HISTORICAL_READ_ROLES.includes(r));
      if (isHistoricalReader && READ_ONLY_METHODS.includes(method.toUpperCase())) {
        return { allowed: true, mode: 'historical_read' };
      }
      return {
        allowed: false,
        status: isAnonymous ? 404 : 403,
        code: MODULE_ERROR_CODES.MODULE_DISABLED,
        message: `${mod.name} is currently unavailable.`,
      };
    }

    // Path 1 of 2: module is on; check the audience.
    if (isAnonymous) {
      if (mod.supports_public && mod.public_visible) return { allowed: true, mode: 'full' };
      return {
        allowed: false,
        status: 404,
        code: MODULE_ERROR_CODES.MODULE_NOT_AVAILABLE,
        message: `${mod.name} is not available.`,
      };
    }

    const visibleToRole = roles.some((r) => mod.role_visibility?.[r] === true);
    if (visibleToRole) return { allowed: true, mode: 'full' };

    return {
      allowed: false,
      status: 403,
      code: MODULE_ERROR_CODES.MODULE_NOT_AVAILABLE,
      message: `${mod.name} is not available for your account.`,
    };
  }
}
