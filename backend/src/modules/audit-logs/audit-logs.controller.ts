import { Controller, Get, Query } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../platform-modules/platform-modules.constants';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Controller('audit-logs')
@RequireModule(MODULE_KEYS.AUDIT_LOGS)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  /**
   * Governance audit trail (module changes, webinars, course media).
   * GET /audit-logs?source=&search=&from=&to=&page=&limit=
   */
  @Get()
  @Permissions('audit_logs:read')
  findAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.auditLogsService.findAuditLogs(query);
  }

  /**
   * Available audit sources for the filter.
   * GET /audit-logs/sources
   */
  @Get('sources')
  @Permissions('audit_logs:read')
  getSources() {
    return this.auditLogsService.getSources();
  }
}
