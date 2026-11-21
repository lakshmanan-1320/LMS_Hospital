import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateReplacementRequestDto {
  @IsNotEmpty({ message: 'Replacement reason is required' })
  @IsString()
  @MaxLength(1000, { message: 'Reason must not exceed 1000 characters' })
  reason: string;
}
