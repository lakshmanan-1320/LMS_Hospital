import { IsIn, IsString, IsOptional } from 'class-validator';

export class ReviewRefundDto {
  @IsString()
  @IsIn(['approve', 'reject'], { message: 'decision must be either approve or reject' })
  decision: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  admin_notes?: string;
}

