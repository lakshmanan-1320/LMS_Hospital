import { IsString, IsNotEmpty } from 'class-validator';

export class ApplyCouponDto {
  @IsString()
  @IsNotEmpty({ message: 'Coupon code is required' })
  code: string;
}

