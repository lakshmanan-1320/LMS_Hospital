import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryCourseReviewsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsIn(['newest', 'oldest', 'highest_rating', 'lowest_rating'], {
    message: 'sortBy must be one of: newest, oldest, highest_rating, lowest_rating.',
  })
  sortBy?: 'newest' | 'oldest' | 'highest_rating' | 'lowest_rating' = 'newest';
}
