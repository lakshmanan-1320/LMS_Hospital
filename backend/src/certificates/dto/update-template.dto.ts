import { IsString, IsOptional, IsBoolean, IsObject, IsIn } from 'class-validator';

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

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

  @IsString()
  @IsIn(['active', 'archived'])
  @IsOptional()
  status?: 'active' | 'archived';
}
