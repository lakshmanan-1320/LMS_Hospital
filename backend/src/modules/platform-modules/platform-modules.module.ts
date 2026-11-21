import { Module, Global } from '@nestjs/common';
import { PlatformModulesRepository } from './platform-modules.repository';
import { ModuleRegistryService } from './module-registry.service';
import { PlatformModulesService } from './platform-modules.service';
import { PlatformModulesController } from './platform-modules.controller';

/**
 * Dynamic Module Management: module registry, Super Admin API, and the registry used by
 * the global ModuleAccessGuard. Global so the guard and other modules can read the registry.
 */
@Global()
@Module({
  controllers: [PlatformModulesController],
  providers: [PlatformModulesRepository, ModuleRegistryService, PlatformModulesService],
  exports: [ModuleRegistryService, PlatformModulesService],
})
export class PlatformModulesModule {}
