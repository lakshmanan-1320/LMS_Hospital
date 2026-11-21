import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_MODULE_KEY, SKIP_MODULE_CHECK_KEY } from '../decorators/require-module.decorator';
import { ModuleRegistryService } from '../../modules/platform-modules/module-registry.service';
import { ModuleAccessDecision } from '../../modules/platform-modules/interfaces/platform-module.interface';

/**
 * Global guard (runs after JwtAuthGuard, before RolesGuard/PermissionsGuard).
 * Enforces checks 1-2 of 4: module enabled -> visible to the caller's audience.
 *
 * Two explicit paths for a DISABLED module (docs/module-access-rules.md):
 *  - Admin + read-only method (GET/HEAD): allowed, historical data stays reachable.
 *  - Everyone/everything else: MODULE_DISABLED (404 for anonymous callers, 403 otherwise).
 * Webhooks are exempt via @SkipModuleCheck(); core modules are never blocked.
 */
@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ModuleRegistryService) private readonly registry: ModuleRegistryService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(SKIP_MODULE_CHECK_KEY, targets)) {
      return true;
    }

    const moduleKey = this.reflector.getAllAndOverride<string>(REQUIRE_MODULE_KEY, targets);
    if (!moduleKey) {
      return true; // Not tied to a module (test-platform-modules asserts every controller is tagged).
    }

    const request = context.switchToHttp().getRequest();
    // Public routes skip JwtAuthGuard, so request.user is unset: that's the public audience.
    const roles: string[] | null = request.user?.roles ?? null;

    const decision = this.registry.evaluate(moduleKey, roles, request.method);

    if (decision.allowed) {
      request.moduleAccess = { module: moduleKey, mode: decision.mode };
      return true;
    }

    const denied = decision as Extract<ModuleAccessDecision, { allowed: false }>;
    const body = { message: denied.message, code: denied.code, module: moduleKey };
    throw denied.status === 404 ? new NotFoundException(body) : new ForbiddenException(body);
  }
}
