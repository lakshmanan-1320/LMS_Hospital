import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ModuleChangeDto {
  @IsString()
  @MaxLength(60)
  key: string;

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
}

/** Several module changes saved together (all or nothing), with one reason for the audit log. */
export class UpdatePlatformModulesBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ModuleChangeDto)
  changes: ModuleChangeDto[];

  @IsString()
  @MinLength(5, { message: 'reason must be at least 5 characters' })
  @MaxLength(500)
  reason: string;
}
