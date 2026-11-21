import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MinLength(2, { message: 'Category name must be at least 2 characters' })
  @MaxLength(100, { message: 'Category name cannot exceed 100 characters' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Slug cannot exceed 120 characters' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Parent category ID must be a valid UUID' })
  parentCategoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Icon identifier or URL cannot exceed 255 characters' })
  icon?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Display order must be an integer' })
  @Min(0, { message: 'Display order cannot be negative' })
  displayOrder?: number = 0;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean = true;
}

