import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsUUID,
  IsArray,
  IsIn,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Course title must be at least 2 characters long' })
  @MaxLength(200, { message: 'Course title cannot exceed 200 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Subtitle cannot exceed 300 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  subtitle?: string | null;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Category ID must be a valid UUID v4' })
  @Transform(({ value }) => (value === '' || value === 'null' ? null : value))
  categoryId?: string | null;

  @IsOptional()
  @IsArray({ message: 'Learning outcomes must be an array of strings' })
  @IsString({ each: true, message: 'Each learning outcome must be a string' })
  learningOutcomes?: string[];

  @IsOptional()
  @IsArray({ message: 'Requirements must be an array of strings' })
  @IsString({ each: true, message: 'Each requirement must be a string' })
  requirements?: string[];

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  targetAudience?: string | null;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'all_levels'], {
    message: 'Level must be beginner, intermediate, advanced, or all_levels',
  })
  level?: 'beginner' | 'intermediate' | 'advanced' | 'all_levels';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  language?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1) return true;
    if (value === 'false' || value === false || value === 0) return false;
    return value;
  })
  isFree?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Price must be a valid number' })
  @Min(0, { message: 'Price cannot be negative' })
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Discount price must be a valid number' })
  @Min(0, { message: 'Discount price cannot be negative' })
  discountPrice?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(3, { message: 'Currency code must be 3 characters (e.g. INR)' })
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024, { message: 'Thumbnail URL cannot exceed 1024 characters' })
  @Transform(({ value }) => (value === '' || value === 'null' ? null : value))
  thumbnailUrl?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Promo video asset ID must be a valid UUID v4' })
  @Transform(({ value }) => (value === '' || value === 'null' ? null : value))
  promoVideoAssetId?: string | null;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1) return true;
    if (value === 'false' || value === false || value === 0) return false;
    return value;
  })
  isRefundable?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Refund period must be a valid number of days' })
  @Min(0, { message: 'Refund period cannot be negative' })
  refundPeriodDays?: number;
}

