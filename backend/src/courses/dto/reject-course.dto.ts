import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RejectCourseDto {
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @IsString({ message: 'Rejection reason must be a string' })
  @MinLength(5, { message: 'Rejection reason must be at least 5 characters long' })
  @MaxLength(2000, { message: 'Rejection reason cannot exceed 2000 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason: string;
}

