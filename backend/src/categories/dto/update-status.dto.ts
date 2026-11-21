import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateCategoryStatusDto {
  @IsNotEmpty({ message: 'isActive status is required' })
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive: boolean;

  @IsOptional()
  @IsBoolean({ message: 'cascade must be a boolean' })
  cascade?: boolean = false;
}

