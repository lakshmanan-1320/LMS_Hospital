import { IsOptional, IsString, IsIn, IsInt, Min, Max, IsISO8601, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { AUDIT_LOG_SOURCES, AuditLogSource } from '../interfaces/audit-log.interface';

export class QueryAuditLogsDto {
  @IsOptional()
  @IsIn(AUDIT_LOG_SOURCES)
  source?: AuditLogSource;

  /** Matches action, subject or actor email (case-insensitive). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
