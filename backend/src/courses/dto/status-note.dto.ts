import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class StatusNoteDto {
  @IsOptional()
  @IsString({ message: 'Note must be a string' })
  @MaxLength(1000, { message: 'Note cannot exceed 1000 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  note?: string;
}

