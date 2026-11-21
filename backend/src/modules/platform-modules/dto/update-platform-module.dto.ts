import { IsBoolean, IsOptional, IsString, MinLength, MaxLength, IsObject } from 'class-validator';

export class UpdatePlatformModuleDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  publicVisible?: boolean;

  /** Role name -> visible, e.g. { "STUDENT": false }. Only the module's supported roles. */
  @IsOptional()
  @IsObject()
  roleVisibility?: Record<string, boolean>;

  /** Required: recorded in the module audit log. */
  @IsString()
  @MinLength(5, { message: 'reason must be at least 5 characters' })
  @MaxLength(500)
  reason: string;
}
