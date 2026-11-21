import {
  IsInt,
  Min,
  Max,
  IsString,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class UpdateReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Rating must be at least 1 star.' })
  @Max(5, { message: 'Rating cannot exceed 5 stars.' })
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Review headline cannot exceed 150 characters.' })
  reviewTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Review content cannot exceed 5000 characters.' })
  reviewText?: string;
}
