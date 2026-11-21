import { Module } from '@nestjs/common';
import { RolesPermissionsRepository } from './roles-permissions.repository';
import { RolesPermissionsService } from './roles-permissions.service';
import { RolesPermissionsController } from './roles-permissions.controller';

/** Roles & Permissions management (Super Admin governance). */
@Module({
  controllers: [RolesPermissionsController],
  providers: [RolesPermissionsRepository, RolesPermissionsService],
})
export class RolesPermissionsModule {}
