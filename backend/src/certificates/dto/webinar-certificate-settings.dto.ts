import { IsBoolean, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';

export class UpdateWebinarCertificateSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  minimumAttendancePercentage?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minimumAttendanceMinutes?: number;

  @IsUUID()
  @IsOptional()
  templateId?: string;
}
