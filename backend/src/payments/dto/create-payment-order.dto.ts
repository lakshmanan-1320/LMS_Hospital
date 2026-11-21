import { IsOptional, IsObject } from 'class-validator';

export class CreatePaymentOrderDto {
  @IsOptional()
  @IsObject()
  notes?: Record<string, any>;
}

