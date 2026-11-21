import { IsString, IsOptional, IsObject } from 'class-validator';

export class CheckoutOrderDto {
  @IsOptional()
  @IsString()
  razorpay_order_id?: string;

  @IsOptional()
  @IsString()
  razorpay_payment_id?: string;

  @IsOptional()
  @IsString()
  razorpay_signature?: string;

  @IsOptional()
  @IsObject()
  billing_details?: Record<string, any>;
}

