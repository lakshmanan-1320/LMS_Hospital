import { Module } from '@nestjs/common';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';

/** Governance audit trail viewer (Super Admin, permission audit_logs:read). */
@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsRepository, AuditLogsService],
})
export class AuditLogsModule {}
