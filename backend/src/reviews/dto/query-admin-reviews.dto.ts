import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class QueryAdminReviewsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['all', 'published', 'hidden', 'flagged'], {
    message: 'status must be one of: all, published, hidden, flagged.',
  })
  status?: string = 'all';

  @IsOptional()
  @IsUUID('4', { message: 'courseId must be a valid UUID.' })
  courseId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'instructorId must be a valid UUID.' })
  instructorId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'studentId must be a valid UUID.' })
  studentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest', 'highest_rating', 'lowest_rating'], {
    message: 'sortBy must be one of: newest, oldest, highest_rating, lowest_rating.',
  })
  sortBy?: 'newest' | 'oldest' | 'highest_rating' | 'lowest_rating' = 'newest';
}
