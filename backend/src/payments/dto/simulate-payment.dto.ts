import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class SimulatePaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'orderId is required' })
  orderId: string;

  @IsString()
  @IsIn(['SUCCESS', 'FAILURE', 'CANCELLED'], {
    message: 'scenario must be SUCCESS, FAILURE, or CANCELLED',
  })
  scenario: 'SUCCESS' | 'FAILURE' | 'CANCELLED';

  @IsOptional()
  @IsString()
  @IsIn(['card', 'upi', 'netbanking', 'wallet', 'mock'], {
    message: 'method must be card, upi, netbanking, wallet, or mock',
  })
  method?: string;
}

