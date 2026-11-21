import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsNumber,
  Min,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  Matches,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]{3,50}$/, {
    message: 'Coupon code must be 3-50 alphanumeric characters (hyphens and underscores allowed)',
  })
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['percentage', 'fixed'], {
    message: 'discount_type must be either percentage or fixed',
  })
  discount_type: 'percentage' | 'fixed';

  @IsNumber({}, { message: 'discount_value must be a valid number' })
  @Min(0.01, { message: 'discount_value must be greater than 0' })
  @Type(() => Number)
  discount_value: number;

  @IsOptional()
  @IsIn(['platform', 'course'], {
    message: 'scope must be either platform or course',
  })
  scope?: 'platform' | 'course';

  @IsOptional()
  @IsUUID('4', { message: 'course_id must be a valid UUID' })
  course_id?: string;

  @IsOptional()
  @IsNumber({}, { message: 'min_order_value must be a valid number' })
  @Min(0, { message: 'min_order_value cannot be negative' })
  @Type(() => Number)
  min_order_value?: number;

  @IsOptional()
  @IsNumber({}, { message: 'max_discount_amount must be a valid number' })
  @Min(0.01, { message: 'max_discount_amount must be greater than 0' })
  @Type(() => Number)
  max_discount_amount?: number;

  @IsOptional()
  @IsInt({ message: 'usage_limit must be an integer' })
  @Min(1, { message: 'usage_limit must be at least 1' })
  @Type(() => Number)
  usage_limit?: number;

  @IsOptional()
  @IsInt({ message: 'per_user_limit must be an integer' })
  @Min(1, { message: 'per_user_limit must be at least 1' })
  @Type(() => Number)
  per_user_limit?: number;

  @IsOptional()
  @IsDateString({}, { message: 'valid_from must be a valid ISO date string' })
  valid_from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'valid_until must be a valid ISO date string' })
  valid_until?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

