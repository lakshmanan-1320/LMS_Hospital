import { IsUUID, IsString, MinLength } from 'class-validator';

export class RequestRefundDto {
  @IsUUID('4', { message: 'order_id must be a valid UUID' })
  order_id: string;

  @IsString()
  @MinLength(5, { message: 'reason must be at least 5 characters long' })
  reason: string;
}

