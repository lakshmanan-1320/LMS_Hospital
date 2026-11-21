import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewReplacementRequestDto {
  @IsNotEmpty({ message: 'Decision action is required' })
  @IsIn(['approved', 'rejected'], {
    message: 'Action must be either "approved" or "rejected"',
  })
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Comment must not exceed 1000 characters' })
  comment?: string;
}
