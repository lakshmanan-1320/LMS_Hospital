import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class ReissueCertificateDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Reissue reason must be at least 5 characters long' })
  reason: string;

  @IsString()
  @IsOptional()
  correctedStudentName?: string;
}
