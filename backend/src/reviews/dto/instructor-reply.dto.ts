import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class InstructorReplyDto {
  @IsNotEmpty({ message: 'Reply text cannot be empty.' })
  @IsString()
  @MinLength(2, { message: 'Reply must be at least 2 characters long.' })
  @MaxLength(3000, { message: 'Reply cannot exceed 3000 characters.' })
  replyText: string;
}
