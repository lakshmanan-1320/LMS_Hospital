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

export class QueryApprovalDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsOptional()
  @IsIn(['pending_review', 'approved', 'rejected', 'draft', 'published', 'archived', 'all'])
  status?: string = 'pending_review';

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
  @IsIn(['submitted_at', 'created_at', 'updated_at', 'title'])
  sortBy?: string = 'submitted_at';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : 'DESC'))
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

