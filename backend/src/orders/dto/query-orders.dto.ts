import { IsOptional, IsInt, Min, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../interfaces/order.interface';

export class QueryOrdersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'completed', 'failed', 'refunded', 'partially_refunded', 'cancelled'])
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

