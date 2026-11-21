import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsIn,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryCourseDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsOptional()
  @IsIn(['draft', 'pending_review', 'approved', 'rejected', 'published', 'archived', 'all'])
  status?: string;

  @IsOptional()
  @IsUUID('4')
  instructorId?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

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
  limit?: number = 10;

  @IsOptional()
  @IsIn(['created_at', 'updated_at', 'title', 'price', 'status', 'published_at', 'rating', 'students'])
  sortBy?: string = 'created_at';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : 'DESC'))
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

