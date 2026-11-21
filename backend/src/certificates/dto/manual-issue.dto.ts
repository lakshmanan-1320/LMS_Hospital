import { IsUUID, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class ManualIssueCertificateDto {
  @IsUUID()
  @IsNotEmpty()
  webinarId: string;

  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
