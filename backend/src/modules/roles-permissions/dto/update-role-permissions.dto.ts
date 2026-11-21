import { IsArray, IsString, MinLength, MaxLength, ArrayUnique } from 'class-validator';

export class UpdateRolePermissionsDto {
  /** The complete set of permission codes the role should hold after the change. */
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions: string[];

  /** Required: recorded in the audit log. */
  @IsString()
  @MinLength(5, { message: 'reason must be at least 5 characters' })
  @MaxLength(500)
  reason: string;
}
