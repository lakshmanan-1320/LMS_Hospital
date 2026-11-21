import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty({ message: 'Course title is required' })
  @MinLength(2, { message: 'Course title must be at least 2 characters long' })
  @MaxLength(200, { message: 'Course title cannot exceed 200 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title: string;

  @IsOptional()
  @IsUUID('4', { message: 'Category ID must be a valid UUID v4' })
  @Transform(({ value }) => (value === '' || value === 'null' ? null : value))
  categoryId?: string | null;
}

