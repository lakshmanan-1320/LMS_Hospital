import { IsString, IsNotEmpty, IsIn, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(['course_completion', 'webinar_participation'])
  certificateType: 'course_completion' | 'webinar_participation';

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  templateConfiguration?: Record<string, any>;

  @IsString()
  @IsOptional()
  logoStorageKey?: string;

  @IsString()
  @IsOptional()
  signatureStorageKey?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
