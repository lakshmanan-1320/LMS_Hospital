import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MODULE_KEY = 'requireModule';
export const SKIP_MODULE_CHECK_KEY = 'skipModuleCheck';

/**
 * Ties a controller (or a single handler, which overrides the controller) to a platform module.
 * ModuleAccessGuard then enforces: module enabled -> visible to the caller's audience.
 * Use MODULE_KEYS from modules/platform-modules/platform-modules.constants.
 */
export const RequireModule = (moduleKey: string) => SetMetadata(REQUIRE_MODULE_KEY, moduleKey);

/**
 * Exempts a handler from module checks. Only for provider webhooks (payments, refunds,
 * meeting and messaging status callbacks) and infrastructure endpoints: money already in
 * flight and history must never be lost because a module was turned off.
 */
export const SkipModuleCheck = () => SetMetadata(SKIP_MODULE_CHECK_KEY, true);
