import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class QueryInstructorReviewsDto {
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
  @IsUUID('4', { message: 'courseId must be a valid UUID.' })
  courseId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsIn(['all', 'replied', 'unreplied'], {
    message: 'replyStatus must be one of: all, replied, unreplied.',
  })
  replyStatus?: 'all' | 'replied' | 'unreplied' = 'all';

  @IsOptional()
  @IsIn(['newest', 'oldest', 'highest_rating', 'lowest_rating'], {
    message: 'sortBy must be one of: newest, oldest, highest_rating, lowest_rating.',
  })
  sortBy?: 'newest' | 'oldest' | 'highest_rating' | 'lowest_rating' = 'newest';
}
