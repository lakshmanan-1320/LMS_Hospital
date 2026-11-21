import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ValidateCouponDto {
  @IsString()
  @IsNotEmpty({ message: 'Coupon code is required' })
  code: string;

  @IsNumber({}, { message: 'cartAmount must be a valid number' })
  @Min(0, { message: 'cartAmount cannot be negative' })
  @Type(() => Number)
  cartAmount: number;

  @IsOptional()
  @IsUUID('4', { message: 'courseId must be a valid UUID' })
  courseId?: string;
}
