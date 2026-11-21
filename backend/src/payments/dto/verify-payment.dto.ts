import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'razorpay_order_id is required' })
  razorpay_order_id: string;

  @IsString()
  @IsNotEmpty({ message: 'razorpay_payment_id is required' })
  razorpay_payment_id: string;

  @IsString()
  @IsNotEmpty({ message: 'razorpay_signature is required' })
  razorpay_signature: string;
}

