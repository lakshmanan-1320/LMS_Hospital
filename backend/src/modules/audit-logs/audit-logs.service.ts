import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { AuditLogsRepository } from './audit-logs.repository';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { AUDIT_LOG_SOURCES } from './interfaces/audit-log.interface';

@Injectable()
export class AuditLogsService {
  constructor(@Inject(AuditLogsRepository) private readonly repository: AuditLogsRepository) {}

  async findAuditLogs(query: QueryAuditLogsDto) {
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException('"from" must be before "to".');
    }
    return this.repository.findAuditLogs({
      sources: query.source ? [query.source] : [...AUDIT_LOG_SOURCES],
      search: query.search?.trim() || undefined,
      from: query.from,
      to: query.to,
      page: query.page || 1,
      limit: query.limit || 25,
    });
  }

  getSources() {
    return {
      sources: [
        { key: 'modules', label: 'Module changes' },
        { key: 'roles', label: 'Roles & permissions' },
        { key: 'webinars', label: 'Webinars' },
        { key: 'media', label: 'Course media' },
      ],
    };
  }
}
