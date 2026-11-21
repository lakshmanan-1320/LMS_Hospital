import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  Min,
  Max,
  IsDateString,
} from 'class-validator';

export class SetCourseCouponDto {
  /**
   * If applying an existing Admin coupon
   */
  @IsOptional()
  @IsUUID('4', { message: 'couponId must be a valid UUID.' })
  couponId?: string;

  /**
   * If proposing a new course coupon during course creation
   */
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['percentage', 'fixed'], {
    message: 'discount_type must be "percentage" or "fixed".',
  })
  discount_type?: 'percentage' | 'fixed';

  @IsOptional()
  @IsNumber({}, { message: 'discount_value must be a valid number.' })
  @Min(0.01, { message: 'discount_value must be greater than 0.' })
  discount_value?: number;

  @IsOptional()
  @IsNumber({}, { message: 'min_order_value must be a valid number.' })
  @Min(0, { message: 'min_order_value cannot be negative.' })
  min_order_value?: number;

  @IsOptional()
  @IsNumber({}, { message: 'max_discount_amount must be a valid number.' })
  @Min(1, { message: 'max_discount_amount must be greater than 0.' })
  max_discount_amount?: number;

  @IsOptional()
  @IsNumber({}, { message: 'usage_limit must be an integer.' })
  @Min(1, { message: 'usage_limit must be at least 1.' })
  usage_limit?: number;

  @IsOptional()
  @IsDateString({}, { message: 'valid_until must be an ISO date string.' })
  valid_until?: string;
}

